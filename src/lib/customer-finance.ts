export const REFUND_LINK_DAYS = 7;
export const REFUND_LABELS: Record<string, string> = {
  awaiting_choice: 'Aguardando escolha', credited: 'Saldo creditado', awaiting_approval: 'Aguardando aprovação',
  approved: 'Aprovado para reembolso', processing: 'Em processamento', refunded: 'Reembolsado',
  declined: 'Recusado', revoked: 'Revogado', failed: 'Falha no processamento', review: 'Requer conciliação', expired: 'Expirado',
};
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function creditAllocation(total: number, available: number, requested: number) {
  if (![total, available, requested].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Valor inválido.');
  if (requested > available || requested > total) throw new Error('Saldo solicitado indisponível.');
  return { creditCents: requested, providerCents: total - requested };
}
export function confirmedRefund(result: { id: number | string; amount: number; status: string }, expected: number) {
  return expected > 0 && Number.isSafeInteger(expected) && String(result.id).length > 0 &&
    Math.round(result.amount * 100) === expected && result.status === 'approved';
}
export function validateRefundAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Reembolso deve ser positivo em centavos.');
}
export function originalAllocation(amount: number, total: number, credit: number, remainingCredit: number, remainingExternal: number) {
  validateRefundAmount(amount);
  if (total <= 0 || credit < 0 || credit > total || amount > remainingCredit + remainingExternal) throw new Error('Limite de reembolso excedido.');
  let c = Math.min(remainingCredit, Math.round(amount * credit / total));
  let e = amount - c;
  if (e > remainingExternal) { c += e - remainingExternal; e = remainingExternal; }
  if (c > remainingCredit) throw new Error('Parcela original indisponível.');
  return { creditCents: c, providerCents: e };
}