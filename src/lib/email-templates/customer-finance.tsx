import { Heading, Text, Button } from '@react-email/components';
import { EmailLayout, styles, formatBRL } from './_shared';
import type { TemplateEntry } from './registry';
const titles: Record<string,string> = { invite: 'Escolha seu reembolso', credited: 'Saldo adicionado à sua conta', awaiting_approval: 'Solicitação de reembolso recebida', approved: 'Reembolso aprovado', processing: 'Reembolso em processamento', refunded: 'Reembolso concluído', declined: 'Solicitação de reembolso recusada', review: 'Reembolso em acompanhamento', revoked: 'Link de reembolso revogado' };
function FinanceEmail({ recipientName, orderId, amountCents, reason, event = 'invite', link }: { recipientName?: string; orderId?: string; amountCents?: number; reason?: string; event?: string; link?: string }) {
  const title = titles[event] ?? 'Atualização do reembolso';
  return <EmailLayout preview={`${title} — ${formatBRL(amountCents)}`}>
    <Heading style={styles.h1}>{title}</Heading>
    <Text style={styles.text}>{recipientName ? `Olá, ${recipientName}.` : 'Olá.'}</Text>
    <Text style={styles.text}>Pedido #{orderId?.slice(0,8).toUpperCase()} · {formatBRL(amountCents)}</Text>
    <Text style={styles.text}>{reason}</Text>
    {event === 'invite' && <Text style={styles.text}>Você pode receber como saldo na Sevii ou solicitar devolução à forma de pagamento original. O link é válido por 7 dias.</Text>}
    {event === 'awaiting_approval' && <Text style={styles.text}>Sua escolha foi registrada e aguarda análise da equipe. Nenhum crédito foi adicionado à sua conta.</Text>}
    {event === 'credited' && <Text style={styles.text}>O valor está disponível na sua conta para novas compras.</Text>}
    {event === 'review' && <Text style={styles.text}>Estamos verificando o resultado do processamento. Este aviso não confirma a conclusão do estorno.</Text>}
    {link && <Button href={link} style={styles.text}>{event === 'invite' ? 'Escolher como receber' : 'Consultar reembolso'}</Button>}
  </EmailLayout>;
}
export const template = { component: FinanceEmail, subject: (data) => `${titles[data.event] ?? 'Atualização de reembolso'} — Sevii Colecionáveis`, displayName: 'Saldo e reembolsos', previewData: { recipientName: 'Cliente', orderId: '12345678', amountCents: 5000, reason: 'Item indisponível', event: 'invite' } } satisfies TemplateEntry;