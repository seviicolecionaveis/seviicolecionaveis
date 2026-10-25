# Confirmações de agendamento
## Saldo de clientes e reembolsos
- [x] Analisar estrutura atual e apresentar plano de integração financeira segura.
- [x] Implementar saldo/extrato, reservas atômicas e reembolsos parciais com auditoria e permissões existentes; cenários PostgreSQL isolados passaram.
- [x] Integrar escolha segura, painel administrativo, templates de e-mail e processamento/conciliação Mercado Pago; nenhum estorno real executado.
- [x] Integrar pagamento total/parcial no checkout e pedidos existentes, checagem de origem/valor e liberação após estado externo terminal confirmado.
- [x] 42 testes automatizados passaram; banco descartável validou concorrência, uso único, limites, RLS, liberação, captura e reembolsos mistos; extrato/painel autenticados verificados; compilação OK.
- [ ] Homologação ponta a ponta de pagamento complementar/estorno e entrega de e-mails: aguarda ambiente Mercado Pago confirmado como teste e backend de aplicação isolado (o atual é compartilhado com a loja). Não publicar como financeiramente homologado antes disso.
- [ ] Tentativas com criação externa de resultado desconhecido mantêm saldo reservado por segurança; dependem da conciliação do pagamento no provedor antes de liberar. Não liberar por prazo local.
## MCP administrativo pelo ChatGPT
- [x] 10 ferramentas de escrita (pedido, status, rastreio, produto, estoque, leilão, cliente) com admin revalidado, auditoria, idempotência e confirmação vinculada; 19 ferramentas no catálogo; 32 testes.
- [ ] Escritas reais: aguardam ambiente de testes isolado (o backend atual é o mesmo da loja) e republicação.
- [ ] Correção recebida: auditar operações do painel, adicionar escritas reais reutilizando regras, confirmação/idempotência/auditoria, testar em ambiente isolado e publicar somente após validação; entregar cobertura e limites.
- [ ] Inspecionar implementação existente e configurar OAuth gerenciado preservando o login do site.
- [ ] Usar SDK MCP com consultas via permissões atuais, autorização por chamada e auditoria segura.
- [ ] Testar admins existentes sem personificação, remoção/inclusão simuladas e bloqueio de usuários comuns.
- [ ] Verificar consentimento e catálogo, entregar instruções de conexão e limites de validação externa.
## Pix e vinculação de leilões
- [x] Diagnosticar: Pix ignorava CPF do perfil; telefone escolhia arbitrariamente contas e mesclava pedidos pagos.
- [x] Correspondência única, CPF do dono recuperado no pagamento, links exclusivos com hash; atualizados nome/e-mail de 15 pedidos pendentes, sem alterar valores ou itens. Quatro pedidos não têm conta correspondente.
- [x] 14 testes: CPF, telefone, ausência, ambiguidade de vínculo, links inválidos/expirados, autorização, pedidos pagos e cartão simulado.
- [x] Pix real gerado pelo link copiado no admin sem login, QR e copia e cola persistidos para #0FB6E2B5 (R$75), ainda pendente; nenhum pagamento efetuado.
- [ ] Aprovação real de pagamento e cartão: aguardam transação autorizada pelo responsável; cartão apenas simulado, pipeline de confirmação preservado.
- [ ] Novos links devem ser reenviados após publicação; links antigos continuam exigindo login. Quatro clientes sem correspondência aguardam confirmação segura pela loja; sem mesclar por telefone editável no perfil.
## Preços de Estádio
- [x] Ajustar faixas por preço original: 82 preços alterados e todos os 127 cadastros verificados; estoque preservado.
- [x] Entregar listagem das 33 variantes com preço original a partir de R$ 0,51 sem alterações; planilha conferida visualmente.
## Confirmação de recebimento pelo comprador
- [x] Botão discreto e confirmação acessível; Cancelar, X, Esc e clique fora verificados, sem alteração.
- [x] Validação de dono/status com atualização atômica, data/hora/usuário persistidos e visíveis no admin.
- [x] Aviso à loja enviado, 12 testes passando e fluxo autenticado verificado em celular/computador com pedido temporário sem cobrança.
## Status de pedidos
- [x] Adicionar os três status ao painel e ao acompanhamento, preservando pagamento e estoque; testes passando e opções verificadas no painel autenticado.

- [x] E-mail da loja configurável no painel.
- [x] Confirmação de entrega/retirada para cliente e loja, com dados do pedido após pagamento confirmado.
- [x] Link de criação rápida no Google Calendar no e-mail da loja.
- [x] Testes de envio/dados e leitura autenticada no painel.
- [ ] Destinatário da loja: aguarda preenchimento em Admin → E-mails.
- [ ] Confirmar recebimento real: aguarda pedido agendado pago; nenhum pedido desse tipo existe ainda.
## Hub de Eventos (Retirada em eventos)
- [x] Tabela de eventos + vínculo no pedido e na ordem de serviço (pilha).
- [x] Admin /admin/eventos: criar/editar/desativar/excluir, lista + calendário, pedidos por evento com impressão, aviso com contagem de pedidos e e-mail aos clientes.
- [x] Calendário de eventos no checkout e na Pilha (dias em azul, blocos de 1h, fecha 24h antes, validado no servidor).
- [x] Confirmações por e-mail (cliente + loja com Google Calendar) para agendamentos de evento.
- [x] Reabertura às 10h do dia seguinte ao fim do evento (cron diário 13h01 UTC), histórico "Não compareceu", e-mail com WhatsApp, reagendamento na página do pedido (retirada em mãos ou outro evento).
- [x] Testado no navegador: evento criado no admin aparece no checkout com dia e horários.
- [ ] Publicar o site para valer em produção.
