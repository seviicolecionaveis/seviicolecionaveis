# Preservar agendamentos ao abandonar o checkout

## Problema confirmado
O checkout seleciona todos os pedidos anteriores automaticamente. Nos quatro caminhos de criação de pedido, a escolha já altera o grupo e o agendamento desses pedidos antes da confirmação do pagamento. Cancelamento e expiração não restauram o horário anterior.

## Correção proposta
1. Deixar os pedidos anteriores desmarcados inicialmente; incluir somente aqueles escolhidos pelo cliente.
2. Guardar a intenção de agrupamento no novo pedido, sem modificar nenhum pedido anterior enquanto o pagamento estiver pendente.
3. Aplicar a intenção somente após pagamento confirmado, pelo fluxo central que atende Pix, cartão e compras cobertas por saldo ou vale-presente.
4. Revalidar dono, disponibilidade dos pedidos e horário na confirmação. Se a escolha não puder mais ser aplicada, preservar os agendamentos anteriores e avisar cliente e loja de que a inclusão precisa ser resolvida; nunca desfazer pagamento ou repetir baixa de estoque.
5. Garantir aplicação única e recuperação segura em novas tentativas de confirmação. Compra abandonada, cancelada ou com pagamento recusado não altera os pedidos selecionados.

## Detalhes técnicos
- Persistência aditiva da intenção, com escrita protegida e estado de processamento; não reutilizar campos financeiros, notas ou o overlay operacional como armazenamento de entrada não confirmada.
- Remover a chamada imediata a `fulfillment_apply` dos quatro caminhos de criação. Reutilizar a operação atômica de grupos e os avisos centrais após confirmação, com chave vinculada ao novo pedido.
- Tratar repetição/recuperação separadamente da baixa de estoque, pontos e pagamentos; a saída antecipada para pedidos já pagos não deve impedir a recuperação de uma intenção ainda não processada.
- Não alterar nem tentar restaurar automaticamente pedidos históricos: a intenção original do cliente não pode ser deduzida com segurança.

## Validação
- Testes focados: criação pendente mantém horário/grupo anteriores; cancelamento, abandono e recusa mantêm esses dados; pagamento confirmado aplica só os IDs escolhidos; repetição não move nem notifica novamente; horário expirado ou pedido indisponível preserva os anteriores.
- Conferir Pix, cartão e pagamento sem cobrança externa com dados fictícios em ambiente isolado, incluindo leitura posterior dos agendamentos.
- Nenhuma cobrança, mensagem de teste a clientes ou alteração de pedidos reais. Se não houver ambiente isolado disponível, declarar essa limitação e não apresentar o pagamento completo como homologado.

## Escopo
Somente o problema de agendamentos alterados por checkout não pago; demais pendências do projeto ficam fora deste ajuste.