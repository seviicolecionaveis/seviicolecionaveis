import * as React from 'react'
import { Heading, Section, Text, Img } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface BackInStockProps {
  cardName?: string
  collection?: string
  cardNumber?: string
  cardImage?: string | null
  cardUrl?: string
}

const BackInStockEmail: React.FC<BackInStockProps> = ({
  cardName = 'Sua carta',
  collection,
  cardNumber,
  cardImage,
  cardUrl,
}) => {
  const url = cardUrl || SITE_URL
  return (
    <EmailLayout preview={`${cardName} voltou ao estoque!`}>
      <Heading style={styles.h1}>Boas notícias! {cardName} voltou.</Heading>
      <Text style={styles.text}>
        A carta que você estava esperando está de volta ao nosso catálogo.
        Garante a sua antes que esgote de novo — quantidades costumam ser
        limitadas.
      </Text>

      <Section style={{ ...styles.card, textAlign: 'center' }}>
        {cardImage && (
          <Img
            src={cardImage}
            alt={cardName}
            width="160"
            height="224"
            style={{ display: 'block', margin: '0 auto 12px', borderRadius: '8px', border: '1px solid #eee', objectFit: 'cover' }}
          />
        )}
        <Text style={{ ...styles.muted, margin: '4px 0', fontWeight: 700, color: '#111' }}>
          {cardName}
        </Text>
        {(collection || cardNumber) && (
          <Text style={{ ...styles.muted, margin: 0, fontSize: '12px' }}>
            {collection}{cardNumber ? ` · #${cardNumber}` : ''}
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <a
          href={url}
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
          Ver carta no site
        </a>
      </Section>

      <Text style={{ ...styles.muted, fontSize: '12px' }}>
        Você está recebendo este e-mail porque pediu para ser avisado quando
        essa carta voltasse ao estoque. Caso não queira mais receber esse
        tipo de aviso, use o link de cancelamento no rodapé.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: BackInStockEmail,
  subject: (data: Record<string, any>) =>
    `${data.cardName ?? 'Sua carta'} voltou ao estoque na Sevii!`,
  displayName: 'Carta de volta ao estoque',
  previewData: {
    cardName: 'Charizard ex',
    collection: 'MEW - 151',
    cardNumber: '199/165',
    cardImage: 'https://images.pokemontcg.io/sv3pt5/199.png',
    cardUrl: 'https://seviicolecionaveis.com.br/carta/charizard-ex-mew-151-199-165',
  },
} satisfies TemplateEntry
