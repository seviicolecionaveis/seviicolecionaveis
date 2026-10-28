// Regras puras da etiqueta Superfrete (compartilhadas com testes).

// A Superfrete/Melhor Envio recusa valor segurado abaixo deste mínimo
// ("Valor segurado é abaixo do limite mínimo de R$ 25,63").
export const SUPERFRETE_MIN_INSURANCE_VALUE = 25.63;

/**
 * Valor segurado enviado no carrinho da Superfrete: o total do pedido,
 * elevado ao mínimo do provedor quando o pedido é mais barato.
 */
export function superfreteInsuranceValue(totalValue: number): number {
  return Math.max(totalValue, SUPERFRETE_MIN_INSURANCE_VALUE);
}
