# Aviso: fim da retirada na Arte em Cards

## 1. Template de e-mail

Criar `src/lib/email-templates/arte-em-cards-descontinuada.tsx` no mesmo padrão dos demais templates React Email, replicando o visual aprovado (`arte-em-cards-descontinuada_v2.html`):

- Fundo `#ffffff`, texto na cor do site (`#262626`), parágrafos justificados, largura máxima 600px.
- Logo Sevii centralizada no topo (usando `LOGO_URL` já definida em `_shared.tsx`) com faixa "SEVII COLECIONÁVEIS" e divisor escuro.
- Corpo com o texto exato enviado pelo cliente, quebrado em 5 parágrafos.
- CTA "Falar no WhatsApp" — botão arredondado `#25D366`, texto branco, link `https://wa.me/5579981509552`.
- Rodapé com logo pequena, "Sevii Colecionáveis — Aracaju, Sergipe" e link para `https://www.seviicolecionaveis.com.br`.
- Sem link/texto de descadastro (o sistema anexa automaticamente).
- Exportar `template` satisfazendo `TemplateEntry` com `subject: "Atualização sobre retirada na Arte em Cards"`, `displayName` e `previewData`.

Registrar em `src/lib/email-templates/registry.ts` (import + entrada em `TEMPLATES`).

## 2. Envio único aos destinatários certos

Público: `public.service_orders.method = 'arte_em_cards'` (16 pedidos hoje, 2 `paid` + 14 `delivered`; 0 em `orders.shipping_method='arte_em_cards'`).

Criar `src/lib/admin-arte-em-cards-notice.functions.ts` + helper `.server.ts`:

- `createServerFn` com `requireSupabaseAuth`, checando `has_role('admin')` via `supabaseAdmin` (padrão de `resendPendingOrderEmailsServer`).
- Handler:
  1. Seleciona `user_id, recipient_name` distintos em `service_orders` onde `method='arte_em_cards'`.
  2. Resolve e-mail de cada usuário via `supabaseAdmin.auth.admin.getUserById`.
  3. Deduplica por e-mail (case-insensitive), pula suprimidos.
  4. Enfileira via `sendTransactionalEmailSafe` com `templateName: "arte-em-cards-descontinuada"`, `idempotencyKey: "arte-em-cards-descontinuada-v1-<userId>"`, `templateData: { recipientName }`.
  5. Retorna `{ enqueued, skipped }`.

## 3. Gatilho manual no painel admin

Adicionar botão em `src/routes/admin.emails.tsx` — "Enviar aviso: fim da retirada na Arte em Cards" — com confirmação (`window.confirm`) antes de disparar via `useServerFn`; toast mostra `enqueued / skipped`.

## 4. Execução

Após build passar, você aperta o botão no painel uma vez; os e-mails entram na fila `transactional_emails` e o worker `/lovable/email/queue/process` entrega. `idempotencyKey` por usuário evita reenvio se o botão for clicado de novo.

## Detalhes técnicos

- Sem alteração de schema/RLS/permissões.
- Sem loop de marketing: aviso operacional único ligado a um evento concreto por destinatário.
- Se novos pedidos Arte em Cards aparecerem no futuro, ficam fora deste envio pontual (a opção já foi removida do checkout e da Pilha).
