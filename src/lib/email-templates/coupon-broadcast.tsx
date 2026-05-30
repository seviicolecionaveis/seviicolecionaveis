import * as React from 'react'
import { Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, formatBRL, SITE_URL } from './_shared'

interface CouponBroadcastProps {
  code?: string
  percent?: number | null
  amountCents?: number | null
  expiresAt?: string | null
  message?: string | null
}

const CouponBroadcastEmail: React.FC<CouponBroadcastProps> = ({
  code,
  percent,
  amountCents,
  expiresAt,
  message,
}) => {
  const discountLabel =
    amountCents && amountCents > 0
      ? formatBRL(amountCents)
      : percent && percent > 0
        ? `${percent}% OFF`
        : 'Desconto'

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <EmailLayout preview={`Cupom ${discountLabel} liberado: use ${code}`}>
      <Heading style={styles.h1}>Um cupom especial pra você 💛</Heading>
      <Text style={styles.text}>
        {message ||
          'Liberamos um cupom novo no catálogo da Sevii Colecionáveis — aproveita pra garantir aquela carta que tava na lista!'}
      </Text>

      <Section
        style={{
          ...styles.card,
          textAlign: 'center',
          backgroundColor: '#fff7ed',
          border: '2px dashed #f97316',
        }}
      >
        <Text style={{ ...styles.muted, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          CUPOM DE DESCONTO
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
          {discountLabel}
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
        Basta inserir o código no campo de cupom durante o checkout — o desconto é
        aplicado automaticamente.
      </Text>

      {expiresLabel && (
        <Text style={styles.muted}>
          • Válido até <strong>{expiresLabel}</strong>
        </Text>
      )}

      <Text style={styles.muted}>
        Bora escolher:{' '}
        <a href={`${SITE_URL}/cartas`} style={{ color: '#111', fontWeight: 600 }}>
          ver cartas disponíveis
        </a>
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: CouponBroadcastEmail,
  subject: (data: Record<string, any>) => {
    const label =
      typeof data.amountCents === 'number' && data.amountCents > 0
        ? `R$ ${(data.amountCents / 100).toFixed(2).replace('.', ',')}`
        : typeof data.percent === 'number' && data.percent > 0
          ? `${data.percent}% OFF`
          : 'Desconto'
    return `🎟️ Novo cupom: ${label} com o código ${data.code ?? ''}`.trim()
  },
  displayName: 'Cupom — divulgação',
  previewData: {
    code: 'SEVII10',
    percent: 10,
    amountCents: null,
    expiresAt: null,
    message: null,
  },
} satisfies TemplateEntry
