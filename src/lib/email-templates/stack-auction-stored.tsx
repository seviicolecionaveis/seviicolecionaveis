import * as React from 'react'
import { Heading, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL, formatBRL } from './_shared'

interface AuctionItem {
  card_name: string
  collection?: string | null
  card_number?: string | null
  finish?: string | null
  language?: string | null
  condition?: string | null
  quantity: number
  unit_price_cents?: number | null
}

interface StackAuctionStoredProps {
  recipientName?: string
  auctionName: string
  auctionDate?: string | null
  items: AuctionItem[]
  expiresAt?: string | null
}

const StackAuctionStoredEmail: React.FC<StackAuctionStoredProps> = ({
  recipientName,
  auctionName,
  auctionDate,
  items = [],
  expiresAt,
}) => {
  const totalQty = items.reduce((s, it) => s + (it.quantity ?? 0), 0)
  const totalCents = items.reduce(
    (s, it) => s + (it.unit_price_cents ?? 0) * (it.quantity ?? 0),
    0,
  )
  const expDate = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null
  const auctionDateFmt = auctionDate
    ? new Date(auctionDate + 'T00:00:00').toLocaleDateString('pt-BR')
    : null

  return (
    <EmailLayout preview={`Suas cartas do leilão "${auctionName}" foram guardadas`}>
      <Heading style={styles.h1}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
      </Heading>
      <Text style={styles.text}>
        🔨 Suas cartas arrematadas no leilão <strong>{auctionName}</strong>
        {auctionDateFmt ? <> (realizado em <strong>{auctionDateFmt}</strong>)</> : null}{' '}
        já estão guardadas na sua <strong>Pilha de Cartas</strong>. As cartas
        ficam armazenadas com a gente até você solicitar retirada ou envio.
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
  component: StackAuctionStoredEmail,
  subject: (data: Record<string, any>) => {
    const name = typeof data.auctionName === 'string' ? data.auctionName : 'leilão'
    return `🔨 Suas cartas do leilão "${name}" estão na sua Pilha`
  },
  displayName: 'Cartas de leilão armazenadas na Pilha',
  previewData: {
    recipientName: 'Ash',
    auctionName: 'Leilão Coleção 151',
    auctionDate: new Date().toISOString().slice(0, 10),
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
    ],
  },
} satisfies TemplateEntry
