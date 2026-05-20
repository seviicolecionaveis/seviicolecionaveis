import * as React from 'react'
import { Heading, Section, Text, Img } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface PriceDropProps {
  cardName?: string
  collection?: string
  cardNumber?: string
  cardImage?: string | null
  cardUrl?: string
  oldPrice?: number
  newPrice?: number
  dropPercent?: number
}

const fmt = (v?: number) =>
  v == null
    ? ''
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PriceDropEmail: React.FC<PriceDropProps> = ({
  cardName = 'Sua carta',
  collection,
  cardNumber,
  cardImage,
  cardUrl,
  oldPrice,
  newPrice,
  dropPercent,
}) => {
  const url = cardUrl || SITE_URL
  return (
    <EmailLayout preview={`Baixou! ${cardName} está mais barata.`}>
      <Heading style={styles.h1}>Baixou de preço! 🎉</Heading>
      <Text style={styles.text}>
        Uma carta que você favoritou ficou mais barata. Aproveite enquanto
        o estoque dura — os preços podem voltar a subir a qualquer momento.
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
          <Text style={{ ...styles.muted, margin: '0 0 12px', fontSize: '12px' }}>
            {collection}{cardNumber ? ` · #${cardNumber}` : ''}
          </Text>
        )}
        {oldPrice != null && newPrice != null && (
          <Text style={{ margin: '8px 0 0', fontSize: '15px' }}>
            <span style={{ color: '#999', textDecoration: 'line-through', marginRight: 8 }}>
              {fmt(oldPrice)}
            </span>
            <span style={{ color: '#0a7c2f', fontWeight: 800, fontSize: '18px' }}>
              {fmt(newPrice)}
            </span>
            {dropPercent != null && dropPercent > 0 && (
              <span style={{ marginLeft: 8, color: '#0a7c2f', fontWeight: 700 }}>
                (-{dropPercent}%)
              </span>
            )}
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
          Ver oferta no site
        </a>
      </Section>

      <Text style={{ ...styles.muted, fontSize: '12px' }}>
        Você está recebendo este e-mail porque favoritou esta carta na Sevii.
        Para parar de receber alertas, use o link de cancelamento no rodapé.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: PriceDropEmail,
  subject: (data: Record<string, any>) =>
    `Baixou! ${data.cardName ?? 'Sua carta'} está mais barata na Sevii`,
  displayName: 'Alerta de redução de preço',
  previewData: {
    cardName: 'Charizard ex',
    collection: 'MEW - 151',
    cardNumber: '199/165',
    cardImage: 'https://images.pokemontcg.io/sv3pt5/199.png',
    cardUrl: 'https://seviicolecionaveis.com.br/carta/charizard-ex-mew-151-199-165',
    oldPrice: 199.9,
    newPrice: 159.9,
    dropPercent: 20,
  },
} satisfies TemplateEntry
