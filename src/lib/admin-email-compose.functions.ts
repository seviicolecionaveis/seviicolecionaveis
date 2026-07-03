import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

interface Payload {
  subject: string
  heading?: string | null
  previewText?: string | null
  body: string
  cta?: { label: string; url: string } | null
  recipients: string[]
}

function validate(input: Payload): Payload {
  if (!input || typeof input !== 'object') throw new Error('Payload inválido')
  const subject = String(input.subject ?? '').trim()
  const body = String(input.body ?? '').trim()
  if (subject.length < 1 || subject.length > 200) throw new Error('Assunto entre 1 e 200 caracteres')
  if (body.length < 1 || body.length > 10000) throw new Error('Corpo entre 1 e 10.000 caracteres')
  const heading = input.heading ? String(input.heading).trim().slice(0, 200) : null
  const previewText = input.previewText ? String(input.previewText).trim().slice(0, 200) : null
  let cta: Payload['cta'] = null
  if (input.cta && input.cta.label && input.cta.url) {
    const label = String(input.cta.label).trim().slice(0, 60)
    const url = String(input.cta.url).trim()
    if (!/^https?:\/\//.test(url)) throw new Error('URL do botão deve começar com https://')
    cta = { label, url }
  }
  const recipients = Array.isArray(input.recipients)
    ? input.recipients.map((r) => String(r))
    : []
  return { subject, heading, previewText, body, cta, recipients }
}

export const previewAdminBroadcast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Payload) => validate({ ...data, recipients: [] }))
  .handler(async ({ data, context }) => {
    const { previewAdminBroadcastServer } = await import('./admin-email-compose.server')
    return previewAdminBroadcastServer(context.userId, data)
  })

export const sendAdminBroadcast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Payload) => validate(data))
  .handler(async ({ data, context }) => {
    const { sendAdminBroadcastServer } = await import('./admin-email-compose.server')
    return sendAdminBroadcastServer(context.userId, data)
  })
