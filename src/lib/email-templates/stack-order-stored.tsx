import * as React from 'react'
import { Heading, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL, formatBRL } from './_shared'

interface StackOrderStoredItem {
  card_name: string
  collection?: string | null
  card_number?: string | null
  finish?: string | null
  language?: string | null
  condition?: string | null
  quantity: number
  unit_price_cents?: number | null
}

interface StackOrderStoredProps {
  recipientName?: string
  orderId: string
  items: StackOrderStoredItem[]
  expiresAt?: string | null
}

const StackOrderStoredEmail: React.FC<StackOrderStoredProps> = ({
  recipientName,
  orderId,
  items = [],
  expiresAt,
}) => {
  const shortId = orderId?.slice(0, 8)
  const totalQty = items.reduce((s, it) => s + (it.quantity ?? 0), 0)
  const totalCents = items.reduce(
    (s, it) => s + (it.unit_price_cents ?? 0) * (it.quantity ?? 0),
    0,
  )
  const expDate = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <EmailLayout preview={`Seu pedido foi separado na Pilha de Cartas`}>
      <Heading style={styles.h1}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
      </Heading>
      <Text style={styles.text}>
        Boas notícias: seu pedido <strong>#{shortId}</strong> foi separado e
        guardado na sua <strong>Pilha de Cartas</strong>. As cartas ficam
        armazenadas com a gente até você solicitar a retirada ou o envio.
      </Text>

      <Section style={styles.card}>
        <Text style={{ ...styles.muted, margin: '0 0 8px' }}>Resumo</Text>
        <Text style={{ ...styles.text, margin: 0 }}>
          <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'itens'} ·{' '}
          <strong>{totalQty}</strong> {totalQty === 1 ? 'carta' : 'cartas'} ·{' '}
          <strong>{formatBRL(totalCents)}</strong>
        </Text>
        {expDate && (
          <Text style={{ ...styles.muted, margin: '8px 0 0' }}>
            Prazo da pilha: <strong>{expDate}</strong>
          </Text>
        )}
      </Section>

      <Section style={{ margin: '16px 0' }}>
        <Text style={{ ...styles.muted, margin: '0 0 8px' }}>Cartas guardadas</Text>
        {items.map((it, idx) => {
          const meta = [it.collection, it.card_number ? `#${it.card_number}` : null]
            .filter(Boolean)
            .join(' · ')
          const variant = [it.finish, it.language, it.condition].filter(Boolean).join(' · ')
          return (
            <div key={idx}>
              <Text style={{ ...styles.text, margin: '6px 0 0' }}>
                <strong>{it.quantity}×</strong> {it.card_name}
              </Text>
              {meta && (
                <Text style={{ ...styles.muted, margin: '2px 0 0', fontSize: 12 }}>{meta}</Text>
              )}
              {variant && (
                <Text style={{ ...styles.muted, margin: '2px 0 0', fontSize: 12 }}>{variant}</Text>
              )}
              {idx < items.length - 1 && <Hr style={{ margin: '8px 0', borderColor: '#eee' }} />}
            </div>
          )
        })}
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
          Ver minha Pilha
        </Button>
      </Section>

      <Text style={styles.muted}>
        Quando quiser receber suas cartas, é só acessar sua Pilha e escolher entre
        retirada presencial, Arte em Cards, Correios ou app de entrega.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: StackOrderStoredEmail,
  subject: (data: Record<string, any>) => {
    const short = typeof data.orderId === 'string' ? data.orderId.slice(0, 8) : ''
    return `📦 Pedido #${short} separado na sua Pilha de Cartas`
  },
  displayName: 'Pedido armazenado na Pilha',
  previewData: {
    recipientName: 'Ash',
    orderId: '1a2b3c4d-0000-0000-0000-000000000000',
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    items: [
      {
        card_name: 'Charizard ex',
        collection: 'Obsidian Flames',
        card_number: '125',
        finish: 'Foil',
        language: 'EN',
        condition: 'NM',
        quantity: 1,
        unit_price_cents: 18900,
      },
      {
        card_name: 'Pikachu',
        collection: 'Paldea Evolved',
        card_number: '062',
        finish: 'Normal',
        language: 'PT',
        condition: 'NM',
        quantity: 3,
        unit_price_cents: 450,
      },
    ],
  },
} satisfies TemplateEntry
