# Evitar pedidos ocultos pelo crescimento do histórico

## Regra
Pedidos e agendamentos não podem desaparecer das listas, buscas ou rotinas apenas porque existem muitos registros anteriores. Uma prévia pode mostrar apenas os mais recentes, desde que não se apresente como lista completa. Nenhuma correção deve modificar pedidos já pagos, enviados, reembolsados ou encerrados.

## O que já está corrigido e validado
Expedição (`src/routes/admin.shipping.tsx`) consulta páginas de 500 registros, ordenadas por data e ID, avançando pelo número efetivamente recebido até uma página vazia. Não publica uma lista parcial se uma página falhar.

- 14 testes passaram, incluindo histórico com 2.501 pedidos e limite de resposta menor que o solicitado.
- Navegador autenticado: 846 pedidos carregados, 105 abertos; incluir Entregue mostrou 846 e buscar um pedido aberto mostrou um resultado. Computador/celular conferidos, sem erros de execução.
- Nenhum pedido foi alterado.

## Conferência das outras partes
As classificações abaixo são baseadas na leitura das consultas atuais, não em testes reais de pagamentos ou tarefas automáticas.

### Cortes confirmados nas telas e nas leituras operacionais
| Local | Resultado da leitura | Correção proposta |
|---|---|---|
| Pedidos admin — `admin.tsx` | Histórico completo sem paginação; filtros são locais. Ordenação recente protege os mais novos, mas oculta resultados anteriores e grupos. | Consultar todas as páginas antes dos filtros. |
| Dashboard — `admin.dashboard.tsx` | Histórico sem paginação, usado para métricas e exportação. | Remover truncamento das leituras; não recalcular campos financeiros persistidos. |
| Pedidos Leilão — `admin.pedidos-leilao.tsx` | Histórico sem paginação; filtros por cliente, status e leilão depois da leitura. | Paginar a leitura mantendo campos do leilão intactos. |
| Meus pedidos — `orders.index.tsx` | Histórico por conta sem paginação. | Paginar preservando a conta e as permissões existentes. |
| Envios/Retirada, checkout, escolha de agrupamento e editor de modalidade — `fulfillment-groups.functions.ts:listFulfillmentCandidates` | Consulta por conta do mais antigo ao mais novo; elegibilidade só depois da resposta limitada. | Carregar todas as páginas antes de aplicar elegibilidade. |
| Grupo existente — `chooseOrderFulfillment`, `notifyGroup` e `reschedulePickup` | Membros de um grupo consultados sem paginação. | Ler a composição inteira sem mudar como as operações autorizadas funcionam. |
| Eventos admin — `events.functions.ts:listEventOrders/countEventOrders` | Consulta ampla; modalidade efetiva e evento filtrados depois do retorno limitado. | Paginar antes da modalidade efetiva, lista, contagem e impressão. |
| Busca para adicionar pedidos a evento — `event-hub.server.ts:searchEventCandidates` | Limite de 1.500 antes da busca local; limite real pode ser menor. | Fazer a busca sobre o conjunto completo; manter prévia de 30 resultados após buscar. |
| Avisos de cancelamento — `AdminCancellationBell.tsx` | Lista de cancelamentos recentes sem paginação. | Paginar cancelamentos; manter prévia explícita dos 50 pedidos novos. |
| Verificação de avisos faltantes — `fulfillment-alerts.functions.ts` | Pedidos/OS limitados a 500 e histórico de notificações a 5.000; pode omitir pendências ou sugerir reenvio já feito. | Paginar leituras de ambos e preservar deduplicação existente. |
| Pilha — `card-stack.functions.ts`, `admin-pilha-detail.functions.ts` e leitura de pedidos associados em `admin-shipping-edit.server.ts` | Leituras por conjuntos de IDs não percorrem páginas. | Completar leituras e dividir conjuntos grandes sem alterar seleção ou operações. |
| Avisos de reagendamento na Pilha — `pilha.index.tsx` | Consulta sem paginação usada para mostrar um aviso por pedido reaberto. | Completar a lista antes de renderizar os avisos. |
| Progresso de coleção — `collection-progress.functions.ts` | Pedidos pagos e itens consultados sem paginação. | Completar ambas as leituras, sem editar compras. |
| Promoções já usadas — `SitePopups.tsx` | Histórico de cupons por conta sem paginação. | Completar leitura, sem alterar cupons ou regras de elegibilidade. |

### Cortes confirmados nas rotinas: exigem testes isolados antes de ativar
| Local | Resultado da leitura | Correção proposta |
|---|---|---|
| Reabertura de retirada e evento — `pickup-reschedule.server.ts` | Pedidos abertos consultados sem paginação; candidatos filtrados depois. | Ler conjunto completo antes de qualquer operação; preservar exclusões e prazos. |
| Avisos de evento — `event-notify.functions.ts` | Pedidos vinculados sem paginação. | Completar leitura antes do envio, preservando chaves de envio único. |
| Horários fora do intervalo — `events.functions.ts:flagOutOfRangeEventOrders` | Candidatos sem paginação. | Completar leitura antes da operação existente. |
| Cancelamento automático — `auto-cancel-unpaid.ts` | Primeiros 500 pendentes; registros não resolvidos podem ocupar o lote continuamente. | Cursor/lotes com avanço e limite de execução, preservando verificação do provedor e exclusões. |
| Conciliação de crédito — `customer-finance.server.ts:reconcileCreditPayments` | Primeiras 100 tentativas antigas; tentativas sem referência ou irresolvidas permanecem no início. | Rodízio de lotes testado, sem liberar valores por prazo nem tocar liquidações concluídas. |
| Recuperação do agrupamento pago — `checkout-fulfillment.server.ts:retryPaidCheckoutFulfillment` | Primeiras 50 intenções antigas não notificadas; falhas permanentes podem bloquear as seguintes. | Avançar entre lotes sem aplicar agrupamentos automaticamente a pedidos históricos já pagos nesta entrega. |
| Limpeza de pendentes e reenvio administrativo — `payments.server.ts` | Leituras de pendentes sem paginação. | Completar seleção, mantendo verificações, autorização e notificações atuais. |

### Lugares que não apresentam o mesmo corte de lista completa
- `customer-finance.functions.ts`: extrato e lista de reembolsos têm paginação explícita e contagem; detalhes buscam um pedido/obrigação específico.
- MCP `listar-pedidos.ts` e `listar-envios.ts`: página explícita, total e filtros na consulta. Acrescentar ID como desempate de ordenação, sem mudar permissões.
- MCP `relatorio-operacional.ts`: contagens no banco, sem retornar todas as linhas.
- MCP `resumo-vendas.ts`: já pagina e recusa explicitamente relatórios acima de 20.000; ajustar condição de término para não considerar resposta curta como fim quando o limite da API for menor que 500.
- `admin-customers.server.ts`: prévia de 30 pedidos recentes por cliente; não é uma lista completa de expedição.
- `admin-pilha.functions.ts`: prévia dos 20 pedidos recentes e busca direta por ID/prefixo (até duas correspondências para rejeitar ambiguidade).
- `coupons.server.ts`: prévia de até 200 usos recentes; não é seleção operacional de pedidos.
- `WelcomeDialog.tsx` e validação de cupons em `payments.server.ts`: existência de um uso ou contagem no banco, sem necessidade de histórico inteiro.
- Detalhes de pedido, pagamento por link, recebimento, etiqueta, taxa, cancelamento, pedido manual, bots, MCP de alteração e serviços de estoque (`orders.$orderId.tsx`, `admin.orders.$orderId.tsx`, `pay.$orderId.tsx`, `orders.functions.ts`, `auction-payment.functions.ts`, `auction-payment-links.server.ts`, `buyer-receipt.functions.ts`, `superfrete-label.server.ts`, `hand-delivery.functions.ts`, `order-cancellation.server.ts`, `manual-order.server.ts`, `orders.server.ts`, `card-stack.server.ts`, `service-orders.server.ts` e endpoints de bot): consultas por ID ou conjuntos explícitos, não históricos completos ordenados e truncados. Validar limites dos itens associados na implementação, sem mudar transações.
- Funções atuais do banco inspecionadas com `LIMIT/OFFSET`: `admin_search_customers` pagina e conta; `admin_search_orders_for_merge` filtra a busca antes da prévia de 30; `admin_change_auction_winner`, `admin_preview_auction_winner_change`, `admin_merge_customer_accounts`, `fulfillment_apply`, `fulfillment_create_service` e `fulfillment_rebalance` usam `LIMIT 1` para escolher um registro específico/representante, não para cortar uma lista de expedição. Nenhuma migration é proposta.

## Implementação
1. Reutilizar a paginação testada, com ordenação estável, falha explícita e preservação dos filtros de conta/status.
2. Corrigir primeiro as leituras das telas e dos grupos; não realizar ações de grupo ou salvar pedidos para testar.
3. Corrigir avanço das rotinas com testes isolados de lotes e falhas permanentes, sem rodar tarefas contra a loja.
4. Testar históricos maiores que 1.000/2.000 registros, respostas curtas, busca por registro fora da primeira página, grupo completo, falhas de página e desempate de datas.
5. Conferir telas autenticadas em computador/celular e registrar separadamente o que foi lido, simulado e executado.

## Limites e aprovação
O problema original da Expedição continua corrigido. A extensão encontrada envolve pagamentos, avisos e tarefas automáticas; por isso, esta ampliação fica pronta para aprovação antes de mudar esses fluxos. Não alterar registros concluídos, permissões, configurações, dados de exemplo, migrations, valores ou campos do leilão. Não fazer cobranças, enviar comunicações reais ou executar reaberturas/cancelamentos na loja para validar.

Permanece não verificada a execução completa dessas rotinas e pagamentos em ambiente isolado; a conferência desta extensão foi de código e das funções atuais do banco.