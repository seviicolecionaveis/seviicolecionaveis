// Regra de formas de pagamento por origem do pedido.
// Pedidos de leilão (origin 'auction' ou auction_id preenchido) aceitam apenas Pix.

export const AUCTION_CARD_PAYMENT_ENABLED = false;

export const AUCTION_CARD_DISABLED_MESSAGE =
  "Cartão de crédito não está disponível para pedidos de leilão. Use o Pix.";

export function auctionOrder(
  origin: string | null | undefined,
  auctionId: string | null | undefined,
): boolean {
  return origin === "auction" || !!auctionId;
}

export function cardPaymentAllowedForOrder(
  origin: string | null | undefined,
  auctionId: string | null | undefined,
): boolean {
  if (AUCTION_CARD_PAYMENT_ENABLED) return true;
  return !auctionOrder(origin, auctionId);
}
