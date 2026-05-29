# Emitir cupom único de 5% para o cliente do pedido #fe9f83bd

Hoje os cupons (`POKEAGIOTAGEM`, `PRIMEIRACOMPRA10`) são fixos no código (`src/utils/payments.server.ts`). Não existe tabela de cupons no banco, então não há como emitir um código pessoal de uso único sem criar essa estrutura.

Cliente identificado: `hugoberg.paypal@gmail.com` (user_id `089e6719-7735-4b21-94cd-1248fb6b87d4`).

## Etapas

### 1. Criar tabela `coupons` (migration)
Campos:
- `code` (texto, único, maiúsculo) — o código que o cliente digita
- `user_id` (uuid, opcional) — quando preenchido, só esse usuário pode usar
- `percent` (int) — percentual de desconto
- `max_discount_cents` (int, opcional) — teto de desconto
- `max_uses` (int, default 1) — quantos usos no total
- `used_count` (int, default 0)
- `expires_at` (timestamp, opcional)
- `active` (bool, default true)

RLS: só admins gerenciam; leitura via função `SECURITY DEFINER` chamada pelo servidor.

### 2. Atualizar `validateCoupon` em `src/utils/payments.server.ts`
Depois de checar os dois cupons fixos existentes, fazer fallback para uma busca em `coupons` pelo código informado. Validar:
- existe, está ativo, não expirou
- `used_count < max_uses`
- se `user_id` está setado, deve bater com o usuário atual
- aplicar desconto respeitando `max_discount_cents`

Quando o pedido é pago (em `markOrderPaid`/equivalente, ou no insert do pedido com cupom), incrementar `used_count`. Para manter o escopo pequeno, faço o incremento no momento em que o pedido é criado com `coupon_code` (igual ao fluxo atual, antes do pagamento) — isso já bloqueia segundo uso. Posso ajustar para incrementar só em "paid" se preferir.

### 3. Inserir o cupom para o cliente
Algo como:
```
INSERT INTO coupons (code, user_id, percent, max_uses, active)
VALUES ('DESCULPA5-XXXX', '089e6719-...', 5, 1, true);
```

## Pontos a confirmar

1. **Código do cupom**: prefere algum nome específico (ex: `DESCULPA5`, `VOLTASEVII5`) ou gero um aleatório tipo `SEVII-5OFF-A7K2`?
2. **Validade**: quer prazo de validade (ex: 60 dias) ou sem expiração?
3. **Teto de desconto**: aplicar 5% sem limite, ou colocar um teto (ex: até R$ 30)?
4. **Incremento de uso**: trava no momento da criação do pedido (mesmo se não pagar) ou só quando o pedido for marcado como pago? A primeira é mais simples; a segunda evita "queimar" o cupom se o cliente desistir.
