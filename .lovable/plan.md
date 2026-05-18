
# Integração Melhor Envio (sandbox, OAuth2, em paralelo ao Superfrete)

## Pré-requisitos (você precisa fazer)

1. Criar conta no sandbox: https://sandbox.melhorenvio.com.br
2. Em **Configurações → Tokens e Aplicativos → Meus Aplicativos**, criar um app com:
   - **Redirect URI**: `https://seviicolecionaveis.com.br/api/public/melhorenvio/callback`
   - **Scopes**: `shipping-calculate`, `shipping-cart`, `shipping-checkout`, `shipping-generate`, `shipping-print`, `shipping-tracking`, `cart-read`, `cart-write`
3. Anotar `client_id` e `client_secret` — vou pedir como secrets quando estiver pronto.

## Arquitetura

```text
Admin                         Sevii server                Melhor Envio
  │  clica "Conectar"            │                             │
  │ ───────────────────────────► │                             │
  │  redirect p/ ME authorize    │                             │
  │ ◄─────────────────────────── │                             │
  │  login + autoriza            │                             │
  │ ──────────────────────────────────────────────────────────►│
  │  redirect c/ ?code           │                             │
  │ ◄──────────────────────────────────────────────────────────│
  │     /api/public/melhorenvio/callback?code=...              │
  │ ───────────────────────────► │  troca code → tokens        │
  │                              │ ──────────────────────────► │
  │                              │  salva em melhorenvio_tokens│
  │  ◄──────redirect /admin ──── │                             │
```

Depois disso, cotação no checkout chama Melhor Envio com `access_token` armazenado (refresh automático quando expira).

## O que vai mudar no código

### 1. Banco
Nova tabela `melhorenvio_tokens` (singleton, só admin acessa):
- `access_token`, `refresh_token`, `expires_at`, `environment` (`sandbox`/`production`), `scope`
- RLS: só admin lê/escreve

### 2. Secrets
- `MELHORENVIO_CLIENT_ID`
- `MELHORENVIO_CLIENT_SECRET`
- `MELHORENVIO_ENVIRONMENT` = `sandbox`

### 3. Arquivos novos
- `src/lib/melhorenvio.server.ts` — cliente da API (token refresh, cotação, compra, etiqueta)
- `src/utils/melhorenvio.functions.ts` — server fns:
  - `getMelhorEnvioAuthUrl` (admin) → retorna URL de autorização
  - `getMelhorEnvioStatus` (admin) → conectado? expira quando?
  - `disconnectMelhorEnvio` (admin)
- `src/routes/api/public/melhorenvio/callback.ts` — recebe `?code=`, troca por tokens, salva, redireciona para `/admin`

### 4. Arquivos editados
- `src/utils/shipping.functions.ts` — `getShippingQuotes` chama Superfrete **e** Melhor Envio em paralelo, mescla e ordena por preço. IDs ficam `melhorenvio:<service-id>` para diferenciar.
- `src/routes/admin.tsx` (ou nova seção) — botão "Conectar Melhor Envio (sandbox)" + status
- `src/components/checkout/...` — nada muda (já lista quotes por `id`/`serviceName`)
- `src/lib/superfrete-label.server.ts` — **não muda agora**. Compra de etiqueta continua só pelo Superfrete. Se quiser comprar etiqueta no ME quando o cliente escolher uma cotação ME, fazemos numa segunda etapa.

## Escopo desta entrega

✅ OAuth2 completo (connect/refresh/disconnect)
✅ Cotação Melhor Envio no checkout, em paralelo ao Superfrete
✅ UI admin para conectar/desconectar e ver status
✅ Sandbox por padrão (controlado por `MELHORENVIO_ENVIRONMENT`)

❌ Compra automática de etiqueta no ME (fica para próxima — exige fluxo cart→checkout→generate→print, bem maior)
❌ Tracking ME (fica para depois)

## Próximo passo

Você cria o app no sandbox do Melhor Envio com o redirect URI acima e me confirma. Quando confirmar, eu:
1. Crio a migration da tabela
2. Peço os 2 secrets via formulário
3. Implemento tudo

OK assim?
