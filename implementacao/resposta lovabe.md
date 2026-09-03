# Integração Painel Sevii Colecionáveis ↔ `bot_seviicolecionaveis`

Documento de referência para o bot/Antigravity conectar-se ao painel.

---

## 1. Identidade (isolamento multi-bot)

| Parâmetro | Valor |
|---|---|
| `PROCESS_NAME` / `PM2_PROCESS_NAME` | `bot_seviicolecionaveis` |
| `BOT_API_SECRET` | `<BOT_API_SECRET>` |
| Porta API bot (VPS) | `3025` |
| Porta health (VPS) | `3026` |
| Porta comandos (VPS) | `3075` |
| WUZAPI user / webhook | `bot_seviicolecionaveis` · `http://127.0.0.1:3025/webhook/wuzapi` |
| Supabase project | `zuypkggpecsqormwculg` |

**Base URL do painel (produção):** `https://seviicolecionaveis.lovable.app`
(domínios próprios: `https://www.seviicolecionaveis.com.br`, `https://seviicolecionaveis.com.br`)
Preview/dev: `https://project--392637a4-5b2d-43f0-a643-ac0dba0c2366-dev.lovable.app`

Todas as chamadas devem enviar:

```
x-bot-secret: <BOT_API_SECRET>
Content-Type: application/json
```

Respostas de erro de autenticação: `401` (sem header), `403` (segredo errado),
`400` (`process_name` diferente de `bot_seviicolecionaveis`).

---

## 2. Tabelas criadas no Supabase (schema `public`)

| Tabela | Finalidade |
|---|---|
| `bot_instances` | `process_name` (único), `status`, `qr_code_base64`, `bot_number`, `command`, `updated_at` |
| `bot_groups` | `group_jid` (único), `group_name`, `group_type`, `status`, `activated_at` |
| `activation_codes` | `code` (10 dígitos, único), `group_name`, `group_type`, `is_used`, `used_by_jid`, `expires_at` |
| `bot_command_queue` | `command`, `target_group`, `target_bot`, `args` (jsonb), `status`, timestamps |

RLS habilitada: apenas administradores do painel leem/escrevem via app; o bot
acessa exclusivamente pelos endpoints HTTP abaixo (service role no servidor).
Realtime ativado para `bot_instances` e `bot_command_queue`.

Valores de `status` em `bot_instances`: `STARTING`, `AWAITING_SCAN`, `CONNECTED`, `DISCONNECTED`.

---

## 3. Endpoints

### 3.1 `POST /api/public/bot/status`
Upsert do estado da instância (por `process_name`).

```json
{
  "process_name": "bot_seviicolecionaveis",
  "status": "AWAITING_SCAN",
  "qr_code_base64": "data:image/png;base64,...",
  "bot_number": "55XXXXXXXXXXX"
}
```
Resposta: `200 { "success": true, "instance": { ... } }`

Notas:
- Quando `status = "CONNECTED"`, o painel limpa automaticamente `qr_code_base64` e `command`.
- Envie `"clear_command": true` para confirmar que consumiu um `RESET_AUTH`.

### 3.2 `GET /api/public/bot/status`
Retorna a instância atual — útil para o bot fazer polling do campo `command`
(`RESET_AUTH`) caso não use Realtime.

```json
{ "process_name": "bot_seviicolecionaveis", "instance": { "status": "CONNECTED", "command": null } }
```

### 3.3 `DELETE /api/public/bot/status?process_name=bot_seviicolecionaveis`
Remove a instância (limpeza de órfãos). `200 { "success": true }`

### 3.4 `GET /api/public/bot/groups/active`
Trava de segurança: o bot só deve responder nesses JIDs.

```json
{
  "now": "2026-09-03T18:00:00.000Z",
  "process_name": "bot_seviicolecionaveis",
  "count": 1,
  "jids": ["120363XXXXXXXXXX@g.us"],
  "groups": [{ "jid": "120363XXXXXXXXXX@g.us", "name": "Sevii Leilões", "group_type": "principal" }]
}
```

### 3.5 `POST /api/public/bot/groups/activate`
Chamado quando alguém digita `!ativar <codigo>` no grupo.

```json
{ "code": "7483920194", "group_jid": "120363XXXXXXXXXX@g.us", "group_name": "Sevii Leilões" }
```
- `200 { "success": true, "message": "Grupo ativado com sucesso!" }`
- `400 / 404 { "error": "Código inválido ou expirado" }`

O código é marcado como usado e o grupo entra em `bot_groups` com `status = active`.

### 3.6 `GET /api/public/bot/commands/pending?process_name=bot_seviicolecionaveis&limit=20`
Retorna comandos `pending` cujo `target_bot` é `bot_seviicolecionaveis` ou `NULL`.

```json
{
  "commands": [
    { "id": "uuid", "command": "!ping", "target_group": "120363...@g.us", "args": {}, "created_at": "..." }
  ]
}
```

### 3.7 `POST /api/public/bot/commands/:id/mark`
```json
{ "action": "done" }
```
`action` ∈ `sending` | `done` | `error`. Resposta `200 { "success": true, "command": { ... } }`.

### 3.8 `POST /api/public/bot/users/senha`
Comando `!senha` no WhatsApp — cria o cliente ou redefine a senha.

```json
{ "phone": "554799999999", "name": "Nome Cliente" }
```
```json
{
  "userId": "uuid",
  "created": true,
  "login": "554799999999@whatsapp.seviicolecionaveis.com.br",
  "phone": "554799999999",
  "password": "senhaGeradaAleatoria@1",
  "resetUrl": "/reset-password"
}
```
O login é o e-mail técnico derivado do telefone; o perfil recebe `phone` e `whatsapp`.

---

## 4. Painel administrativo

`/admin/conectar-bot` (menu lateral → Sistema → **Conectar Bot**):

- Card da instância `bot_seviicolecionaveis` com status em tempo real (Realtime + polling 15s).
- Exibe o QR Code quando `AWAITING_SCAN`; badge verde e número quando `CONNECTED`.
- Botão **Reiniciar conexão / Gerar novo QR Code** → grava `command = 'RESET_AUTH'` e
  `status = 'STARTING'`. O bot deve detectar (Realtime ou `GET /status`), apagar a sessão
  local e emitir novo QR.
- Gerador de códigos de ativação de 10 dígitos (validade 24h) com nome e tipo do grupo.
- Lista de grupos ativados com botão ativar/desativar.

---

## 5. Fluxos recomendados no bot

1. **Boot:** `POST /status` com `STARTING`.
2. **QR gerado:** `POST /status` com `AWAITING_SCAN` + `qr_code_base64`.
3. **Conectado:** `POST /status` com `CONNECTED` + `bot_number`.
4. **Loop (a cada ~5s):** `GET /status` → se `command === "RESET_AUTH"`, limpar sessão,
   reiniciar e enviar `POST /status` com `clear_command: true`.
5. **Loop (a cada ~5s):** `GET /commands/pending` → `POST /commands/:id/mark` com
   `sending` e depois `done`/`error`.
6. **Cache de segurança (a cada ~60s):** `GET /groups/active` — ignorar mensagens de
   qualquer JID fora dessa lista.
7. **`!ativar <codigo>`:** `POST /groups/activate` e responder no grupo com a mensagem retornada.
8. **`!senha`:** `POST /users/senha` e enviar as credenciais em privado ao usuário.

## 6. Exemplo de chamada

```bash
curl -X POST https://seviicolecionaveis.lovable.app/api/public/bot/status \
  -H "x-bot-secret: <BOT_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"process_name":"bot_seviicolecionaveis","status":"CONNECTED","bot_number":"5547999999999"}'
```
URL do painel: https://seviicolecionaveis.lovable.app (também https://www.seviicolecionaveis.com.br)
BOT_API_SECRET: <BOT_API_SECRET> (salvo como variável de ambiente do painel)
Tabelas criadas: bot_instances, bot_groups, activation_codes, bot_command_queue (RLS + Realtime nas duas primeiras/última)
Endpoints testados (header x-bot-secret, sem header → 401): GET/POST/DELETE /api/public/bot/status, GET /api/public/bot/groups/active, POST /api/public/bot/groups/activate, GET /api/public/bot/commands/pending, POST /api/public/bot/commands/:id/mark, POST /api/public/bot/users/senha
Tela admin: /admin/conectar-bot (sidebar → Sistema → Conectar Bot) com QR Code em tempo real, botão RESET_AUTH, gerador de códigos de 10 dígitos e gestão de grupos