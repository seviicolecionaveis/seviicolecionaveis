// Busca da Pilha de Cartas (admin): regras puras e testáveis.
// Ignora acentos e maiúsculas/minúsculas; telefone compara só dígitos;
// nº da OS aceita com ou sem "#"; ID do pedido aceita completo ou parcial.

export interface PilhaSearchItem {
  card_name: string;
  order_id: string | null;
}

export interface PilhaSearchServiceOrder {
  id: string;
  code: number;
  customer_name: string | null;
  customer_email: string | null;
  phone: string | null;
  items: PilhaSearchItem[];
}

export interface PilhaSearchStack {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  items: PilhaSearchItem[];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function matchesId(id: string | null | undefined, query: string): boolean {
  if (!id) return false;
  const q = normalizeSearchText(query).replace(/-/g, "");
  if (!q) return false;
  return id.toLowerCase().replace(/-/g, "").includes(q);
}

function matchesPhone(phone: string | null | undefined, query: string): boolean {
  if (!phone) return false;
  const q = digitsOnly(query);
  if (q.length < 3) return false;
  return digitsOnly(phone).includes(q);
}

function matchesText(value: string | null | undefined, query: string): boolean {
  if (!value) return false;
  return normalizeSearchText(value).includes(query);
}

function matchesCode(code: number, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery).replace(/^#+/, "");
  if (!q || !/^\d+$/.test(q)) return false;
  return String(code).includes(q);
}

function matchesCommon(
  entry: { customer_name: string | null; customer_email: string | null; items: PilhaSearchItem[] },
  q: string,
): boolean {
  if (matchesText(entry.customer_name, q)) return true;
  if (matchesText(entry.customer_email, q)) return true;
  return entry.items.some((i) => matchesText(i.card_name, q) || matchesId(i.order_id, q));
}

export function serviceOrderMatchesSearch(o: PilhaSearchServiceOrder, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;
  if (matchesCode(o.code, rawQuery)) return true;
  if (matchesId(o.id, q)) return true;
  if (matchesPhone(o.phone, q)) return true;
  return matchesCommon(o, q);
}

export function stackMatchesSearch(s: PilhaSearchStack, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;
  if (matchesId(s.id, q)) return true;
  return matchesCommon(s, q);
}
