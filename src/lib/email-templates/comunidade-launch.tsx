import * as React from 'react'
import { Section, Text, Heading, Button, Hr, Img } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'
import charmanderAsset from '@/assets/sevii-comunidade-charmander.png.asset.json'

interface ComunidadeLaunchProps {
  recipientName?: string
}

const GROUPS: Array<{ emoji: string; title: string; desc: string }> = [
  {
    emoji: '📢',
    title: 'Grupo de Avisos',
    desc: 'Lançamentos, promoções, pré-vendas e comunicados em primeira mão.',
  },
  {
    emoji: '🏆',
    title: 'Leilões',
    desc: 'Toda quarta-feira às 20h, cartas e produtos por preços imperdíveis.',
  },
  {
    emoji: '🛒',
    title: 'Encomendas',
    desc: 'Produtos do Japão (segunda) e cartas graduadas dos EUA (quinta).',
  },
  {
    emoji: '💬',
    title: 'Chat Geral',
    desc: 'Converse com outros colecionadores, tire dúvidas e negocie cartas.',
  },
  {
    emoji: '✨',
    title: 'Treinadores Iniciantes',
    desc: 'Para quem está começando: torneios, desafios e eventos em breve.',
  },
]

const ComunidadeLaunchEmail: React.FC<ComunidadeLaunchProps> = ({ recipientName }) => (
  <EmailLayout preview="Entre na Comunidade Sevii: leilões, encomendas e novidades no WhatsApp">
    <Heading style={styles.h1}>
      {recipientName ? `Olá, ${recipientName}!` : 'Olá, Treinador!'}
    </Heading>
    <Text style={styles.text}>
      Acabamos de lançar a <strong>Comunidade Sevii</strong> — uma página com todos os nossos
      grupos oficiais de WhatsApp reunidos em um só lugar. É lá que rolam os leilões, as
      encomendas e todas as novidades antes de qualquer outro canal.
    </Text>

    <Section
      style={{
        backgroundColor: '#fafafa',
        border: '1px solid #eeeeee',
        borderRadius: '12px',
        padding: '20px',
        margin: '24px 0',
      }}
    >
      <Heading
        as="h2"
        style={{ fontSize: '16px', fontWeight: 700, color: '#111', marginTop: 0, marginBottom: '14px' }}
      >
        Nossos grupos oficiais
      </Heading>
      {GROUPS.map((g) => (
        <Text key={g.title} style={{ fontSize: '14px', color: '#333', lineHeight: 1.6, margin: '0 0 12px' }}>
          <strong>
            {g.emoji} {g.title}
          </strong>
          <br />
          <span style={{ color: '#666' }}>{g.desc}</span>
        </Text>
      ))}
    </Section>

    <Section style={{ textAlign: 'center', margin: '28px 0' }}>
      <Button
        href={`${SITE_URL}/comunidade`}
        style={{
          backgroundColor: '#111',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '14px',
          letterSpacing: '0.04em',
          padding: '14px 28px',
          borderRadius: '8px',
          textTransform: 'uppercase',
          display: 'inline-block',
        }}
      >
        Entrar na comunidade
      </Button>
    </Section>

    <Text style={styles.muted}>
      Na página você encontra a descrição de cada grupo, o link de entrada e um QR code para
      escanear pelo celular. Participe do que fizer sentido para você — pode entrar em todos!
    </Text>

    <Hr style={{ borderTop: '1px solid #e5e5e5', margin: '24px 0' }} />

    <Text style={{ ...styles.muted, fontSize: '12px', textAlign: 'center' }}>
      Dúvidas? Responda este e-mail ou fale conosco pelo WhatsApp.
      <br />
      Acesse: <a href={`${SITE_URL}/comunidade`} style={{ color: '#666' }}>seviicolecionaveis.com.br/comunidade</a>
    </Text>
  </EmailLayout>
)

export const template = {
  component: ComunidadeLaunchEmail,
  subject: (data: Record<string, any>) =>
    data.recipientName
      ? `${data.recipientName}, a Comunidade Sevii está no ar! 🎉`
      : 'A Comunidade Sevii está no ar! 🎉',
  displayName: 'Anúncio — Comunidade Sevii',
  previewData: { recipientName: 'Ash' },
} satisfies TemplateEntry
