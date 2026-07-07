## Problema

Ao enviar e-mails pelo compositor manual, os metadados (`subject`, `body_html`, `from_email`, `batch_id`) só são gravados na linha inicial `status='pending'` do `email_send_log`. O processador da fila insere depois uma nova linha `status='sent'` (mesmo `message_id`) **sem** esses campos.

A dedup em `getEmailLogs` mantém apenas a linha mais recente por `message_id` — que é a `sent`, sem `body_html`. Resultado: a pré-visualização sempre mostra "Corpo do e-mail não disponível (envio antigo)", inclusive para envios novos.

## Correção

Alterar a dedup em `src/utils/emailLogs.functions.ts` para **mesclar** as linhas com o mesmo `message_id` em vez de descartar:

- Manter `status` / `error_message` / `created_at` da linha mais recente (comportamento atual — reflete o estado atual do envio).
- Fazer coalesce de `subject`, `body_html`, `from_email`, `batch_id` a partir de qualquer linha do mesmo `message_id` (a mais antiga, `pending`, contém esses campos).

Nenhuma alteração de schema, backend de envio ou UI. Apenas a lógica de merge no server function.

### Detalhes técnicos

Substituir o bloco:

```ts
const seen = new Map<string, EmailLogRow>();
for (const r of rows) {
  if (!seen.has(key)) seen.set(key, r);
}
```

por um merge que preenche campos faltantes a partir das demais linhas do mesmo `message_id` (rows já vem em ordem `created_at desc`, então a primeira ocupa status/erro/data; as demais só preenchem os campos ainda vazios).

Envios antigos (anteriores à migração que adicionou as colunas) continuarão sem `body_html` — a mensagem "envio antigo" segue correta apenas para eles.
