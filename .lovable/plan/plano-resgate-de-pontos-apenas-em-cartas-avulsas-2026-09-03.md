# Plano: Resgate de pontos apenas em cartas avulsas

## Regra de negócio

- Pontos podem ser **resgatados** (usados como desconto) somente sobre **cartas avulsas**.
- **Produtos lacrados, acessórios, videogames e painéis não aceitam resgate de pontos** — o valor deles nunca é coberto por pontos.
- Esses produtos **continuam acumulando pontos** normalmente (a regra de ganho já considera o subtotal inteiro — nada muda no acúmulo).

## Como funciona hoje

- O teto de resgate é calculado como `subtotal − combo − cupom`, ou seja, inclui lacrados/acessórios/videogames. Isso acontece em dois lugares:
  - `src/routes/checkout.tsx` (linha ~352): `pointsMaxDiscountableCents` — controla o slider/valor exibido ao cliente.
  - `src/utils/payments.server.ts`: `pointsBase` nos 3 fluxos de pagamento (Stripe ~745, Mercado Pago ~901, Pix ~1096) — validação autoritativa no servidor.
- Itens não-carta já são identificados pelo prefixo do `cardId`: `sealed:`, `accessory:`, `videogame:`, `panel:`.

## Alterações

1. **Subtotal de cartas avulsas**
   - Helper compartilhado em `src/lib/loyalty.ts`: `singlesSubtotalCents(items)` soma apenas itens cujo `cardId` é UUID (exclui `sealed:`, `accessory:`, `videogame:`, `panel:`).

2. **Checkout (cliente)** — `src/routes/checkout.tsx`
   - `pointsMaxDiscountableCents = min(base atual, subtotal de cartas avulsas)`.
   - Se o carrinho tiver só produtos não-carta, o campo de resgate de pontos fica desabilitado/oculto com aviso: "Pontos podem ser resgatados apenas em cartas avulsas."
   - Texto de ajuda junto ao campo de resgate informando a regra.

3. **Servidor (validação)** — `src/utils/payments.server.ts`
   - Nos 3 fluxos (Stripe, Mercado Pago, Pix): `pointsBase = min(base atual, singlesSubtotalCents(items))` antes de `resolvePointsRedemption`.
   - Garante que mesmo com manipulação do front, o desconto por pontos nunca excede o valor das cartas avulsas do pedido.

4. **Sem alteração em**:
   - Acúmulo de pontos (`applyLoyaltyForOrder` continua usando o subtotal completo).
   - Cupons, Pix e combos (regras inalteradas).
   - Pedidos já existentes.

## Verificação

- Build + typecheck.
- Teste manual no preview: carrinho misto (carta + lacrado) mostra teto de pontos limitado ao valor da carta; carrinho só com lacrado não permite resgate; ambos acumulam pontos após pagamento.
