# Programa de Pontos Sevii

## Regras escolhidas
- **Ganho:** R$ 1 = 10 pontos (sobre subtotal após descontos, em pedidos pagos)
- **Valor:** 100 pontos = R$ 5 de desconto (5% cashback efetivo)
- **Resgate:** desconto no checkout (mínimo 100 pontos, em múltiplos de 100)
- **Bônus:** 50 pontos no cadastro (boas-vindas) · 100 pontos no aniversário (1x por ano)
- **Validade:** sem expiração (podemos adicionar depois se quiser)

## O que será criado

### Banco
- Tabela `loyalty_points_ledger` (auditável; cada entrada é +/- pontos com motivo)
  - Campos: `user_id`, `delta` (int), `reason` (signup | birthday | order_earned | order_redeemed | admin_adjust | refund), `order_id` (nullable), `description`, `metadata`
- Função `user_points_balance(user_id)` — soma do ledger
- Função `award_signup_points()` — trigger que credita 50 pts ao criar profile
- Colunas em `orders`: `points_earned`, `points_redeemed`, `points_discount_cents`
- Job `pg_cron` diário às 09:00 → credita 100 pts para usuários aniversariantes (idempotente por ano)

### Backend (server functions)
- `getMyPointsBalance()` — saldo + últimas 20 transações
- `getPointsRedemptionPreview({ pointsToRedeem })` — valida e retorna desconto em centavos
- Em `markOrderPaid` (orders.server.ts):
  - Credita pontos ganhos com base no subtotal pago
  - Debita pontos resgatados do ledger (idempotente)
- Em `payments.server.ts` (`createOrder` etc.):
  - Aceita `pointsToRedeem` na entrada
  - Calcula `points_discount_cents` (aplica após cupom, antes do frete)
  - Bloqueia se saldo insuficiente
- Endpoint público `/api/public/cron/birthday-points` chamado por pg_cron

### UI
- **Checkout** (`/checkout`):
  - Campo "Usar pontos" abaixo do cupom: mostra saldo, slider/input em múltiplos de 100, preview de desconto
  - Linha no resumo: "Pontos (-R$ X,XX)"
- **Conta** (`/conta`):
  - Card "Seus pontos Sevii" com saldo grande + histórico recente + explicação das regras
- **Pedido pago** (`/orders/:id`):
  - Linha "Você ganhou X pontos com este pedido ⭐"
- **Admin de usuários** (`admin.users.tsx`):
  - Coluna saldo de pontos + botão "Ajustar" (motivo + delta) para correções manuais
- Email de confirmação de pagamento: incluir "Você ganhou X pontos" (extensão futura, opcional)

## Detalhes técnicos
- Aplicação de desconto na ordem: subtotal → bundle → cupom → pontos → frete → Pix
- Limites: resgate máximo = `min(saldo, subtotal_após_descontos)` arredondado para múltiplo de 100
- Idempotência: ledger usa `order_id + reason` único para `order_earned` / `order_redeemed`
- RLS: usuário vê só seu próprio ledger; admin vê tudo; insert só via funções `SECURITY DEFINER`
- Cron usa `apikey` header (anon key) padrão Lovable

## O que NÃO entra nesta primeira versão
- Catálogo de troca por produtos (você escolheu só desconto no checkout)
- Níveis/tiers (bronze/prata/ouro)
- Expiração de pontos
- Compartilhar pontos entre amigos

Posso implementar tudo isso em ~3 arquivos novos + 4 editados. Confirma para eu seguir?
