import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS_BY_REASON: Record<Reason, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MESSAGE_BY_REASON: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

/**
 * Records a terminal delivery outcome in the app's own tables.
 * These rows are a convenience view for the admin email monitor —
 * Lovable enforces suppression server-side at send time.
 */
async function recordOutcome(
  reason: Reason,
  recipient: string,
  eventId: string,
) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const supabase = supabaseAdmin as any
  const normalizedEmail = recipient.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: normalizedEmail, reason, metadata: null },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: insertError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: normalizedEmail,
    status: STATUS_BY_REASON[reason],
    error_message: MESSAGE_BY_REASON[reason],
    metadata: null,
  })

  if (insertError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: insertError.code,
      message: insertError.message,
    })
    throw new Error('Failed to write email send log')
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await recordOutcome('bounce', event.data.recipient, event.event_id)
            },
            'email.complaint': async (event) => {
              await recordOutcome('complaint', event.data.recipient, event.event_id)
            },
            'email.unsubscribed': async (event) => {
              await recordOutcome('unsubscribe', event.data.recipient, event.event_id)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
