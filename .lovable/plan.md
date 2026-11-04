# Pilha de Cartas — páginas de detalhes (admin) e escolha de retirada/envio igual ao checkout (cliente)

## Parte 2 — Admin: página de detalhes de OS e de Pilha

### Novas rotas
- `src/routes/admin.pilha_.os.$serviceOrderId.tsx` → `/admin/pilha/os/:id` (detalhe da OS)
- `src/routes/admin.pilha_.pilha.$stackId.tsx` → `/admin/pilha/pilha/:id` (detalhe da pilha)
- Sublinhado final desaninha da listagem (que não tem `<Outlet>`), mesmo padrão usado em `admin.eventos-loja_`.
- Na listagem (`admin.pilha.tsx`), o cartão de cada OS/pilha fica clicável e leva à página de detalhes; o resumo atual (miniaturas, "Ver todas as cartas e endereço", seletor de status) continua na lista.

### Layout (espelhando `admin.orders.$orderId.tsx`)
- Cabeçalho: número (OS #code / Pilha id), nome do cliente, data, link do WhatsApp e seletor de status; botão "Voltar".
- Cartões: Cliente (nome, e-mail, telefone, CPF), Endereço e Pagamento & Envio (forma de pagamento, ID do pagamento, modalidade com data/horário/evento).
- Lista completa de itens com imagem, coleção, condição, quantidade e valor + filtros `ItemFacetFilter` (Acabamento, Coleção, Condição).
- Marcação "Separado por" (Luca/Julia) por item e contador "Separado: x/y":
  - Migration aditiva: `picked_by text`, `picked_at timestamptz` em `card_stack_items` (itens de OS e de pilha vivem nessa tabela).
  - Reutiliza o componente de marcação dos pedidos.
- Botão "Cancelar item" com as mesmas confirmações: na OS, reutiliza o fluxo de cancelamento do item do pedido de origem (`adminPartialCancelItem`) quando houver `order_item_id`; sem pedido de origem, remove da OS devolvendo à pilha (função já existente).
- Botão "Editar envio/retirada" e histórico de alterações: reutiliza `AdminShippingEditor`/`adminEditOrderShipping` quando a OS tem pedido de origem; para OS sem pedido, edição de método/endereço via `adminUpdateServiceOrder` com histórico em `service_orders.notes`/campo novo `edit_history jsonb` (migration aditiva).

### Extras da página de PILHA
- Data de início, prazo final (30 dias) e dias restantes.
- Lista dos pedidos que compõem a pilha (distinct `order_id` dos itens) com link para `/admin/orders/:id`.
- Todas as cartas somadas, com filtro por pedido de origem.
- Histórico da pilha derivado dos dados existentes (criação, itens/pedidos adicionados por data, OS geradas, modalidade escolhida) — sem tabela nova.

### Padronização de rótulos
- Um único mapa de nomes de modalidade (`src/lib/fulfillment-labels.ts`) usado na lista, nos detalhes e no cliente: "Entrega em mãos", "Retirada em mãos", "Retirada em eventos", "Frete rastreado (Correios)" etc. — elimina "Retirada em mãos" no selo vs "Retirada Presencial" no texto.

## Parte 3 — Cliente: escolha de retirada/envio igual ao checkout

### Reescrita de `src/routes/pilha.solicitar.tsx`
Reutilizando os mesmos componentes/regras do checkout:
- **Frete rastreado (Superfrete)**: endereço + cotação automática (já existe, manter).
- **Entrega em mãos (só Aracaju/SE)**: calendário só com quintas, endereço, informações adicionais, taxa R$15, instruções de Pix e botão de comprovante no WhatsApp; confirmação só por admin (regras de `src/lib/hand-delivery.ts`, validadas no backend).
- **Retirada em mãos**: calendário seg–sex, 14h–19h em blocos de 30 min, grátis (mesmo picker do checkout, `src/lib/scheduling.ts`).
- **Retirada em eventos**: `EventSlotPicker` com datas destacadas, tooltip, blocos de 1h, grátis (já existe, manter).
- **Continuar guardando a pilha**: botão que simplesmente volta sem criar OS.

### Regras (mesmas do checkout, server-side)
- Antecedência mínima de 24h e fechamento de datas/eventos (`src/lib/scheduling.ts`, `src/lib/events.ts`).
- Restrição Aracaju/SE validada também no backend (já existe em `assertSchedule`/service-orders).
- E-mails de confirmação (cliente e loja), botão Google Calendar, notificação no sino do admin e histórico — tudo via o ponto central `notifyFulfillmentChange` (já chamado por `service-orders.server.ts`).
- A escolha NÃO prorroga nem reinicia o prazo de 30 dias (nenhuma escrita em `expires_at`).

### Comportamento da pilha
- Escolha vale para a pilha inteira ou para itens selecionados (checkboxes já existem em `pilha.index.tsx`); resumo do que está incluído antes de confirmar (já existe, manter e melhorar).
- Em `pilha.index.tsx`: topo mostra "N dias restantes"; após confirmar, mostra modalidade, data/horário e status, com opção de alterar enquanto dentro do prazo de 24h (link para refazer a escolha — cria nova OS/fluxo de alteração).

## Testes e validação
- Testes unitários das regras puras novas (rótulos, picked counters se aplicável).
- Playwright com sessão admin: abrir detalhe de OS e de pilha, marcar "Separado por", cancelar item, editar envio.
- Playwright como cliente: fluxo de solicitar com cada modalidade (sem pagar de verdade), verificando 24h/Aracaju/eventos.
- Build + checagem de `/tmp/observability/build-errors.log`.

## Fora de escopo
- Nenhuma alteração em pagamentos, estoque ou prazos de pilha.
- Nenhum dado real de cliente será modificado nos testes.
