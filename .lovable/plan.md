
## Objetivo

Adicionar, dentro de `/admin/emails`, uma seção "Compor e-mail manual" que permite ao admin:

- Escolher um template já existente (dropdown alimentado pelo `TEMPLATES` registry) **ou** compor um e-mail livre.
- Editar assunto e conteúdo (com a mesma estética Sevii — fundo branco, header com logo, rodapé padrão) antes de enviar.
- Adicionar uma lista de destinatários (um por linha, ou colar separado por vírgula/;).
- Pré-visualizar o HTML final antes do envio.
- Disparar o envio, com deduplicação, suppression check e log padrão (`email_send_log`).

## Fluxo na UI (`src/routes/admin.emails.tsx`)

Nova seção no topo da página, abaixo do botão "Enviar aviso Arte em Cards":

```text
[ Compor e-mail manual ]
─────────────────────────────────────────
Template base:  ( ▾ Personalizado | arte-em-cards-descontinuada | coupon-broadcast | ... )
Assunto:        [ .................................................. ]
Corpo (Markdown-lite ou HTML):
┌──────────────────────────────────────────────┐
│ Parágrafos separados por linha em branco.    │
│ **negrito**, [link](https://...) suportados. │
└──────────────────────────────────────────────┘
CTA (opcional):
  Texto: [ Falar no WhatsApp ]   URL: [ https://wa.me/... ]

Destinatários (um por linha ou separados por vírgula):
┌──────────────────────────────────────────────┐
│ cliente1@email.com                           │
│ cliente2@email.com                           │
└──────────────────────────────────────────────┘

[ Pré-visualizar ]     [ Enviar para N destinatários ]
```

- "Pré-visualizar" abre um `<Dialog>` com o HTML renderizado (via `/lovable/email/transactional/preview`) num `<iframe srcDoc={...}>`.
- Escolher um template do dropdown pré-carrega assunto/corpo padrão dele (quando aplicável) para o admin ajustar.
- "Personalizado" usa um novo template genérico `admin-broadcast` (ver abaixo).
- `window.confirm()` antes de enviar, mostrando quantos destinatários e o assunto.
- Toast com `X enviados, Y pulados` (suppressed/duplicados/inválidos).

## Novo template: `admin-broadcast`

Arquivo: `src/lib/email-templates/admin-broadcast.tsx`.

Estrutura idêntica aos existentes (fundo branco, logo centralizada, rodapé Sevii — Aracaju/Sergipe + link), com props:

- `subject` (usado no `<Preview>`)
- `bodyBlocks: Array<{ type: 'paragraph' | 'heading' | 'cta'; ... }>` — o servidor converte o texto do admin em blocos antes de renderizar (parágrafos por linha em branco, `**bold**` → `<strong>`, `[txt](url)` → `<Link>`). Texto justificado, cor `#262626`.
- `cta?: { label: string; url: string }` — botão verde `#25D366` opcional.

Registrado em `src/lib/email-templates/registry.ts` como `'admin-broadcast'`. Fica oculto da lista de "template base" da UI (usado só quando o admin escolhe "Personalizado") para não vazar internamente.

## Backend: server function nova

Arquivo: `src/lib/admin-email-compose.functions.ts` + helper `.server.ts`.

`sendAdminManualEmail`:

- `createServerFn({ method: 'POST' })` + `.middleware([requireSupabaseAuth])`.
- Valida com Zod:
  - `templateName`: string (registry) ou `'admin-broadcast'`.
  - `subject`: 1–200 chars.
  - `body`: 1–10.000 chars (texto do admin, convertido em blocos no server).
  - `cta?`: `{ label 1–40, url https://... }`.
  - `recipients`: `string[]` — normaliza (trim, lowercase), valida e-mail com `z.string().email()`, deduplica, limite máximo de 200 por chamada.
  - `templateOverrides?`: quando o admin escolheu um template real do registry, passa `templateData` livre (opcional; começamos só permitindo assunto/corpo customizados para `admin-broadcast`).
- Verifica `has_role(userId, 'admin')`; senão, `throw new Error('Forbidden')`.
- Para cada destinatário: `sendTransactionalEmailSafe` com `idempotencyKey = 'admin-manual-' + hash(subject+body+email+timestamp-dia)` — evita reenviar o mesmo conteúdo no mesmo dia se o admin apertar de novo.
- Retorna `{ enqueued, skipped, invalid, total }`.

Sem alterações de schema, RLS, migrations ou secrets. Usa o pipeline `email_send_log` + fila `transactional_emails` já existente.

## Pré-visualização

Reaproveita `/lovable/email/transactional/preview` (já existe, gated por `LOVABLE_API_KEY`). A chamada de preview vai por uma **outra** server fn `previewAdminManualEmail` que roda o `render()` do `@react-email/components` no servidor e devolve `{ html, subject }` para o iframe. Assim não precisamos expor a chave de preview ao browser.

## Arquivos a criar/editar

Criar:
- `src/lib/email-templates/admin-broadcast.tsx`
- `src/lib/admin-email-compose.server.ts` (parser markdown-lite → blocks, render, envio)
- `src/lib/admin-email-compose.functions.ts` (`sendAdminManualEmail`, `previewAdminManualEmail`)
- `src/components/admin/ManualEmailComposer.tsx` (UI da nova seção — mantém `admin.emails.tsx` enxuto)

Editar:
- `src/lib/email-templates/registry.ts` — registrar `admin-broadcast`.
- `src/routes/admin.emails.tsx` — renderizar `<ManualEmailComposer />` no topo, dentro de um `<section>` colapsável.

## Fora de escopo

- Editor WYSIWYG completo (usaremos markdown-lite: parágrafos, negrito, link, CTA).
- Anexos (não suportado pela infra de e-mail atual).
- Agendamento / envio em lote > 200 destinatários por clique (evita abuso e mantém a fila saudável).
- Salvar rascunhos no banco.

Se algum dos itens fora de escopo for necessário, posso adicionar em iteração seguinte.
