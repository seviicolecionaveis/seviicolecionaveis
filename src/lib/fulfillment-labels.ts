// Nomes oficiais das modalidades de entrega/retirada — usar em TODAS as telas
// (admin, cliente, e-mails) para não divergir (ex.: selo "Retirada em mãos" vs
// texto "Retirada Presencial").

export type ServiceOrderMethodKey =
  | "correios"
  | "app"
  | "arte_em_cards"
  | "presencial"
  | "evento";

export const SERVICE_ORDER_METHOD_LABEL: Record<ServiceOrderMethodKey, string> = {
  correios: "Frete rastreado (Correios)",
  app: "Entrega em mãos",
  arte_em_cards: "Retirada na Arte em Cards",
  presencial: "Retirada em mãos",
  evento: "Retirada em eventos",
};

export function serviceOrderMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return (
    SERVICE_ORDER_METHOD_LABEL[method as ServiceOrderMethodKey] ?? method
  );
}

/** Descrição curta da modalidade para o cliente escolher (pilha/checkout). */
export const SERVICE_ORDER_METHOD_DESC: Record<ServiceOrderMethodKey, string> = {
  correios: "Cotação automática e cobrança do frete via Pix",
  app: "Somente Aracaju/SE — quintas-feiras a partir das 19h — taxa de R$ 15 via Pix",
  arte_em_cards: "Retire na loja parceira — taxa de R$ 5 ou código de ciclo",
  presencial: "Segunda a sexta, 14h às 19h — gratuito",
  evento: "Retire no evento que você vai comparecer — gratuito",
};
