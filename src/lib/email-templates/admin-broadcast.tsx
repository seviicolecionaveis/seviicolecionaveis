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

const SITE_URL_WWW = 'https://www.seviicolecionaveis.com.br'

export interface AdminBroadcastProps {
  previewText?: string | null
  heading?: string | null
  bodyHtml: string
  cta?: { label: string; url: string } | null
}

const AdminBroadcastEmail: React.FC<AdminBroadcastProps> = ({
  previewText,
  heading,
  bodyHtml,
  cta,
}) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{previewText || heading || 'Sevii Colecionáveis'}</Preview>
    <Body style={body}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="56" height="56" style={logo} />
          <Text style={brand}>SEVII COLECIONÁVEIS</Text>
        </Section>

        <Section style={main}>
          {heading ? (
            <Heading as="h1" style={h1}>
              {heading}
            </Heading>
          ) : null}

          <div style={richBody} dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          {cta ? (
            <Section style={{ textAlign: 'center', margin: '20px 0 4px' }}>
              <Link href={cta.url} style={ctaBtn}>
                {cta.label}
              </Link>
            </Section>
          ) : null}
        </Section>

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
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
const main: React.CSSProperties = { padding: '28px 8px 24px', color: '#262626' }
const h1: React.CSSProperties = {
  margin: '0 0 22px',
  fontSize: '22px',
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#262626',
  textAlign: 'left',
}
const h2: React.CSSProperties = {
  margin: '24px 0 12px',
  fontSize: '17px',
  lineHeight: 1.4,
  fontWeight: 700,
  color: '#262626',
}
const p: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: '15px',
  lineHeight: 1.7,
  color: '#262626',
  textAlign: 'justify',
}
const richBody: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.7,
  color: '#262626',
}
const inlineLink: React.CSSProperties = {
  color: '#262626',
  textDecoration: 'underline',
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
  component: AdminBroadcastEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || 'Novidades da Sevii Colecionáveis',
  displayName: 'Comunicado manual (admin)',
  previewData: {
    subject: 'Comunicado Sevii',
    heading: 'Olá, colecionador!',
    previewText: 'Uma novidade rápida da Sevii.',
    bodyHtml: '<p>Este é um exemplo de mensagem.</p>',
    cta: { label: 'Falar no WhatsApp', url: 'https://wa.me/5579981509552' },
  },
} satisfies TemplateEntry
