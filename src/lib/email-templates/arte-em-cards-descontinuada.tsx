import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LOGO_URL, SITE_NAME } from './_shared'

interface Props {
  recipientName?: string | null
}

const WHATSAPP_URL = 'https://wa.me/5579981509552'
const SITE_URL_WWW = 'https://www.seviicolecionaveis.com.br'

const ArteEmCardsDescontinuadaEmail: React.FC<Props> = () => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Atualização importante sobre a retirada de pedidos na Arte em Cards.</Preview>
    <Body style={body}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Img
            src={LOGO_URL}
            alt={SITE_NAME}
            width="56"
            height="56"
            style={logo}
          />
          <Text style={brand}>SEVII COLECIONÁVEIS</Text>
        </Section>

        {/* Corpo */}
        <Section style={main}>
          <Heading as="h1" style={h1}>
            Atualização sobre retirada na Arte em Cards
          </Heading>

          <Text style={p}>
            Olá! Gostaríamos de informar que, por decisão da Arte em Cards, não será mais possível realizar a retirada de pedidos no local.
          </Text>

          <Text style={p}>
            Para os clientes que solicitaram o envio de pedidos para a Arte em Cards nesta semana (<strong>29/06 – 03/07</strong>), entraremos em contato individualmente para remanejar a forma de entrega ou retirada.
          </Text>

          <Text style={p}>
            Para quem ainda possui pedidos pendentes para retirada na Arte em Cards, pedimos que realizem a retirada <strong>o quanto antes</strong>, para que possamos encerrar esse processo da melhor forma possível.
          </Text>

          <Text style={p}>
            Já estamos buscando um novo ponto de retirada em uma localização próxima, para continuar oferecendo essa comodidade a vocês. Assim que tivermos uma novidade, avisaremos em nossos grupos e canais oficiais.
          </Text>

          <Text style={p}>
            Agradecemos a compreensão de todos. Em caso de dúvidas, é só chamar a gente no WhatsApp!
          </Text>

          {/* CTA */}
          <Section style={{ textAlign: 'center', margin: '12px 0 4px' }}>
            <Link href={WHATSAPP_URL} style={ctaBtn}>
              Falar no WhatsApp
            </Link>
          </Section>
        </Section>

        {/* Rodapé */}
        <Section style={footer}>
          <Img
            src={LOGO_URL}
            alt={SITE_NAME}
            width="32"
            height="32"
            style={{ display: 'block', borderRadius: '6px', margin: '0 auto 10px' }}
          />
          <Text style={footerBrand}>Sevii Colecionáveis — Aracaju, Sergipe</Text>
          <Link href={SITE_URL_WWW} style={footerLink}>
            www.seviicolecionaveis.com.br
          </Link>
        </Section>
      </Container>
    </Body>
  </Html>
)

const body: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
  color: '#262626',
}

const container: React.CSSProperties = {
  maxWidth: '600px',
  width: '100%',
  margin: '0 auto',
  padding: '32px 16px',
  backgroundColor: '#ffffff',
}

const header: React.CSSProperties = {
  textAlign: 'center',
  padding: '8px 24px 24px',
  borderBottom: '2px solid #262626',
}

const logo: React.CSSProperties = {
  display: 'block',
  borderRadius: '10px',
  margin: '0 auto 10px',
}

const brand: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: '#262626',
  textTransform: 'uppercase',
  margin: 0,
}

const main: React.CSSProperties = {
  padding: '28px 8px 24px',
  color: '#262626',
}

const h1: React.CSSProperties = {
  margin: '0 0 22px',
  fontSize: '22px',
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#262626',
  textAlign: 'left',
}

const p: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: '15px',
  lineHeight: 1.7,
  color: '#262626',
  textAlign: 'justify',
}

const ctaBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 32px',
  fontSize: '15px',
  fontWeight: 700,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '999px',
  backgroundColor: '#25D366',
}

const footer: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 24px 8px',
  borderTop: '1px solid #e5e7eb',
}

const footerBrand: React.CSSProperties = {
  fontSize: '13px',
  color: '#262626',
  fontWeight: 600,
  margin: '0 0 4px',
}

const footerLink: React.CSSProperties = {
  fontSize: '13px',
  color: '#262626',
  textDecoration: 'underline',
}

export const template = {
  component: ArteEmCardsDescontinuadaEmail,
  subject: 'Atualização sobre retirada na Arte em Cards',
  displayName: 'Arte em Cards — fim da retirada',
  previewData: { recipientName: 'Cliente' },
} satisfies TemplateEntry
