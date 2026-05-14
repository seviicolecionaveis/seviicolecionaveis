import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

export const SITE_NAME = 'Sevii Colecionáveis'
export const SITE_URL = 'https://seviicolecionaveis.com.br'

export function formatBRL(cents: number | undefined | null): string {
  const v = ((cents ?? 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `R$ ${v}`
}

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export const EmailLayout: React.FC<LayoutProps> = ({ preview, children }) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>SEVII COLECIONÁVEIS</Heading>
        </Section>
        {children}
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} · cartas Pokémon colecionáveis
          <br />
          <a href={SITE_URL} style={footerLink}>seviicolecionaveis.com.br</a>
        </Text>
      </Container>
    </Body>
  </Html>
)

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}

const header: React.CSSProperties = {
  borderBottom: '2px solid #111111',
  paddingBottom: '16px',
  marginBottom: '24px',
}

const brand: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: '#111111',
  margin: 0,
}

const hr: React.CSSProperties = {
  borderColor: '#eeeeee',
  margin: '32px 0 16px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#888888',
  lineHeight: 1.5,
  textAlign: 'center',
  margin: 0,
}

const footerLink: React.CSSProperties = {
  color: '#888888',
  textDecoration: 'underline',
}

export const styles = {
  h1: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#111111',
    margin: '0 0 16px',
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    color: '#333333',
    lineHeight: 1.6,
    margin: '0 0 16px',
  } as React.CSSProperties,
  muted: {
    fontSize: '13px',
    color: '#666666',
    lineHeight: 1.5,
    margin: '0 0 12px',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#fafafa',
    border: '1px solid #eeeeee',
    borderRadius: '8px',
    padding: '16px 20px',
    margin: '16px 0',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    backgroundColor: '#111111',
    color: '#ffffff',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  total: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111111',
    margin: '8px 0 0',
  } as React.CSSProperties,
}
