import * as React from 'react'
import { Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface OrderStatusUpdatedProps {
  recipientName?: string
  orderId?: string
  status?: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  cancellation_requested: 'Cancelamento solicitado',
}

const STATUS_MESSAGE: Record<string, string> = {
  pending: 'Seu pedido está aguardando a confirmação do pagamento.',
  paid: 'O pagamento do seu pedido foi confirmado e ele já está em preparação.',
  shipped: 'Seu pedido foi enviado! Em breve chega aí.',
  delivered: 'Seu pedido foi entregue. Esperamos que goste! 🎉',
  cancelled: 'Seu pedido foi cancelado. Se tiver dúvidas, fala com a gente.',
  cancellation_requested: 'Recebemos sua solicitação de cancelamento e vamos analisar em breve.',
}

const OrderStatusUpdatedEmail: React.FC<OrderStatusUpdatedProps> = ({
  recipientName,
  orderId,
  status,
}) => {
  const shortId = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : ''
  const label = (status && STATUS_LABEL[status]) || status || 'Atualizado'
  const msg =
    (status && STATUS_MESSAGE[status]) ||
    'Houve uma atualização no status do seu pedido.'

  return (
    <EmailLayout preview={`Pedido ${shortId}: ${label}`}>
      <Heading style={styles.h1}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
      </Heading>
      <Text style={styles.text}>
        Seu pedido <strong>{shortId}</strong> teve uma atualização de status.
      </Text>

      <Section style={styles.card}>
        <Text style={{ ...styles.muted, margin: '0 0 8px' }}>Novo status</Text>
        <Text style={{ margin: '0 0 12px' }}>
          <span style={styles.badge}>{label}</span>
        </Text>
        <Text style={{ ...styles.text, margin: 0 }}>{msg}</Text>
      </Section>

      <Text style={styles.muted}>
        Acompanhe os detalhes em{' '}
        <a href={`${SITE_URL}/orders/${orderId ?? ''}`} style={{ color: '#111', fontWeight: 600 }}>
          minha conta → pedidos
        </a>.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: OrderStatusUpdatedEmail,
  subject: (data: Record<string, any>) => {
    const id = typeof data.orderId === 'string' ? `#${data.orderId.slice(0, 8).toUpperCase()}` : ''
    const label = (data.status && STATUS_LABEL[data.status]) || data.status || 'atualizado'
    return `Pedido ${id}: ${label}`.trim()
  },
  displayName: 'Status do pedido atualizado',
  previewData: {
    recipientName: 'Ash',
    orderId: '7f3e8c12-aaaa-bbbb-cccc-ddddeeeeffff',
    status: 'shipped',
  },
} satisfies TemplateEntry
