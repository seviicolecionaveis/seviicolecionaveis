/**
 * Cartas em promoção que NÃO aceitam nenhum desconto adicional
 * (pontos, cupons — inclusive de primeira compra — nem desconto Pix).
 */
const NO_DISCOUNT_CARDS: ReadonlyArray<{ name: string; number: string; finish: string }> = [
  { name: "mega greninja ex", number: "122/086", finish: "illustration rare" },
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function isNoDiscountItem(item: {
  name: string;
  number?: string | null;
  finish: string;
}): boolean {
  return NO_DISCOUNT_CARDS.some(
    (c) => norm(item.name) === c.name && norm(item.number) === c.number && norm(item.finish) === c.finish,
  );
}

/** Subtotal (centavos) dos itens que não aceitam desconto. unitPrice em reais. */
export function noDiscountSubtotalCents(
  items: ReadonlyArray<{ name: string; number?: string | null; finish: string; unitPrice: number; quantity: number }>,
): number {
  return items.reduce(
    (s, i) => s + (isNoDiscountItem(i) ? Math.round(i.unitPrice * 100) * i.quantity : 0),
    0,
  );
}
