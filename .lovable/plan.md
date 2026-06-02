# Pilha de Cartas

Funcionalidade grande, vou dividir em fases para entregar de forma incremental.

## Resumo do funcionamento

- No checkout, nova opção de "envio": **Pilha de Cartas** (gratuita).
- Ao pagar o 1º pedido com essa opção, abre-se uma **pilha** para o cliente com prazo de **30 dias** (contados desde o 1º pedido — não reinicia).
- Pedidos seguintes com Pilha de Cartas entram na mesma pilha ativa.
- Cliente vê nova página **"Pilha de Cartas"** na conta, com contagem regressiva, lista de cartas e checkboxes.
- Cliente seleciona cartas → "Solicitar Retirada / Envio" → mini-checkout que reaproveita os 3 métodos existentes (Correios, Aplicativo de entrega, Arte em Cards R$5). Sem reexibir a opção Pilha de Cartas.
- Cada solicitação gera uma **Ordem de Serviço (OS)** com status próprios.
- Admin tem nova página "Ordens de Serviço da Pilha de Cartas" + notificações por e-mail.
- E-mails automáticos ao cliente em 7 dias, 48 h e 24 h antes do vencimento.

## Modelo de dados (nova migração)

- `card_stacks`: `id`, `user_id` (unique-por-ativa), `started_at`, `expires_at` (= started_at + 30d), `status` (`active` | `closed` | `expired`), timestamps.
- `card_stack_items`: `id`, `stack_id`, `order_id`, `order_item_id`, `card_id`, snapshot (nome/imagem/coleção/número/finish/quantity), `status` (`stored` | `requested` | `dispatched` | `cancelled`), `service_order_id` nullable.
- `service_orders`: `id`, `code` (sequencial visível), `user_id`, `stack_id`, `method` (`correios` | `app` | `arte_em_cards`), `status` (`awaiting_payment`, `paid`, `picking`, `ready`, `shipped`, `delivered`, `cancelled`), `amount_cents`, `order_id` nullable (pedido de pagamento associado), endereço, timestamps.
- `service_order_items`: vincula `service_order_id` ↔ `card_stack_item_id`.
- Notificações: campo `last_reminder_sent_at` + flags por marco (7d/48h/24h) na `card_stacks`.
- RLS: cliente só vê suas pilhas/itens/OS; admin vê tudo.

## Backend (server functions + cron)

- `stack.functions.ts`: `getMyStack`, `requestServiceOrder({itemIds, method, shippingAddress})`, `cancelStackItem`.
- Reaproveitar `payments.server.ts`: novo fluxo paralelo `createServiceOrderCheckout` que cria pagamento Pix/Cartão sem decrementar estoque (cartas já são do cliente). Estoque NÃO é alterado nas OS.
- Hook em `markOrderPaid` (orders.server.ts): se `shipping_method === "card_stack"` → criar pilha (se não existir ativa) e mover items para `card_stack_items` em vez de despachar.
- Hook em pagamento de OS: ao confirmar pagamento, marca `service_orders.status = paid`, marca itens como `dispatched`, dispara compra de etiqueta (no método Correios) e e-mail admin.
- Cron diário (`/api/public/hooks/stack-reminders`): envia e-mails de 7d/48h/24h e expira pilhas vencidas.
- Templates de e-mail novos: `stack-reminder` (cliente) e `service-order-created` (admin).

## Frontend

- **Checkout** (`src/routes/checkout.tsx`): nova opção de envio "Pilha de Cartas" (frete R$ 0, sem cálculo de frete). Tooltip/popup explicativo (igual ao da Arte em Cards) com termos (30 dias, e-mails de aviso, custo de envio na hora da retirada).
- **Conta**: adicionar item "Pilha de Cartas" no painel `/conta` (atalhos) e nova rota `/_authenticated/pilha.tsx`:
  - Cabeçalho: data início, vencimento, **contador regressivo em tempo real**, totais.
  - Tabela/grid de cartas com foto, nome, pedido, data, qtd, checkbox.
  - Botão "Solicitar Retirada / Envio" → modal/rota `/pilha/solicitar` que reproduz layout do checkout (sem opção Pilha).
  - Após método "Aplicativo de entrega": tela final com botão **WhatsApp** pré-preenchido (`https://wa.me/<numero>?text=...`).
- **Admin**: nova rota `/admin/service-orders` (lista + filtros + detalhes + mudança de status). Sino `AdminCancellationBell` ganha contador de OS novas.

## Fases de entrega

1. **Fase 1 — Fundação**: migração (`card_stacks`, `card_stack_items`, `service_orders`, `service_order_items`, RLS, grants), opção "Pilha de Cartas" no checkout, hook no `markOrderPaid` para criar pilha e mover itens, página `/conta` → "Pilha de Cartas" só leitura com contador.
2. **Fase 2 — Solicitação de OS**: server fns + UI de "Solicitar Retirada/Envio" reaproveitando os 3 métodos, geração de OS, pagamento (Correios/Arte em Cards) e fluxo WhatsApp (Aplicativo).
3. **Fase 3 — Admin + notificações**: página admin de OS, e-mail para admin ao criar OS, sino com contador.
4. **Fase 4 — Cron de avisos**: template `stack-reminder`, endpoint `/api/public/hooks/stack-reminders`, agendamento pg_cron diário, expiração automática.

## Considerações

- Estoque: itens da pilha já foram pagos no pedido original → OS NÃO mexem em `cards.stock`.
- Reembolsos/cancelamento de pedido original: ao cancelar pedido com itens na pilha, remover os `card_stack_items` correspondentes e devolver estoque (mesma lógica de `order-cancellation.server.ts`).
- Número da loja para WhatsApp: usar variável já existente ou pedir secret `STORE_WHATSAPP_NUMBER` na Fase 2.

## Confirmação antes de começar

Esta é uma feature grande (4 fases, ~15-20 arquivos novos, 1 migração, 1 cron, 2 templates de e-mail). Posso:

**(A)** Começar pela **Fase 1** agora (migração + checkout + página de leitura da pilha) e seguir nas próximas mensagens conforme você aprovar cada fase.

**(B)** Implementar tudo de uma vez (resposta longa, mais difícil de revisar).

Recomendo **A**. Posso seguir?
