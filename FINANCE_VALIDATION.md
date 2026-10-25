# Saldo e reembolsos — implementação e validação

## Implementado
- Meu saldo: valor disponível, reservado e extrato paginado persistido.
- Checkout e pedidos existentes: saldo total/parcial; apenas diferença cobrada; total comercial preservado. Só titular autenticado autoriza saldo, nunca o portador de link de leilão.
- Painel Reembolsos e saldo: criar obrigação por pedido/item, consultar teto, pesquisar/filtrar, renovar/revogar convite, aprovar/recusar, processar/conciliar, registrar comprovante manual, ajustar saldo e consultar auditoria.
- Escolha por fragmento aleatório com hash, sete dias, uso único; crédito automático ou forma original aguardando aprovação.
- Templates reutilizam o envio existente; links secretos são removidos do HTML gravado no log.
- Mercado Pago: chave estável por operação, conferência do pagamento original e consulta de estorno individual. Resultado desconhecido não significa sucesso e mantém obrigação comprometida.
- Caminhos antigos de reembolso são bloqueados para pedidos com tentativas de saldo ou obrigações novas, prevenindo sobreposição.

## Estruturas e acesso
Migrations 0018–0020: customer_credit_accounts, customer_credit_entries, customer_payment_attempts, customer_refunds, customer_finance_audit; orders.store_credit_cents/finance_settled_at; ambiente do provedor persistido por tentativa. Todas as cinco tabelas têm RLS confirmado no backend. Grants limitam cliente a leitura própria e administrador à consulta autorizada; RPCs de escrita somente service_role e administração ativa revalidada. Livro-razão e auditoria são imutáveis. Reservas/captura/liberação e obrigação/escolha usam bloqueios PostgreSQL.

## Executado
- 47 testes Vitest, seis arquivos, todos passaram: alocação, limites, forma original, confirmação exata de estorno, recuperação de pagamentos e regressões de Pix/cartão de pedidos existentes, status e links de leilão.
- PostgreSQL 17 descartável, migrations e dados fictícios: ajustes idempotentes, admin negado, reserva/insuficiência, valor divergente negado, captura única, token nulo/reutilizado/expirado/revogado negado, crédito automático, forma original sem crédito automático, duas parcelas de um item sem exceder teto, devolução mista 1500 saldo/3500 externo, captura total com saldo, liberação única, confirmação tardia negada, histórico imutável e RLS isolado.
- Duas reservas simultâneas de 8000 sobre saldo 10000: uma aceita, outra negada; reservado 8000.
- Navegador autenticado: extrato do próprio usuário e painel/modal administrativo renderizados, sem submissão financeira; capturas inspecionadas.
- Estruturas, coluna de ambiente e RLS confirmados por leitura do backend.
- Última compilação automática: OK.

## Não homologado / limitações
- Nenhum pagamento, crédito real, estorno real ou envio de e-mail financeiro para cliente foi realizado.
- Mercado Pago disponível no projeto não foi confirmado como ambiente de teste; não chamar reembolso usando credenciais de origem desconhecida. Necessário ambiente confirmado de homologação e aplicação isolada para validar checkout, callbacks, estorno e leitura posterior pelas telas com valores reais de teste.
- Templates preparados, mas entrega real de mensagens financeiras não verificada.
- Tentativa cujo resultado de criação externa é desconhecido mantém reserva por segurança; exige conciliação antes de liberar. Não liberar usando apenas expiração local.
- Créditos capturados e atualização do estágio do pedido usam o pipeline idempotente existente em operações separadas; falha intermediária exige retry/conciliador. Não afirmar finalização ponta a ponta homologada.
- O cron autenticado existente agora retoma pedidos pendentes com saldo aprovado ou pagamento complementar confirmado e libera reservas somente após confirmação terminal. Cinco testes cobrem recuperação e falha fechada; tentativas sem referência externa continuam aguardando conciliação.
- Pedidos históricos com vale-presente/cupom ou sem provedor suportado exigem conciliação/manual; não presumir origens monetárias.
- Pesquisa por identificador completo, nome e e-mail implementada; filtro remoto deve ser validado com reembolso real de homologação.
- Não publicado nesta etapa.
