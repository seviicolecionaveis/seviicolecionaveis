# Plano: 4 novas features

Implementar em sequência, com migrations agrupadas no início.

## Status atual
- **Alertas de estoque (#1)**: já existe parcialmente — tabela `stock_alerts`, `subscribeStockAlert` e `StockAlertDialog`. **Falta**: gatilho automático para disparar e-mail quando estoque volta (>0), e área no perfil do cliente para listar/cancelar alertas.

---

## 1. Alertas de Estoque (completar)
- **Trigger no banco**: ao `UPDATE` em `cards.stock` (de 0 → >0), enfileirar e-mail via `enqueue_email` para todos os `stock_alerts` daquela carta com `notified_at IS NULL`, e marcar `notified_at = now()`.
- **Worker existente** (`email-queue-worker` ou similar) já consome a fila — só precisamos confirmar que processa o tipo `stock_back`.
- **Template de e-mail**: "A carta X voltou ao estoque!" com link direto.
- **UI cliente**: nova aba em `/account` listando alertas ativos com botão "Cancelar".

## 3. Comparador de Cartas
- **Estado global**: novo hook `useCompare` (localStorage, máx. 3 cartas).
- **Botão "Comparar"** no `CardModal` e nos cards do catálogo (ícone pequeno).
- **Barra flutuante** fixa no rodapé quando ≥1 carta selecionada → botão "Comparar (N)".
- **Rota `/comparador`**: tabela lado-a-lado com imagem, nome, coleção, raridade, tipo, HP, ataques (se houver), preço médio, estoque, condições disponíveis.

## 6. Ofertas Relâmpago
- **Nova tabela `flash_offers`**: `card_id`, `discount_percent`, `starts_at`, `ends_at`, `max_uses`, `uses_count`, `active`.
- **Admin** (`/admin/ofertas-relampago`): CRUD simples — listar, criar (selecionando carta + % desconto + janela de tempo), ativar/desativar.
- **Frontend**:
  - Banner/carrossel na home "🔥 Ofertas Relâmpago" com countdown ao vivo.
  - Badge "-X% • termina em HH:MM:SS" no card e no modal quando há oferta ativa.
  - Aplicar desconto automaticamente no carrinho (validar no checkout server-side contra `flash_offers` ativa).
- **Cron `pg_cron`**: desativa ofertas expiradas a cada 5min.

## 7. Notificações Push (Web Push)
- **Service Worker**: novo `public/sw.js` registrando push.
- **Tabela `push_subscriptions`**: `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`.
- **UI**: prompt opt-in em `/account` ("Receber notificações no navegador") + toggle.
- **Secrets**: gerar par VAPID (`VAPID_PUBLIC_KEY` público em env, `VAPID_PRIVATE_KEY` secret).
- **Server fn `sendPush`**: usa `web-push` (pacote npm, compatível com Worker via fetch direto à API do navegador — usar implementação manual com Web Crypto se incompatível).
- **Triggers de envio**:
  - Estoque voltou (junto com e-mail, se usuário tiver push ativo).
  - Oferta relâmpago nova (broadcast opcional).
  - Pedido mudou de status.

---

## Ordem de execução
1. Migration única: `flash_offers`, `push_subscriptions`, trigger de estoque voltando.
2. Completar alertas de estoque (UI no /account + template e-mail).
3. Comparador de cartas (puro frontend, mais rápido).
4. Ofertas Relâmpago (admin + frontend + integração checkout).
5. Push Notifications (mais complexo — SW + VAPID + integrações).

## Estimativa
Implementação total ~12-15 arquivos novos + ~8 edições. Vou implementar tudo em sequência sem parar, mas pode demorar 2-3 turnos de execução por causa das aprovações de migration (que rodam separadamente).

## Pergunta antes de começar
**Web Push (#7)** requer que o usuário aceite o prompt do navegador e funciona melhor em PWA. Tem 2 caminhos:
- **A**: Implementação completa com VAPID + service worker + tabela de subscriptions (mais robusto, ~4 arquivos).
- **B**: Push via OneSignal (serviço externo, mais fácil, mas adiciona dependência externa e script de tracking).

Qual você prefere para o push?
