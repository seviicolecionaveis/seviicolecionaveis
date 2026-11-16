# Grupos de envio e retirada

## O que foi encontrado
- A modalidade final da Pilha fica na OS; o vínculo com os pedidos passa pelos itens da Pilha. Hoje essa escolha não é copiada automaticamente para os pedidos.
- Conferência atual: **43 OS**, das quais **41 têm pedidos vinculados**, e **90 pedidos distintos**. Nenhum pedido pertence a mais de uma OS, inclusive entre OS ativas.
- Dos 90 pedidos, **26 estão em andamento** (17 separados, 8 aguardando retirada e 1 pago), **63 entregues** e **1 cancelado**.
- A loja já tem um ponto central de avisos de modalidade; ele será reutilizado. As atualizações atuais da OS/itens e da edição de vários pedidos não são uma única transação; o novo fluxo precisará garantir tudo ou nada.

## Abordagem escolhida
Guardar um ID próprio de grupo nos pedidos, com referência opcional à OS e número legível para grupos avulsos, **sem tabela intermediária e sem alterar a estrutura das OS ou o sistema de leilões**. Uma operação central validará a escolha, atualizará todos os pedidos selecionados em uma transação e acionará o aviso existente uma única vez.

### 1. Escolha pela Pilha
- Cliente e admin: ao criar a OS, vincular todos os pedidos com itens na solicitação e propagar modalidade, agendamento, evento, endereço, observações e situação da taxa atomicamente.
- A mesma escolha passa a aparecer nos pedidos, filtros, detalhes, lista do evento e entregas de quinta-feira.
- Manter os vínculos existentes dos itens com a OS e o prazo original de 30 dias da Pilha. Nenhuma alteração no ciclo de pagamentos, estoque ou leilões.

### 2. Escolha fora da Pilha
- Reutilizar os seletores do checkout e mostrar, antes da confirmação, número/data/itens dos outros pedidos elegíveis, marcados por padrão e com caixas para desmarcar.
- Excluir sempre Entregue, Cancelado e Enviado; validar dono, situação e área de entrega novamente ao confirmar.
- Mostrar avisos de agendamento substituído, mudança de grupo e pedidos não elegíveis. Pedidos de leilão pagos usam somente os novos dados de agrupamento/modalidade, preservando os campos consumidos pelo leilão.
- Oferecer inclusão opcional de pedidos novos em um agendamento ainda válido, respeitando a antecedência mínima.

### 3. Taxa única e mudanças no grupo
- O pedido mais antigo é o principal: taxa de entrega **R$15** ou frete uma vez por grupo; os demais exibem zero com referência ao principal.
- Separar o custo operacional do grupo dos valores financeiros já pagos; não reescrever totais, pagamentos nem valores históricos dos pedidos existentes.
- Ao sair, cancelar ou entregar o principal, transferir a responsabilidade operacional aos pedidos restantes sem duplicar cobrança ou perder a confirmação anterior. Confirmação da taxa pelo admin vale para todo o grupo.
- Recalcular cotação de frete quando peso/medidas mudarem e apresentar qualquer diferença antes de confirmar; não cobrar automaticamente.
- Edição e entrega perguntam “grupo inteiro” (padrão) ou “só este pedido”. No segundo caso, retirar apenas aquele pedido do grupo.
- Grupo com um único pedido conserva a modalidade, sem selo de grupo. Reabertura de retirada/evento vale para todos os pedidos elegíveis do grupo.

### 4. Visualização e avisos
- Selo clicável “OS #1035” ou “Grupo #N” leva à lista filtrada dos pedidos do grupo.
- Retirada no evento: uma linha por cliente/horário, listando pedidos e total de itens.
- Uma notificação administrativa, um e-mail ao cliente e um à loja por escolha; um link Google Calendar com os pedidos na descrição, no fuso America/Fortaleza.
- Registrar histórico em cada pedido; avisar à loja quais agendamentos antigos foram substituídos. O link de calendário não remove automaticamente eventos já adicionados à agenda da loja.
- Persistir chave de operação e deduplicação para impedir grupos/avisos repetidos em cliques, recargas ou tentativas concorrentes.

### 5. Dados existentes e reprocessamento
- **A aprovação deste plano autoriza a atualização dos vínculos existentes descritos acima**, somente depois de guardar e verificar backup privado das linhas afetadas e recontar os dados.
- Preencher grupos e dados de modalidade a partir das OS existentes. Pedidos entregues/cancelados recebem apenas o vínculo histórico nos campos novos; não modificar modalidade operacional, valores, pagamento, itens ou datas de criação desses pedidos.
- Nos 26 pedidos em andamento, copiar a escolha aplicável da OS, mantendo datas históricas; não criar agendamentos novos com datas vencidas nem reabrir prazos automaticamente na migração.
- Se aparecer pedido em várias OS antes da execução, interromper e apresentar o caso. Após confirmação, prevalece a OS ativa mais recente, com as demais registradas no histórico.
- Botão administrativo “Reprocessar”: prévia, confirmação, backup e opção de enviar ou não e-mail ao cliente. Não enviar avisos aos clientes durante a atualização inicial.

## Detalhes técnicos
- Adições em `orders`: `fulfillment_group_id`, `fulfillment_service_order_id`, número sequencial legível do grupo, marca de principal e dados operacionais do grupo necessários para preservar os campos antigos dos leilões e a contabilidade histórica.
- Sem tabela de grupos: metadados compartilhados e chave de operação persistidos nos pedidos, com consistência imposta pela operação transacional.
- RPCs autenticadas verificam dono/admin e bloqueiam pedidos/itens/grupos afetados, em ordem estável. A criação da OS, solicitação dos itens e propagação ficam na mesma transação; efeitos externos vêm depois.
- Reutilizar as regras puras de agendamento, eventos, área de entrega, status, etiquetas e o serviço central de avisos; adaptar criação/edição da OS, checkout, pedidos, admin, confirmação de taxa, entrega/cancelamento e reabertura para o mesmo serviço.
- Mudanças de estrutura são aditivas. Backup e preenchimento dos dados existentes têm prévia e proteção contra repetição; nenhuma alteração de tabelas do leilão ou da OS.

## Validação antes de concluir
- Pilha com três pedidos: retirada no evento aparece nos três pedidos e na lista agrupada do evento.
- Dois pedidos com entrega em mãos: R$15 uma vez, confirmação para ambos, um aviso de cada tipo e um link de calendário.
- Entregue, Cancelado e Enviado nunca recebem alterações operacionais pela propagação.
- Edição de um pedido isolado o retira do grupo sem alterar os demais; saída do principal transfere a taxa sem duplicá-la.
- Validar 24h, fechamento e reabertura de eventos, quinta-feira, área Aracaju, prazo da Pilha, permissões, falhas transacionais, repetição e concorrência.
- Conferir telas de cliente/admin em computador e celular; regressões de leilão e pagamentos com dados fictícios em ambiente isolado. Não cobrar nem cancelar pedidos reais ou enviar e-mails de teste a compradores.
- Se a entrega real de e-mails ou a cotação/cobrança externa não puder ser homologada em ambiente de teste, informar expressamente o limite de validação.