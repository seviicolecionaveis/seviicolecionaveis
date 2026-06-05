// Carta interna usada SOMENTE por administradores para reproduzir o fluxo
// de checkout/pagamento de ponta a ponta. Não deve aparecer no catálogo,
// busca, sitemap ou meta pública.

export const TEST_ADMIN_CARD_ID = "db9eacc0-07de-4829-bc5b-eb4b41e02329";
export const TEST_ADMIN_CARD_SLUG = "mew-151-000-000-test-admin";
export const TEST_ADMIN_CARD_NAME = "Test Admin";
export const TEST_ADMIN_CARD_COLLECTION = "MEW - 151";
export const TEST_ADMIN_CARD_NUMBER = "000/000";

export function isTestCardId(id: string | null | undefined): boolean {
  return id === TEST_ADMIN_CARD_ID;
}

/**
 * Verifica se um item agregado do catálogo (Card) corresponde ao cartão de teste.
 * Como o catálogo agrupa variantes (não usa o uuid bruto), comparamos por
 * nome + coleção + número.
 */
export function isTestCardCatalogEntry(c: {
  name: string;
  collection: string;
  number: string;
}): boolean {
  return (
    c.name === TEST_ADMIN_CARD_NAME &&
    c.collection === TEST_ADMIN_CARD_COLLECTION &&
    c.number === TEST_ADMIN_CARD_NUMBER
  );
}

/** Detecta se o carrinho contém EXCLUSIVAMENTE o item de teste admin. */
export function cartIsAllTestCard(items: Array<{ cardId: string }>): boolean {
  if (items.length === 0) return false;
  return items.every((i) => isTestCardId(i.cardId));
}
