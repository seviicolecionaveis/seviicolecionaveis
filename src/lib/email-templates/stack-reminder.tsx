import * as React from 'react'
import { Heading, Section, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface StackReminderProps {
  recipientName?: string
  daysLeft?: number
  hoursLeft?: number
  expiresAt?: string
  itemCount?: number
}

const StackReminderEmail: React.FC<StackReminderProps> = ({
  recipientName,
  daysLeft,
  hoursLeft,
  expiresAt,
  itemCount,
}) => {
  const remaining =
    typeof hoursLeft === 'number' && hoursLeft <= 48
      ? `${hoursLeft} hora${hoursLeft === 1 ? '' : 's'}`
      : `${daysLeft ?? 7} dia${(daysLeft ?? 7) === 1 ? '' : 's'}`
  const urgency =
    typeof hoursLeft === 'number' && hoursLeft <= 24
      ? 'ÚLTIMO AVISO'
      : typeof hoursLeft === 'number' && hoursLeft <= 48
        ? 'Atenção: vence em breve'
        : 'Lembrete'
  const expDate = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <EmailLayout preview={`Sua Pilha de Cartas vence em ${remaining}`}>
      <Heading style={styles.h1}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
      </Heading>
      <Text style={styles.text}>
        Sua <strong>Pilha de Cartas</strong> está se aproximando do prazo de 30 dias.
        Solicite a retirada ou envio para não perder o acesso.
      </Text>

      <Section style={styles.card}>
        <Text style={{ ...styles.muted, margin: '0 0 8px' }}>{urgency}</Text>
        <Text style={{ margin: '0 0 12px' }}>
          <span style={styles.badge}>Vence em {remaining}</span>
        </Text>
        {expDate && (
          <Text style={{ ...styles.text, margin: 0 }}>
            Data de vencimento: <strong>{expDate}</strong>
          </Text>
        )}
        {typeof itemCount === 'number' && itemCount > 0 && (
          <Text style={{ ...styles.muted, margin: '8px 0 0' }}>
            {itemCount} carta{itemCount === 1 ? '' : 's'} armazenada{itemCount === 1 ? '' : 's'}
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button
          href={`${SITE_URL}/pilha`}
          style={{
            background: '#111',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Acessar minha Pilha
        </Button>
      </Section>

      <Text style={styles.muted}>
        Após o prazo de 30 dias, sua pilha será encerrada e será necessário entrar
        em contato conosco para resolver a situação.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: StackReminderEmail,
  subject: (data: Record<string, any>) => {
    const h = typeof data.hoursLeft === 'number' ? data.hoursLeft : null
    if (h !== null && h <= 24) return '⚠️ ÚLTIMO AVISO: Sua Pilha de Cartas vence em 24h'
    if (h !== null && h <= 48) return '⏰ Sua Pilha de Cartas vence em 48 horas'
    return '📦 Sua Pilha de Cartas vence em 7 dias'
  },
  displayName: 'Lembrete de Pilha de Cartas',
  previewData: {
    recipientName: 'Ash',
    daysLeft: 7,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    itemCount: 12,
  },
} satisfies TemplateEntry
