import * as React from 'react'
import { Section, Text, Heading, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, SITE_URL } from './_shared'

interface LoyaltyProgramLaunchProps {
  recipientName?: string
}

const LoyaltyProgramLaunchEmail: React.FC<LoyaltyProgramLaunchProps> = ({
  recipientName,
}) => {
  return (
    <EmailLayout preview="🎉 Agora você ganha pontos em cada compra na Sevii!">
      <Heading style={styles.h1}>
        {recipientName ? `Olá, ${recipientName}!` : 'Olá, Treinador!'}
      </Heading>
      <Text style={styles.text}>
        Temos uma novidade incrível para você: a <strong>Sevii Colecionáveis</strong> agora tem um programa de fidelidade! A cada compra, você acumula pontos que viram descontos reais nas próximas aquisições.
      </Text>

      <Section style={{ backgroundColor: '#fff7ed', borderRadius: '12px', padding: '20px', margin: '24px 0', border: '1px solid #fed7aa' }}>
        <Heading as="h2" style={{ ...styles.h2, color: '#9a3412', marginTop: 0 }}>
          Como funciona
        </Heading>
        <ul style={{ paddingLeft: '20px', margin: '0', color: '#431407', fontSize: '14px', lineHeight: '1.7' }}>
          <li><strong>💰 R$ 1 = 10 pontos</strong> em cada pedido pago</li>
          <li><strong>🎁 100 pontos = R$ 5,00</strong> de desconto no checkout</li>
          <li><strong>🎂 Aniversário:</strong> ganhe <strong>100 pontos</strong> no seu dia (cadastre sua data de nascimento na conta)</li>
          <li><strong>✨ Níveis:</strong> Bronze → Prata → Ouro. Quanto mais compra, mais pontos ganha por real</li>
          <li><strong>⏳ Validade:</strong> pontos expiram após 12 meses de inatividade</li>
        </ul>
      </Section>

      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button
          href={`${SITE_URL}/conta`}
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
          Ver meus pontos
        </Button>
      </Section>

      <Text style={styles.text}>
        Seus pontos são <strong>automáticos</strong>: assim que o pagamento de um pedido é confirmado, os pontos caem na sua conta. Na hora de finalizar uma nova compra, é só escolher quantos pontos quer usar de desconto. Simples assim!
      </Text>

      <Hr style={hr} />

      <Text style={{ ...styles.muted, fontSize: '12px', textAlign: 'center' }}>
        Dúvidas? Responda este e-mail ou fale conosco pelo WhatsApp.<br />
        Acesse: <a href={SITE_URL} style={{ color: '#666' }}>seviicolecionaveis.com.br</a>
      </Text>
    </EmailLayout>
  )
}

const hr = {
  borderTop: '1px solid #e5e5e5',
  margin: '24px 0',
}

export const template = {
  component: LoyaltyProgramLaunchEmail,
  subject: (data: Record<string, any>) =>
    data.recipientName
      ? `${data.recipientName}, agora você ganha pontos em cada compra! 🎉`
      : 'Agora você ganha pontos em cada compra na Sevii! 🎉',
  displayName: 'Anúncio — Programa de Pontos',
  previewData: { recipientName: 'Ash' },
} satisfies TemplateEntry
