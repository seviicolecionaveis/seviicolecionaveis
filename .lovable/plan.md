
## Objetivo

1. Tornar o card **Test Admin** (`MEW - 151 / 000/000`, id `db9eacc0-...`) visível **somente para administradores** em todo o site.
2. Adicionar um método de pagamento extra no checkout — **"Aprovação Admin (teste)"** — que aparece **apenas quando**: (a) usuário é admin **e** (b) o carrinho contém **somente** o card de teste. Esse método cria o pedido já como `paid` sem cobrar nada, percorrendo todo o fluxo pós-pagamento (decremento de estoque, e-mail de confirmação, etiqueta Superfrete/pilha conforme o método de envio, pesquisa pós-compra, etc.) para reproduzir bugs.

## Identificador do card de teste

Constante única no código: `TEST_ADMIN_CARD_ID = "db9eacc0-07de-4829-bc5b-eb4b41e02329"`, exportada de `src/lib/test-card.ts` e usada por client e server. Critério para detectar carrinho de teste: todos os itens com `cardId === TEST_ADMIN_CARD_ID`.

## Mudanças

### 1. Ocultar o card para não-admins

- Criar `src/lib/test-card.ts` exportando a constante e helpers `isTestCardId(id)` / `cartIsAllTestCard(items)`.
- Em `useCardsCatalog` (hook que alimenta o catálogo): filtrar fora o card de teste quando `!isAdmin` (já existe `useAuth().isAdmin`). Isso esconde de cartas/coleção/busca/relacionados/novidades.
- Em `src/routes/carta.$slug.tsx`: se o slug resolver para o card de teste e o usuário **não** for admin, renderizar o `notFoundComponent` (404). Se admin, mostrar normalmente com badge "Somente admin".
- Em `getCardMetaBySlug` (server, para SSR/OG): retornar `notFound` quando for o card de teste — assim links compartilhados não vazam meta para anônimos. Não há perda real porque o card é interno.
- `sitemap.server.ts`: excluir o card de teste da geração do sitemap.

### 2. Novo método de pagamento "admin_test"

#### Schema/validação (server)
- `src/utils/payments.schemas.ts`: adicionar um novo schema `AdminTestInputSchema` (mesmos campos de Pix sem `card`/`couponCode`/Pix-específicos relevantes), reaproveitando `items`, `shippingMethod`, `shippingQuote`, `address`, `notes`, `arteEmCardsCode`.

#### Server function (nova)
- `src/utils/payments.functions.ts`: nova `createAdminTestOrder` com `requireSupabaseAuth` que:
  1. Verifica `has_role(userId, 'admin')` — se não for admin, lança erro.
  2. Valida que **todos** os itens têm `cardId === TEST_ADMIN_CARD_ID` (impede uso indevido).
  3. Reaproveita a pipeline existente de `payments.server.ts` (resolveCardIds, ensureAvailableStock, cálculo de frete, criação de pedido em `orders` com `payment_method = 'admin_test'`, status `pending`, reservation de estoque).
  4. Imediatamente chama `markOrderPaid(orderId)` — isso já cuida de: decrementar estoque, apagar reservation, marcar `paid`, enviar e-mail `payment-confirmed`, e disparar `purchaseShippingLabel` ou `addOrderToStack` conforme o `shipping_method`. **Nenhum** valor é cobrado em Stripe/MercadoPago.
  5. Retorna `{ orderId }` para o checkout redirecionar a `/checkout/return?orderId=...` (mesmo fluxo de retorno do Stripe).

#### Checkout UI
- `src/routes/checkout.tsx`:
  - Ler `isAdmin` do `useAuth`.
  - Calcular `isAdminTestCart = isAdmin && items.length > 0 && items.every(i => i.cardId === TEST_ADMIN_CARD_ID)`.
  - Quando `isAdminTestCart`, renderizar uma terceira opção de pagamento "Aprovação Admin (teste — sem cobrança)" abaixo de Pix e Cartão, com aviso visual ("Modo teste: o pedido será marcado como pago sem cobrança real").
  - Ao confirmar com esse método, chamar `createAdminTestOrder` e navegar para `/checkout/return?orderId=...`.
  - Mantém validação normal de endereço/frete (o objetivo é reproduzir o fluxo completo).
- Esconder/ocultar o método se a condição deixar de ser verdadeira (ex: usuário adiciona outro card → some).

### 3. Segurança

- Servidor é a fonte da verdade: a server fn nunca confia em flag do cliente. Re-checa `has_role` e re-valida o conteúdo do carrinho.
- O card mantém `stock > 0` para permitir o fluxo (decrementa a cada teste; admin reabastece manualmente quando precisar).
- Nenhum cupom, nenhum desconto: o cálculo de total fica 0 + frete (frete real do Superfrete também é 0 quando é cliente de teste? **decisão:** se `shipping_method === 'fixed'` com Superfrete, ainda compra etiqueta normalmente — esse é o ponto, replicar bugs. Se admin quiser pular, escolhe `card_stack` ou `arrange`).

## Verificação manual após implementar

1. Logado como não-admin: acessar `/carta/mew-151-000-000-test-admin` → 404. Buscar "Test Admin" no catálogo → não aparece.
2. Logado como admin: card visível, é possível adicionar ao carrinho.
3. Carrinho só com Test Admin + admin: aparece opção "Aprovação Admin". Carrinho misto: some.
4. Confirmar com "Aprovação Admin" → pedido criado em `orders` com `payment_method='admin_test'`, status `paid`, estoque decrementado, e-mail enviado, etiqueta Superfrete tentada (ou item adicionado à pilha conforme o `shipping_method`), redireciona para `/checkout/return`.
5. Não-admin que tente chamar a server fn por fora recebe erro.
