// Loyalty / Programa de Pontos Sevii — constantes e helpers puros (isomórficos).

export const POINTS_PER_REAL = 10;          // R$ 1 = 10 pontos
export const POINTS_PER_REDEEM_BLOCK = 100; // múltiplos de 100 pontos
export const CENTS_PER_REDEEM_BLOCK = 500;  // 100 pontos = R$ 5,00
export const MIN_REDEEM_POINTS = 100;
export const SIGNUP_BONUS_POINTS = 50;
export const BIRTHDAY_BONUS_POINTS = 100;

/** Pontos ganhos em um pedido pago (base = subtotal − descontos, em centavos). */
export function pointsEarnedFromCents(baseAfterDiscountCents: number): number {
  if (!baseAfterDiscountCents || baseAfterDiscountCents <= 0) return 0;
  // R$ 1 = 10 pts → 100 centavos = 10 pts → centavos/10 = pts
  return Math.floor(baseAfterDiscountCents / 10);
}

/** Converte pontos resgatados em desconto (centavos). */
export function pointsToDiscountCents(points: number): number {
  if (!points || points <= 0) return 0;
  const blocks = Math.floor(points / POINTS_PER_REDEEM_BLOCK);
  return blocks * CENTS_PER_REDEEM_BLOCK;
}

/** Normaliza pontos para múltiplos válidos, respeitando saldo e teto. */
export function normalizeRedeemPoints(
  desired: number,
  balance: number,
  maxDiscountableCents: number,
): number {
  if (!desired || desired < MIN_REDEEM_POINTS) return 0;
  const maxByCents = Math.floor(maxDiscountableCents / CENTS_PER_REDEEM_BLOCK) * POINTS_PER_REDEEM_BLOCK;
  const cap = Math.min(balance, maxByCents);
  if (cap < MIN_REDEEM_POINTS) return 0;
  const blocks = Math.floor(Math.min(desired, cap) / POINTS_PER_REDEEM_BLOCK);
  return blocks * POINTS_PER_REDEEM_BLOCK;
}

export function formatPoints(n: number): string {
  return n.toLocaleString("pt-BR");
}

export type LoyaltyReason =
  | "signup"
  | "birthday"
  | "order_earned"
  | "order_redeemed"
  | "admin_adjust"
  | "refund";

export const REASON_LABEL: Record<LoyaltyReason, string> = {
  signup: "Bônus de boas-vindas",
  birthday: "Bônus de aniversário",
  order_earned: "Pontos do pedido",
  order_redeemed: "Resgate em pedido",
  admin_adjust: "Ajuste manual",
  refund: "Estorno",
};
