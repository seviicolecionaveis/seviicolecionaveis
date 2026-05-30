import * as React from 'react'
import { Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, formatBRL, SITE_URL } from './_shared'

interface GiftVoucherProps {
  recipientName?: string
  code?: string
  amountCents?: number
  expiresAt?: string | null
}

const GiftVoucherEmail: React.FC<GiftVoucherProps> = ({
  recipientName,
  code,
  amountCents,
  expiresAt,
}) => {
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null
  return (
    <EmailLayout preview={`Você recebeu um vale-presente de ${formatBRL(amountCents)}`}>
      <Heading style={styles.h1}>Um presente pra você 🎁</Heading>
      <Text style={styles.text}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá!'} Preparamos um vale-presente
        exclusivo pra você usar na sua próxima compra na Sevii Colecionáveis.
      </Text>

      <Section
        style={{
          ...styles.card,
          textAlign: 'center',
          backgroundColor: '#fff8e6',
          border: '2px dashed #c9a84c',
        }}
      >
        <Text style={{ ...styles.muted, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          VALE-PRESENTE
        </Text>
        <Text
          style={{
            fontSize: '32px',
            fontWeight: 800,
            color: '#111',
            margin: '0 0 14px',
            letterSpacing: '0.02em',
          }}
        >
          {formatBRL(amountCents)}
        </Text>
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Use o código</Text>
        <Text
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#111',
            letterSpacing: '0.18em',
            margin: 0,
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
          }}
        >
          {code}
        </Text>
      </Section>

      <Text style={styles.text}>
        Basta inserir o código no campo de cupom durante o checkout — o desconto será
        aplicado automaticamente ao total do seu pedido.
      </Text>

      <Section style={styles.card}>
        <Text style={{ ...styles.muted, margin: '0 0 6px' }}>Detalhes</Text>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}>
          • Vale-presente pessoal e intransferível
        </Text>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}>
          • Pode ser usado uma única vez
        </Text>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}>
          • Válido em pedidos de qualquer valor
        </Text>
        {expiresLabel && (
          <Text style={{ ...styles.text, margin: '0' }}>
            • Válido até <strong>{expiresLabel}</strong>
          </Text>
        )}
      </Section>

      <Text style={styles.muted}>
        Comece a usar agora:{' '}
        <a href={`${SITE_URL}/cartas`} style={{ color: '#111', fontWeight: 600 }}>
          ver cartas disponíveis
        </a>
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: GiftVoucherEmail,
  subject: (data: Record<string, any>) => {
    const amt = typeof data.amountCents === 'number' ? formatBRL(data.amountCents) : ''
    return `🎁 Seu vale-presente${amt ? ` de ${amt}` : ''} chegou`
  },
  displayName: 'Vale-presente',
  previewData: {
    recipientName: 'Andresa',
    code: 'ANDRESA2205',
    amountCents: 2205,
    expiresAt: null,
  },
} satisfies TemplateEntry
