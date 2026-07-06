import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Sevii Colecionáveis'
const SENDER_DOMAIN = 'notify.seviicolecionaveis.com.br'
const FROM_DOMAIN = 'seviicolecionaveis.com.br'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [l, d] = email.split('@')
  if (!l || !d) return '***'
  return `${l[0]}***@${d}`
}

export interface SendTransactionalParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, any>
  batchId?: string
}


/**
 * Server-side helper to enqueue a transactional email.
 * Use from server functions, webhooks, and other trusted server contexts.
 * Mirrors the queueing logic of /lovable/email/transactional/send but skips
 * the user-JWT check since callers are already trusted server code.
 */
export async function sendTransactionalEmailServer(
  params: SendTransactionalParams,
): Promise<{ success: boolean; reason?: string; error?: string }> {
  const { templateName, recipientEmail, templateData = {} } = params
  const messageId = crypto.randomUUID()
  const idempotencyKey = params.idempotencyKey || messageId

  const supabase = supabaseAdmin as any

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('[email] Template not found', { templateName })
    return { success: false, error: 'template_not_found' }
  }

  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return { success: false, error: 'missing_recipient' }
  }

  // 1. Suppression
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('[email] Suppression check failed', suppressionError)
    return { success: false, error: 'suppression_check_failed' }
  }

  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      from_email: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      batch_id: params.batchId ?? null,
    })
    return { success: false, reason: 'email_suppressed' }
  }


  // 2. Get or create unsubscribe token
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token
  }

  // 3. Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })

  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 4. Idempotency guard: if an email with this idempotency_key has already
  // been enqueued/sent/suppressed, skip. Prevents duplicate sends from
  // webhook retries, concurrent invocations, etc.
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', templateName)
      .eq('recipient_email', effectiveRecipient)
      .contains('metadata', { idempotency_key: idempotencyKey })
      .in('status', ['pending', 'sent', 'suppressed', 'bounced'])
      .limit(1)
      .maybeSingle()
    if (existing) {
      console.log('[email] Skipped duplicate', {
        templateName,
        recipient: redactEmail(effectiveRecipient),
        idempotencyKey,
      })
      return { success: true, reason: 'duplicate_skipped' }
    }
  }

  // 5. Log pending + enqueue
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
    metadata: { idempotency_key: idempotencyKey },
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('[email] Failed to enqueue', enqueueError)
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { success: false, error: 'enqueue_failed' }
  }

  console.log('[email] Enqueued', {
    templateName,
    recipient: redactEmail(effectiveRecipient),
  })
  return { success: true }
}

/**
 * Fire-and-forget wrapper: catches errors so a failed email never breaks
 * the main flow (order creation, payment processing, etc.).
 */
export async function sendTransactionalEmailSafe(params: SendTransactionalParams) {
  try {
    return await sendTransactionalEmailServer(params)
  } catch (e) {
    console.error('[email] Unexpected error', e)
    return { success: false, error: 'unexpected' }
  }
}
