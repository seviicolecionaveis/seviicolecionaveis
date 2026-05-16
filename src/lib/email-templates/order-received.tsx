import * as React from 'react'
import { Section, Text, Heading, Img } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, formatBRL, SITE_URL } from './_shared'

interface OrderItem {
  card_name: string
  quantity: number
  unit_price_cents: number
  finish?: string
  language?: string
  card_image?: string | null
}

interface OrderReceivedProps {
  recipientName?: string
  orderId?: string
  items?: OrderItem[]
  totalCents?: number
  paymentMethod?: string
}

const labelForPayment = (m?: string) => {
  switch (m) {
    case 'pix':
      return 'Pix'
    case 'stripe':
      return 'Cartão (Stripe)'
    case 'mercadopago_card':
      return 'Cartão (Mercado Pago)'
    default:
      return 'A definir'
  }
}

const OrderReceivedEmail: React.FC<OrderReceivedProps> = ({
  recipientName,
  orderId,
  items = [],
  totalCents,
  paymentMethod,
}) => {
  const shortId = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : ''
  return (
    <EmailLayout preview={`Recebemos seu pedido ${shortId}`}>
      <Heading style={styles.h1}>
        {recipientName ? `Obrigado, ${recipientName}!` : 'Obrigado pelo seu pedido!'}
      </Heading>
      <Text style={styles.text}>
        Recebemos seu pedido <strong>{shortId}</strong>. Assim que confirmarmos
        o pagamento, te avisamos por aqui. Caso ainda não tenha pago, conclua
        ou troque a forma de pagamento pelo botão abaixo.
      </Text>

      {orderId && (
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <a
            href={`${SITE_URL}/pay/${orderId}`}
            style={{
              display: 'inline-block',
              backgroundColor: '#111',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.04em',
              padding: '14px 28px',
              borderRadius: '8px',
              textTransform: 'uppercase',
            }}
          >
            Pagar agora / Alterar forma de pagamento
          </a>
          <Text style={{ ...styles.muted, margin: '10px 0 0', fontSize: '11px' }}>
            Você pode escolher entre Pix e Cartão de crédito.
          </Text>
        </Section>
      )}

      {items.length > 0 && (
        <Section style={styles.card}>
          <Text style={{ ...styles.muted, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>
            ITENS DO PEDIDO
          </Text>
          {items.map((it, idx) => (
            <table
              key={idx}
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              style={{ borderCollapse: 'collapse', width: '100%', margin: '8px 0' }}
            >
              <tbody>
                <tr>
                  {it.card_image && (
                    <td style={{ verticalAlign: 'top', paddingRight: '12px', width: '64px' }}>
                      <Img
                        src={it.card_image}
                        alt={it.card_name}
                        width="60"
                        height="84"
                        style={{ display: 'block', borderRadius: '6px', border: '1px solid #eee', objectFit: 'cover' }}
                      />
                    </td>
                  )}
                  <td style={{ verticalAlign: 'top' }}>
                    <Text style={{ ...styles.muted, margin: 0 }}>
                      {it.quantity}× {it.card_name}
                      {it.finish || it.language ? ` (${[it.finish, it.language].filter(Boolean).join(', ')})` : ''}
                      {' — '}
                      <strong>{formatBRL(it.unit_price_cents * it.quantity)}</strong>
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
          <Text style={styles.total}>Total: {formatBRL(totalCents)}</Text>
          <Text style={{ ...styles.muted, margin: '4px 0 0' }}>
            Forma de pagamento: {labelForPayment(paymentMethod)}
          </Text>
        </Section>
      )}

      <Text style={styles.text}>
        Você pode acompanhar o status do pedido a qualquer momento em{' '}
        <a href={`${SITE_URL}/orders/${orderId ?? ''}`} style={{ color: '#111', fontWeight: 600 }}>
          minha conta → pedidos
        </a>.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: OrderReceivedEmail,
  subject: (data: Record<string, any>) => {
    const id = typeof data.orderId === 'string' ? `#${data.orderId.slice(0, 8).toUpperCase()}` : ''
    return `Recebemos seu pedido ${id}`.trim()
  },
  displayName: 'Pedido recebido',
  previewData: {
    recipientName: 'Ash',
    orderId: '7f3e8c12-aaaa-bbbb-cccc-ddddeeeeffff',
    items: [
      { card_name: 'Charizard ex', quantity: 1, unit_price_cents: 12990, finish: 'Holo', language: 'PT', card_image: 'https://images.pokemontcg.io/sv3pt5/199.png' },
      { card_name: 'Pikachu V', quantity: 2, unit_price_cents: 4500, finish: 'Normal', language: 'PT', card_image: 'https://images.pokemontcg.io/swsh4/44.png' },
    ],
    totalCents: 21990,
    paymentMethod: 'pix',
  },
} satisfies TemplateEntry
