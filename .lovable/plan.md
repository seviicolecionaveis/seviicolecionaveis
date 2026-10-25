# Saldo de clientes e reembolsos — Sevii Colecionáveis

## Objetivo
Implementar saldo financeiro, pagamento total/parcial e reembolsos de ponta a ponta, aproveitando a conta, os pedidos, o painel administrativo, o Mercado Pago e os e-mails existentes. Preservar preços, cupons, frete, pontos, estoque, Pilha e regras de leilão.

## O que a análise confirmou
- Já existem vales-presente com saldo, pontos, cancelamentos parciais e integração de estorno com o Mercado Pago. Nenhum deles oferece o saldo financeiro e a escolha de reembolso solicitados.
- O saldo atual de vale-presente continuará separado; não haverá conversão automática nem crédito duplicado.
- O e-mail da loja está verificado e pronto para os novos avisos.
- Os estornos atuais precisam de proteção contra tentativas duplicadas e não distinguem corretamente conclusão de processamento pendente/manual. A nova gestão centralizará esses controles, mantendo as regras comerciais.
- O ambiente atual compartilha os dados com a loja publicada. Testes financeiros reais não serão feitos nele.
- Referência inicial: **24 testes existentes passaram**, cobrindo pagamentos de pedidos existentes, identificação do pagador, links de leilão e status. Não são testes do novo sistema nem comprovam homologação do Mercado Pago.

## 1. Meu saldo
- Adicionar “Meu saldo” à conta existente, com disponível, reservado e extrato paginado: data, descrição, crédito/débito, pedido/reembolso e saldo após a movimentação.
- Ajustes administrativos exigirão justificativa, confirmação e auditoria. Correções usarão lançamentos compensatórios, sem apagar histórico.
- Saldo não poderá ser transferido para outro cliente nem convertido automaticamente em dinheiro.

## 2. Reembolsos e saldo no painel
- Nova seção no painel existente, com pesquisa por cliente/e-mail/pedido/identificador e filtros de período, modalidade e status.
- Criar obrigação de reembolso para pedido inteiro ou itens específicos, com motivo e valor autorizado pela loja, sem cancelar os demais itens.
- Mostrar total elegível, já concluído, comprometido por solicitações abertas e ainda disponível; considerar reembolsos antigos para não disponibilizar novamente o mesmo valor.
- Consultar escolhas, saldo/extrato, histórico administrativo e envio de avisos.
- Aprovar/recusar a forma original, processar no Mercado Pago, acompanhar pendências/falhas e registrar conclusão manual com justificativa e referência quando necessário.
- Integrar os cancelamentos existentes ao mesmo controle financeiro. Cancelamento de itens, reposição de estoque e conclusão de reembolso permanecerão etapas distintas, conforme as regras atuais.

## 3. Link seguro e escolha do cliente
- Link individual com validade de **7 dias**, revogável e de uso único; reenvio renova a validade e invalida o anterior.
- Página com nome, número do pedido, motivo, valor e as duas opções solicitadas. Apenas abrir o link não consumirá a escolha.
- **Saldo Sevii:** confirmar a escolha, consumir o link, creditar a conta correta e gravar extrato/conclusão em uma única transação; enviar confirmação.
- **Forma original:** registrar pedido de análise, sem crédito nem estorno automático; notificar cliente e equipe. Processamento somente após aprovação administrativa explícita.
- Link inválido, expirado ou usado mostrará estado claro, sem permitir novo crédito. O link não concederá acesso geral à conta.

## 4. Saldo no checkout e nos pedidos pendentes
- Exibir disponível e permitir contribuição total ou parcial, calculando saldo utilizável e diferença no servidor.
- Manter total comercial e descontos intactos; mostrar separadamente saldo aplicado e valor restante.
- Reservar saldo antes de solicitar o pagamento complementar, bloquear gastos concorrentes e efetivar o débito somente na confirmação válida do pagamento.
- Compra totalmente coberta por saldo não chamará o Mercado Pago e seguirá o processamento existente de pedido pago.
- Pix/cartão e eventual caminho Stripe já existente cobrarão somente a diferença. Reutilizar validações de preço, descontos, agendamento, frete e CPF.
- Falha, expiração e cancelamento liberarão a reserva somente após verificar o estado real da tentativa. Retornos tardios serão conciliados sem novo débito nem aprovação indevida.
- **Leilões:** Pix continua com 30 minutos; tentativa vencida não cancela o pedido e uma nova cobrança depende do clique do cliente.
- Somente o próprio cliente autenticado poderá autorizar uso do seu saldo; um link de pagamento ou admin pagando por ele não autoriza gasto da carteira.

## 5. Pagamento original e Mercado Pago
- Vincular o reembolso ao pagamento original confirmado e usar chave persistida para todas as novas tentativas da mesma operação.
- Nunca concluir apenas por resposta HTTP bem-sucedida. Conferir situação, valor, referência e identificação do estorno; pendência ou resposta incerta continuará em acompanhamento.
- Reutilizar o aviso assinado de pagamento e acrescentar conciliação das operações de reembolso; preservar ordens de serviço e demais pagamentos.
- Em compras mistas, devolver cada parcela à sua origem: saldo volta ao saldo e somente o valor efetivamente pago externamente pode ser estornado externamente. Para reembolso parcial, distribuir proporcionalmente entre as origens em centavos, ajustando arredondamento no saldo remanescente.
- Escolher “Saldo Sevii” credita o valor autorizado integralmente, consumindo o mesmo limite de reembolso.
- Pagamentos antigos sem confirmação suficiente terão análise/manual indicada; não presumir que todo pedido possui pagamento externo elegível.

## 6. E-mails
Adicionar modelos à estrutura existente para convite, crédito, solicitação recebida, aprovação/processamento, conclusão e recusa/falha/intervenção. Reutilizar identidade visual, remetente e destinatário operacional configurado.

Cada evento terá chave própria contra duplicidade; erros de envio serão visíveis e reenviáveis sem repetir a operação financeira. Links secretos serão retirados das cópias de e-mail armazenadas em histórico/logs; não criar fila, serviço ou tabelas de envio novos.

## Detalhes técnicos
- Adicionar somente estruturas financeiras necessárias: contas de saldo, livro-razão imutável, reservas, tentativas/alocações de pagamento, obrigações de reembolso e eventos auditáveis. Reutilizar `profiles`, `orders`, `order_items`, `user_roles` e `admin_notifications`.
- Migrações aditivas pela ferramenta gerenciada, com concessões explícitas e RLS. Não reinterpretar `orders.wallet_deduction_cents`, que pertence ao vale-presente atual.
- Operações financeiras em transações PostgreSQL com bloqueios ordenados, unicidade/idempotência e limites por cliente, pedido, item e origem do pagamento; valores em centavos inteiros.
- Cliente lê somente o próprio saldo/extrato; não escreve diretamente em contas, reservas ou lançamentos. Administradores são revalidados por permissões atuais e situação ativa da conta em cada operação.
- Funções de servidor autenticadas para conta/admin; capacidade restrita para escolha por link, com token aleatório de 256 bits, SHA-256 persistido e validação atômica. Nenhum token em logs, auditoria, metadados de compartilhamento ou dados públicos.
- Separar regras puras, serviços financeiros e interfaces. Integrar a confirmação financeira antes dos efeitos de pedido pago, preservando serviços existentes de estoque, pontos, Pilha e e-mails.
- Páginas novas e páginas alteradas recebem títulos e metadados próprios; páginas financeiras privadas não serão indexadas.
- Registrar decisões estruturais no `AGENTS.md` e manter tarefas em `roadmap.md`.

## Testes e critérios de entrega
- Executar os 18 cenários do documento: criação correta, convite, escolha, duplicidade, expiração/revogação, aprovação, falha do provedor, reembolso parcial, limites, concorrência, pagamento total/parcial, liberação de reserva, acesso e regressões.
- Acrescentar testes de parcelas mistas, pagamento tardio, retorno de tentativa antiga, montante incorreto e reembolso zero/negativo.
- Testes automatizados de regras e serviços com respostas simuladas; testes de transação/RLS/concorrência em ambiente isolado; verificar as telas com cliente e admin autenticados e dados de teste.
- Validar prévia e diagnósticos automáticos, sem publicar automaticamente.
- Homologação do Mercado Pago depende de ambiente/contas de teste configurados. Se indisponível, relatar exatamente os testes simulados e os reais pendentes; nunca marcar um estorno real como confirmado por simulação.
- Não criar créditos em clientes reais, enviar convites de teste a clientes reais ou executar estornos reais sem autorização.

## Relatório final
Entregar funcionalidades, estruturas/funções/permissões criadas, testes e resultados, integrações efetivamente verificadas e dependências externas/problemas pendentes. Não declarar implementação ou validação completa enquanto houver etapas obrigatórias não executadas.