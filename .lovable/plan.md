# Retirada na Arte em Cards — taxa semanal com código

## Conceito

Nova modalidade de entrega no checkout. Cobra R$ 5,00 uma vez por **ciclo semanal fixo** (sexta 12:00 → próxima sexta 11:59). Após pagamento, o cliente recebe um código pessoal que isenta a taxa em compras posteriores **dentro do mesmo ciclo**.

## Banco de dados (migration)

Nova tabela `arte_em_cards_codes`:
- `id` uuid PK
- `user_id` uuid (dono do código)
- `code` text único (formato `AEC-XXXXXX`)
- `cycle_start` timestamptz (sexta 12:00 do ciclo)
- `cycle_end` timestamptz (próxima sexta 11:59:59)
- `created_at`, `updated_at`

Constraints/índices:
- Unique parcial em `(user_id, cycle_start)` — garante um código por cliente por ciclo
- Index em `code`, em `(user_id, cycle_end)`
- RLS: cliente vê apenas o próprio; admins veem tudo
- GRANTs para `authenticated` e `service_role`

Função SQL `current_cycle_bounds()` que retorna `(cycle_start, cycle_end)` baseado em `now()` em horário de São Paulo (-03), para usar nas validações server-side.

## Server functions (`src/lib/arte-em-cards.functions.ts`)

- `validateArteEmCardsCode({ code })` — middleware auth. Verifica:
  - código existe
  - pertence ao `userId` logado
  - `now()` entre `cycle_start` e `cycle_end`
  - retorna `{ valid: true, expiresAt }` ou `{ valid: false, reason }`
- `getMyArteEmCardsCode()` — retorna código ativo do usuário no ciclo atual (se houver) + `cycle_end`.

## Lógica de geração (`src/lib/arte-em-cards.server.ts`)

Helper `ensureCodeForUser(userId)`:
1. Calcula ciclo atual (sexta 12:00 SP).
2. Busca código do user com `cycle_start = ciclo_atual`.
3. Se existir, retorna.
4. Senão cria novo com `code = "AEC-" + 8 chars aleatórios`.

Chamado a partir de `markOrderPaid` em `src/lib/orders.server.ts`: **se** o pedido foi pago com modalidade `arte_em_cards` **e** o pedido cobrou a taxa (i.e. não usou código pré-existente), gerar/garantir código para o `user_id` do pedido e armazenar em `order.notes` (ou novo campo) para exibir no recibo.

## Checkout (`src/routes/checkout.tsx`)

Adicionar 4ª opção de envio: **Retirada na Arte em Cards** (paralela a Frete / Retirada em mãos / Entrega por app). Quando selecionada:
- Mostra campo opcional "Código Arte em Cards"
- Botão "Validar código" chama `validateArteEmCardsCode`
- Se válido: badge verde com data de expiração, taxa = R$ 0,00
- Se inválido/expirado/de outro cliente: erro vermelho, taxa = R$ 5,00
- Se sem código: aviso "Será cobrada taxa de R$ 5,00 e você receberá um código válido até [próxima sexta 11:59]"

Passa para o servidor: `shippingMethod: "arte_em_cards"`, `arteEmCardsCode?: string`.

## Validação server-side de preço (`src/utils/payments.server.ts` + schemas)

Adicionar `arte_em_cards` ao enum `shippingMethod` em `payments.schemas.ts`. Adicionar campo opcional `arteEmCardsCode`.

No cálculo do `shipping_cost_cents`:
- Se `shippingMethod === "arte_em_cards"`:
  - Se `arteEmCardsCode` válido para o `userId` no ciclo atual → 0
  - Senão → 500 (R$ 5,00)
- Persistir na `orders` o método e (se aplicável) `arte_em_cards_code_used`.

Após `markOrderPaid`, se método = `arte_em_cards` e taxa = 500, chamar `ensureCodeForUser`.

## Área do cliente (`src/routes/conta.tsx`)

Nova aba "Arte em Cards" (ou card dentro de "Atalhos"):
- Componente `ArteEmCardsCard` que chama `getMyArteEmCardsCode`
- Mostra: código (copiável), Status (Ativo/Expirado), expiração formatada, aviso "Válido até próxima sexta 11:59"
- Estado vazio: "Você ainda não tem um código deste ciclo. Faça uma compra com Retirada na Arte em Cards."

## Exibição no pedido (`src/routes/orders.$orderId.tsx`)

Quando `shipping_method === "arte_em_cards"`:
- Mostrar bloco com endereço da loja e horários
- Se taxa cobrada: exibir o código gerado + validade
- Se código usado: exibir "Código usado: AEC-XXXX (válido até …)"

## Painel admin

`src/routes/admin.shipping.tsx` (ou onde os pedidos aparecem): adicionar label "Arte em Cards" e mostrar código usado/gerado para facilitar conferência presencial.

## Arquivos a criar/editar

**Migration:** `supabase/migrations/<timestamp>_arte_em_cards_codes.sql`

**Novos:**
- `src/lib/arte-em-cards.server.ts`
- `src/lib/arte-em-cards.functions.ts`
- `src/components/account/ArteEmCardsCard.tsx`

**Editados:**
- `src/lib/orders.server.ts` (gerar código após pagamento)
- `src/utils/payments.schemas.ts` (enum + campo)
- `src/utils/payments.server.ts` (cálculo da taxa)
- `src/routes/checkout.tsx` (UI + validação)
- `src/routes/conta.tsx` (aba/card)
- `src/routes/orders.$orderId.tsx` (exibição do código)
- `src/routes/admin.shipping.tsx` (label + código)

## Notas técnicas

- Cálculo da "sexta 12:00 SP": usar `date-fns-tz` (já no projeto? checar) ou cálculo manual com offset -03 fixo, evitando lib pesada.
- Endereço físico da loja Arte em Cards: **precisa ser confirmado pelo cliente** — usarei placeholder "Arte em Cards (endereço a confirmar)" e perguntarei após este plano ser aprovado.
- Código gerado com `crypto.randomBytes` no server; colisões tratadas com retry (until insert succeed via unique constraint).

Aguardo aprovação para implementar.