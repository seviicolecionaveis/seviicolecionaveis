/** Regras puras de conferência do carrinho contra o estoque vendável atual. */
export interface CartStockRow { id: string; stock: number | null; event_reserved?: number | null }
export interface CartLine { id: string; cardId: string; quantity: number }

/** Estoque vendável = estoque − unidades levadas a eventos (nunca negativo). */
export function sellableStock(row: CartStockRow | undefined): number {
  if (!row) return 0;
  return Math.max(0, Number(row.stock ?? 0) - Number(row.event_reserved ?? 0));
}

/** Itens cuja quantidade no carrinho excede o disponível, somando linhas da mesma carta. */
export function findCartShortages<T extends CartLine>(items: T[], rows: CartStockRow[]): { item: T; available: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const remaining = new Map<string, number>();
  const out: { item: T; available: number }[] = [];
  for (const it of items) {
    if (!remaining.has(it.cardId)) remaining.set(it.cardId, sellableStock(byId.get(it.cardId)));
    const left = remaining.get(it.cardId) ?? 0;
    if (left < it.quantity) out.push({ item: it, available: left });
    remaining.set(it.cardId, Math.max(0, left - it.quantity));
  }
  return out;
}
