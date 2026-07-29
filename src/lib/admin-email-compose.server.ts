import * as React from 'react'
import { render } from '@react-email/components'
import sanitizeHtml from 'sanitize-html'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailSafe } from '@/lib/email/send.server'
import {
  template as adminBroadcastTemplate,
} from '@/lib/email-templates/admin-broadcast'


export interface ComposePayload {
  subject: string
  heading?: string | null
  previewText?: string | null
  body: string
  cta?: { label: string; url: string } | null
  recipients: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    if (EMAIL_RE.test(p)) valid.push(p)
    else invalid.push(p)
  }
  return { valid, invalid }
}


const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a', 'img',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style'],
    p: ['style'],
    div: ['style'],
    span: ['style'],
    h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
  },
  allowedStyles: {
    '*': {
      'color': [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-weight': [/^\d+$/, /^bold$/, /^normal$/],
      'max-width': [/^\d{1,3}%$/, /^\d{1,4}px$/],
      'height': [/^auto$/],
      'display': [/^block$/, /^inline-block$/],
      'margin': [/^[\dpxauto\s]+$/],
      'border-radius': [/^\d{1,3}px$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: (attribs.style ? attribs.style + ';' : '') + 'color:#262626;text-decoration:underline;',
      },
    }),
  },
}

export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS)
}



async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!data) throw new Error('Acesso negado')
}

function templateDataFrom(payload: ComposePayload) {
  return {
    subject: payload.subject,
    heading: payload.heading || null,
    previewText: payload.previewText || null,
    bodyHtml: sanitizeBody(payload.body),
    cta: payload.cta || null,
  }
}

export async function previewAdminBroadcastServer(
  userId: string,
  payload: ComposePayload,
): Promise<{ html: string; subject: string }> {
  await assertAdmin(userId)
  const data = templateDataFrom(payload)
  const element = React.createElement(adminBroadcastTemplate.component, data)
  const html = await render(element)
  return { html, subject: payload.subject }
}

export async function sendAdminBroadcastServer(userId: string, payload: ComposePayload) {
  await assertAdmin(userId)

  const recipients = payload.recipients
    .map((r) => r.trim().toLowerCase())
    .filter((r) => EMAIL_RE.test(r))
  const unique = Array.from(new Set(recipients))
  if (unique.length === 0) throw new Error('Nenhum destinatário válido')
  if (unique.length > 5000) throw new Error('Máximo 5000 destinatários por envio')

  const data = templateDataFrom(payload)
  const day = new Date().toISOString().slice(0, 10)
  const bucket = simpleHash(`${payload.subject}|${payload.body}|${payload.cta?.url ?? ''}|${day}`)
  const batchId = `admin-broadcast-${bucket}-${Date.now()}`

  let enqueued = 0
  let skipped = 0
  for (const email of unique) {
    try {
      const res = await sendTransactionalEmailSafe({
        templateName: 'admin-broadcast',
        recipientEmail: email,
        idempotencyKey: `admin-broadcast-${bucket}-${email}`,
        templateData: data,
        batchId,
      })
      if (res.success) enqueued++
      else skipped++
    } catch (e) {
      console.error('[admin-broadcast] falha', email, e)
      skipped++
    }
  }
  return { enqueued, skipped, total: unique.length }
}


export async function listAllCustomerEmailsServer(
  userId: string,
): Promise<{ emails: string[]; total: number }> {
  await assertAdmin(userId)
  const seen = new Set<string>()
  const perPage = 1000
  let page = 1
  // Supabase Auth Admin listUsers pagination
  // Stop after a safety cap to avoid runaway loops
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    for (const u of users) {
      const email = (u.email ?? '').trim().toLowerCase()
      if (email && EMAIL_RE.test(email)) seen.add(email)
    }
    if (users.length < perPage) break
    page++
  }
  // Filter out suppressed emails
  const all = Array.from(seen)
  if (all.length > 0) {
    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails')
      .select('email')
      .in('email', all)
    const supSet = new Set((suppressed ?? []).map((r: any) => String(r.email).toLowerCase()))
    const filtered = all.filter((e) => !supSet.has(e))
    return { emails: filtered, total: filtered.length }
  }
  return { emails: all, total: all.length }
}

function simpleHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}
