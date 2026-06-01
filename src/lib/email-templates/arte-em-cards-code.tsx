import * as React from 'react'
import { Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface ArteEmCardsCodeProps {
  recipientName?: string
  code?: string
  cycleEnd?: string
}

function formatExpiration(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return iso
  }
}

const ArteEmCardsCodeEmail: React.FC<ArteEmCardsCodeProps> = ({
  recipientName,
  code,
  cycleEnd,
}) => (
  <EmailLayout preview={`Seu código Arte em Cards: ${code ?? ''}`}>
    <Heading style={styles.h1}>Seu código Arte em Cards chegou! ✨</Heading>
    <Text style={styles.text}>
      {recipientName ? `Olá, ${recipientName}!` : 'Olá!'} Recebemos a sua taxa
      semanal de <strong>R$ 5,00</strong> e geramos o seu código exclusivo
      para a modalidade <strong>Retirada na Arte em Cards</strong>.
    </Text>

    <Section style={styles.card}>
      <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Seu código</Text>
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#111111',
          margin: '0 0 12px',
        }}
      >
        {code}
      </Text>
      <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Válido até</Text>
      <Text style={{ ...styles.text, margin: 0, fontWeight: 600 }}>
        {formatExpiration(cycleEnd)}
      </Text>
    </Section>

    <Text style={styles.text}>
      Durante este ciclo semanal, você pode usar este código em{' '}
      <strong>quantas compras quiser</strong> no checkout, escolhendo a
      modalidade <strong>Retirada na Arte em Cards</strong>, sem pagar
      novamente a taxa de R$ 5,00.
    </Text>

    <Text style={styles.muted}>
      O benefício vale sempre até a próxima sexta-feira às 11h59 (horário de
      Brasília). Após esse horário, será necessário gerar um novo código
      pagando a taxa semanal novamente.
    </Text>

    <Text style={styles.muted}>
      Você também pode consultar o código a qualquer momento em{' '}
      <a
        href={`${SITE_URL}/conta`}
        style={{ color: '#111', fontWeight: 600 }}
      >
        Minha conta → Arte em Cards
      </a>
      .
    </Text>
  </EmailLayout>
)

export const template = {
  component: ArteEmCardsCodeEmail,
  subject: (data: Record<string, any>) => {
    const code = typeof data.code === 'string' ? data.code : ''
    return code
      ? `Seu código Arte em Cards: ${code}`
      : 'Seu código Arte em Cards'
  },
  displayName: 'Código Arte em Cards',
  previewData: {
    recipientName: 'Ash',
    code: 'AEC-A1B2C3D4',
    cycleEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
} satisfies TemplateEntry
