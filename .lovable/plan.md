## Objetivo
1. Permitir editar todos os campos de um cupom/vale-presente e aumentar o limite de usos para reativar cupons já consumidos.
2. Transformar vale-presente em **carteira**: o cliente usa quantas vezes quiser até o saldo zerar.

## Banco

**Migração `coupons`**:
- Adicionar coluna `balance_cents integer null` (saldo restante; usado apenas para vale-presente carteira).
- Backfill: para cupons existentes com `user_id IS NOT NULL` e `amount_cents > 0`, definir `balance_cents = amount_cents - (used_count > 0 ? amount_cents : 0)` (cupons já usados ficam zerados; não usados ficam com saldo total).
- Nenhuma mudança em RLS — políticas atuais continuam.

## Backend

**`src/utils/coupons.server.ts`**
- `updateCouponServer(userId, couponId, patch)`: atualiza `code`, `percent`, `amount_cents`, `max_uses`, `expires_at`, `notes`, `active`. Verifica unicidade de `code` se mudou. Para vale-presente, se `amount_cents` foi alterado, ajusta `balance_cents` proporcionalmente (admin pode também passar `balance_cents` diretamente).
- `incrementCouponMaxUsesServer(userId, couponId, delta)`: `max_uses = max_uses + delta` e `active = true`.

**`src/utils/coupons.functions.ts`**
- Expor `updateCoupon` e `incrementCouponMaxUses` como server fns (Zod validado).

**`src/utils/payments.server.ts` — `validateCoupon` + `previewCouponServer`**
- Detectar vale-presente carteira: `coupon.user_id !== null && coupon.amount_cents > 0`.
- Para carteira:
  - Ignorar `max_uses` / `used_count`.
  - Validar `balance_cents > 0`.
  - `discountCents = min(balance_cents, subtotalCents)`.
  - Update atômico: `update coupons set balance_cents = balance_cents - discountCents where id = X and balance_cents >= discountCents`. Se 0 linhas, erro de concorrência.
- Demais cupons: comportamento atual.

## Admin UI (`src/routes/admin.coupons.tsx`)

Na tabela de cupons, ao lado das ações já existentes (Copiar, Reenviar, Ativar/Desativar, Prévia):
- **Botão "Editar"** abre modal com todos os campos: código, tipo (percentual/valor), valor, máx. usos (oculto para vale-presente carteira), validade, notas, ativo. Para vale-presente carteira, mostra também **Saldo (R$)** com input para ajustar diretamente.
- **Botão "+ usos"** prompt simples para somar N ao `max_uses` (atalho rápido para "reativar utilizado"). Esconder em vale-presente carteira.
- Mostrar **Saldo: R$ X,XX / R$ Y,YY** na linha da carteira em vez de `used/max`.

Sem alterações em outros fluxos.

## Verificação
- Editar cupom de divulgação muda código e valor; novo código rejeita duplicidade.
- "+ usos" em cupom esgotado torna utilizável novamente.
- Vale-presente novo: criar com R$ 100; usar R$ 30 → saldo R$ 70; usar mais R$ 70 → saldo 0; próxima tentativa falha "Saldo esgotado".
- Vouchers antigos (amount_cents, max_uses=1) continuam funcionando como antes (não viram carteira automaticamente; admin pode editar para definir balance e habilitar carteira).