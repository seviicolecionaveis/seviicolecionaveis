## Problema

Ao finalizar a compra com um acessório (ex.: "Shield Evoluções Prismáticas"), o servidor cai em `resolveCardIds` e tenta consultar a tabela `cards` com `finish = "Sleeves/Shields"`. Como `cards.finish` é o enum `card_finish` (Normal, Foil, Reverse Foil, etc.), o Postgres responde:

> invalid input value for enum card_finish: "Sleeves/Shields"

O acessório é adicionado ao carrinho com `cardId = "accessory:<uuid>"` (ver `AccessoryModal.tsx`), mas `payments.server.ts` só conhece os prefixos `panel:` e `sealed:` — não existe ramo para `accessory:`, então o item escorrega para a consulta de cartas e quebra.

A mesma lacuna existe nas três funções de pagamento (Stripe, Pix e Cartão MP) e no decremento de estoque pós-pagamento.

## Correção

### 1. `src/utils/payments.server.ts`
- Adicionar helper `isAccessoryItem(it)` (prefixo `accessory:`).
- Em `resolveCardIds`: novo ramo antes da consulta a `cards` — buscar `accessories` (`price_cents`, `active`) pelo id; validar ativo e preço; empurrar item com `unitPrice` calculado pelo servidor (mesma regra autoritativa usada para painéis/selados).
- Em `ensureAvailableStock`: novo ramo lendo `accessories.stock` e abortando com a mesma mensagem de "Estoque insuficiente".
- Não alterar os campos enviados a `order_items` (a coluna `finish` é `text`, então "Sleeves/Shields" é gravado sem problema).

### 2. `src/lib/orders.server.ts` (`markOrderPaid`)
- Após os blocos de `panel:` e `sealed:`, adicionar bloco análogo para `accessory:` que decrementa `accessories.stock` (com `Math.max(0, ...)`).

### 3. Regra de desconto
- Manter como está hoje: o desconto Pix de 5% e cupons continuam incidindo sobre o subtotal geral (acessórios incluídos). O usuário só pediu para não dar 5% sobre o item fixo de R$ 5 da pilha de cartas — acessórios não fazem parte daquela exceção.

### Fora de escopo
- Nenhuma mudança de schema (a coluna `order_items.finish` já é `text`; o enum `card_finish` permanece como está).
- Nenhuma mudança no carrinho/UI dos acessórios.

## Verificação
- Refazer o checkout com 1 sleeve + cartas no carrinho nas três formas de pagamento (Pix, cartão, retorno do Mercado Pago) e confirmar:
  - criação do pedido sem erro de enum;
  - `order_items` gravado com `finish = "Sleeves/Shields"`;
  - estoque do acessório decrementado após pagamento confirmado.
