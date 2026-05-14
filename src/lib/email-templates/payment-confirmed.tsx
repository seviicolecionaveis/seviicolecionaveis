import * as React from 'react'
import { Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, formatBRL, SITE_URL } from './_shared'

interface PaymentConfirmedProps {
  recipientName?: string
  orderId?: string
  totalCents?: number
}

const PaymentConfirmedEmail: React.FC<PaymentConfirmedProps> = ({
  recipientName,
  orderId,
  totalCents,
}) => {
  const shortId = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : ''
  return (
    <EmailLayout preview={`Pagamento confirmado para o pedido ${shortId}`}>
      <Heading style={styles.h1}>Pagamento confirmado! 🎉</Heading>
      <Text style={styles.text}>
        {recipientName ? `Boas notícias, ${recipientName}!` : 'Boas notícias!'} Recebemos
        a confirmação do pagamento do seu pedido <strong>{shortId}</strong>.
      </Text>

      <Section style={styles.card}>
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Pedido</Text>
        <Text style={{ ...styles.text, margin: '0 0 12px' }}>
          <strong>{shortId}</strong>
        </Text>
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Total pago</Text>
        <Text style={styles.total}>{formatBRL(totalCents)}</Text>
        <Text style={{ marginTop: 12 }}>
          <span style={styles.badge}>Pago</span>
        </Text>
      </Section>

      <Text style={styles.text}>
        Agora vamos preparar sua encomenda com todo carinho. Você receberá outro
        email assim que o pedido for enviado.
      </Text>
      <Text style={styles.muted}>
        Acompanhe pelo link:{' '}
        <a href={`${SITE_URL}/orders/${orderId ?? ''}`} style={{ color: '#111', fontWeight: 600 }}>
          ver meu pedido
        </a>
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: PaymentConfirmedEmail,
  subject: (data: Record<string, any>) => {
    const id = typeof data.orderId === 'string' ? `#${data.orderId.slice(0, 8).toUpperCase()}` : ''
    return `Pagamento confirmado ${id}`.trim()
  },
  displayName: 'Pagamento confirmado',
  previewData: {
    recipientName: 'Ash',
    orderId: '7f3e8c12-aaaa-bbbb-cccc-ddddeeeeffff',
    totalCents: 21990,
  },
} satisfies TemplateEntry
