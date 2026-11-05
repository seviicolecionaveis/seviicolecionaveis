// Desconto de Pix em pedidos de leilão: 3% para Pix gerado até 23h59
// (horário de Fortaleza, UTC-3 sem horário de verão) do dia do encerramento.
export const AUCTION_PIX_DISCOUNT_PERCENT = 3;
const FORTALEZA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Último instante (exclusivo) válido: meia-noite de Fortaleza após o encerramento. */
export function auctionPixDeadline(auctionEnd: Date): Date {
  const local = new Date(auctionEnd.getTime() - FORTALEZA_OFFSET_MS);
  const nextMidnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  return new Date(nextMidnightLocal + FORTALEZA_OFFSET_MS);
}

export function auctionPixDiscountEligible(auctionEnd: Date | null, now: Date): boolean {
  if (!auctionEnd) return false;
  return now.getTime() < auctionPixDeadline(auctionEnd).getTime();
}

/** Desconto sobre o valor das cartas já com outros descontos (sem frete). */
export function computeAuctionPixDiscountCents(subtotalCents: number, otherDiscountCents: number): number {
  const base = Math.max(0, subtotalCents - otherDiscountCents);
  return Math.round((base * AUCTION_PIX_DISCOUNT_PERCENT) / 100);
}
