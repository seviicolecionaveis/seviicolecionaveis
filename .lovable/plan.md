# Hub de Retirada e Envio — Sevii Colecionáveis

## Investigação concluída, sem alterar pedidos ou fluxos
- **Pilha:** `/pilha/solicitar` já reúne endereço, calendários, cotação e Pix de frete. A OS e os itens ligam a solicitação aos pedidos, conservando o vencimento original.
- **Grupos:** os pedidos já têm ID/número do grupo, referência à OS, modalidade operacional e histórico separados dos valores originais. Já há operações transacionais de escolha, taxa e reabertura.
- **Calendários:** checkout e Pilha compartilham retirada seg–sex, blocos de 30 min entre 14h e 19h, entrega quinta às 19h e eventos ativos em blocos de 1h; Fortaleza e 24h também no servidor.
- **Avisos:** existe um ponto central com sino, e-mails independentes ao cliente/loja, log, retentativas, deduplicação e link Google Calendar. Grupos já recebem um aviso consolidado.
- **Pagamento:** Mercado Pago já gera Pix, recebe confirmação assinada e atende pedidos/OS. **Entrega em mãos ainda usa Pix externo confirmado pelo admin**, não QR Code de R$15 dentro do site.
- **Admin:** já existe Expedição em `/admin/shipping`, mas lista apenas status Pago e usa dados originais; não é uma agenda completa de grupos. Eventos e Pilha têm suas telas próprias, a serem reaproveitadas.
- **Acesso:** o login atual já aceita destino de retorno; consultas autenticadas e permissões existentes identificam o dono/admin.

### Diferenças que impedem simplesmente reaproveitar tudo
1. A lista atual de candidatos pode incluir pedidos normais ainda pendentes; o hub precisa exigir pagamento confirmado para todas as origens e excluir também rastreios já registrados.
2. A entrega em grupo e a confirmação do comprador atuais alteram o **status original do pedido**. A reabertura também escreve campos antigos. Esses caminhos não podem ser usados sem adaptação para leilões pagos somente leitura.
3. Os grupos existem nos pedidos, mas não possuem um registro financeiro próprio de tentativa Pix com valor, vencimento e confirmação automática da taxa.
4. Não foram encontrados campos de responsável/data de separação e leitura individual do grupo na estrutura consultada; registrar esses dados operacionais.
5. Eventos hoje fecham por início de cada dia do evento. O documento exige fechamento 24h antes do início do evento; ajustar a regra compartilhada, sem mudar reservas antigas, depende da aprovação abaixo.

## Abordagem escolhida
**Expandir os recursos atuais, não construir outro sistema.** Manter os grupos existentes como fonte da modalidade e conectar uma página única do cliente a uma agenda administrativa. Registrar pagamento complementar e andamento operacional nas estruturas de envio/retirada, sem reescrever valores, itens, pagamento ou campos originais dos leilões.

## 1. Página do cliente: `/retirada-envio`
- Usar o mesmo login/cadastro e retornar automaticamente à página após entrar.
- Listar apenas pedidos próprios pagos, não entregues/cancelados/enviados e sem rastreio; mostrar origem, data, número, miniaturas, quantidades e modalidade efetiva.
- Seleção explícita com selecionar todos/contador; Pilha ativa com prazo e inclusão opcional, sem duplicar pedidos. Itens de Pilha sem pedido vinculado usam a OS existente, sem inventar pedidos.
- Confirmar substituição de agendamentos existentes antes de gravar.
- Calendários e locais Aruana/Aeroporto existentes; entrega somente Aracaju/SE com endereço/observações; SEDEX em destaque e demais fretes rastreados fora de Aracaju. Aviso de bloqueio de Correios em Aracaju. Guardar na Pilha apenas com Pilha ativa.
- Resumo com pedidos, data, endereço e cobrança única por grupo antes de confirmar. Revalidar dono, elegibilidade, cidade, cotação e horário no servidor, dentro da operação atômica.
- “Meus agendamentos”: ativos, concluídos, cancelados e reabertos; alteração/cancelamento somente com **mais de 24h**, caso contrário WhatsApp. Confirmação de recebimento a partir do horário: tudo recebido ou falta de itens, com auditoria e aviso à loja.
- Sucesso com resumo e WhatsApp `https://wa.me/5579981509552`.

## 2. Taxa e frete no site
- Entrega em mãos: **R$15 por grupo**, QR Code/copia e cola, vencimento limitado pelo fechamento quarta às 19h, atualização manual da consulta e confirmação automática pelo Mercado Pago.
- Frete rastreado: cotar novamente no servidor para os itens/endereço selecionados e cobrar uma vez; não aceitar preço enviado pela tela como autoridade.
- Separar pagamento da taxa/frete dos pagamentos já quitados das cartas; não executar novamente baixa de estoque, pontos, desconto Pix de leilão ou quitação do pedido.
- Mostrar pagamento pendente na página/e-mail e em uma linha do grupo no admin. Confirmação externa exige conferir valor, referência e estado do pagamento; repetição nunca duplica cobrança/confirmação.
- Admin conserva confirmação manual por grupo, com observação, autor, horário e estado anterior.
- Sem pagamento até o fechamento: cancelar **o agendamento**, não os pedidos, manter histórico e deixá-los sem modalidade para nova escolha; avisar cliente/loja. Pagamento aprovado tardiamente gera pendência financeira para análise, nunca confirma um horário vencido nem perde o dinheiro recebido.
- **Regra confirmada:** ao cancelar entrega paga com mais de 24h, manter os R$15 quitados e reagendar o mesmo grupo automaticamente para a próxima quinta disponível depois da data cancelada, respeitando 24h. Informar a nova data e permitir alteração pelo cliente dentro do prazo; nunca cobrar de novo. Se não for possível reagendar, registrar pendência para o admin sem perder o pagamento.

## 3. Hub administrativo
- Expandir a Expedição existente, com acesso em `/admin/expedicao`, nome “Retiradas e Envios” no menu e preservação de `/admin/shipping` como acesso compatível; não manter duas listas concorrentes.
- Abas: Hoje/próximos dias; entregas de quinta; retiradas; eventos; envios; aguardando escolha; pendências.
- Uma linha por grupo/cliente com pedidos, origem, endereço/observações, data, taxa, itens e progresso; pendentes destacados e Google Maps.
- Busca por cliente/e-mail/telefone/pedido/OS/carta; filtros de modalidade, origem, status, pagamento, data, evento e novos/não vistos. Contadores e total de itens a separar.
- Reutilizar editores de modalidade, etiquetas/cotações e acesso ao hub de Eventos. Rastreio e “Marcar enviado” avisam o cliente pelo ponto central.
- Separado, Pronto para retirada, Faltam cartas e Entregue com confirmação em pedido/grupo/lote; perguntar o alcance da entrega. Registrar responsável real pela separação, autor/hora/tela das ações e confirmação do comprador.
- Checklist e “Pronto para sair” com todos separados e taxa paga; copiar/imprimir lista com conferência e impressão para PDF.
- Admin pode agendar fora das 24h com aviso e motivo auditado. Entrega frustrada exige decisão administrativa entre reagendar e cobrar novamente; nunca cobra sozinha.
- Modalidades antigas aparecem como Legado/Sem modalidade, preservando os dados para revisão manual.

## 4. Automação e avisos
- Ampliar o ponto central existente: confirmação/alteração/cancelamento, pagamento confirmado, pronto, rastreio, lembrete na véspera, reabertura e taxa próxima do fechamento.
- Um e-mail por destinatário e ocorrência de grupo, não por pedido; link do grupo no hub e Google Calendar. O link cria um evento quando a loja o adiciona, não sincroniza/remove eventos já existentes.
- Deduplicação, retentativas e falha visível no admin; avisos após confirmar a transação.
- Reutilizar a rotina de reabertura: retirada às 14h do dia seguinte, evento às 10h do dia seguinte ao fim, grupo inteiro. Acrescentar vencimento/lembretes de forma consolidada, definindo frequência e atraso máximo antes de ativar.
- Não reiniciar nem prorrogar os 30 dias da Pilha.

## Detalhes técnicos e proteção dos dados
- Reutilizar `effectiveFulfillment`, `fulfillment_group_id`, referências às OS e histórico. Acrescentar estado operacional por membro/grupo para status, rastreio, separação, recebimento e leitura sem modificar campos originais de leilões pagos.
- Ampliar as operações centrais com bloqueios determinísticos, transação tudo-ou-nada e chave vinculada à seleção/ação; validar novamente a elegibilidade após obter os bloqueios.
- Tentativas de pagamento complementar ligadas ao grupo: valor, referência, ID externo, prazo e estado; **não substituem os grupos** nem criam outro gateway.
- Funções autenticadas validam dono/admin no servidor; permissões por usuário e proteção de escrita financeira/operacional. Webhook existente ganha despacho para cobrança de grupo, sem encaminhá-la à quitação das cartas.
- Atualizar leituras/ações compartilhadas para status efetivos e avisos únicos; bot, lances e integração externa intactos.
- **Mudanças somente aditivas. Antes de cada migração:** apresentar SQL/escopo em resumo, pedir confirmação explícita e guardar/verificar backup privado das definições e linhas afetadas. A aprovação geral deste plano autoriza o trabalho de implementação, mas **não dispensa essa confirmação por migração**.
- Sem atualizar pedidos antigos em massa, cobrar clientes ou enviar avisos de teste reais. Reparos de dados exigem prévia/aprovação separadas.

## Validação antes de concluir
- Testes isolados: Aracaju com três pedidos, um de leilão, Pix R$15 único e confirmação de grupo; fora de Aracaju com SEDEX e sem entrega em mãos.
- Bloqueios de prazo, horário expirado com tela aberta, fechamento de evento, propriedade, pedido não pago/entregue/cancelado/enviado/com rastreio.
- Pix vencido, confirmação atrasada, webhook repetido, clique duplo, divergência de valor, falha parcial/rollback e confirmação manual exclusiva de admin.
- Entrega em pedido/grupo/lote, recebimento parcial, separação, reabertura, avisos únicos e prazo da Pilha intacto; cancelamento antecipado pago reagenda para a próxima quinta com os mesmos R$15 e permite alteração.
- Comparar campos originais de leilões antes/depois de cada ação; devem permanecer idênticos.
- Conferir cliente/admin em computador/celular. Pagamento e e-mail ponta a ponta exigem aplicação isolada e Mercado Pago comprovadamente de teste; o banco atual é compartilhado com a loja.

## Aprovação necessária agora
Autorizar a criação das duas páginas e a adaptação dos fluxos compartilhados de grupos, pagamento complementar, leitura de status, eventos e avisos descritos acima. A execução de migrações e alterações de dados permanece condicionada às confirmações e backups separados.