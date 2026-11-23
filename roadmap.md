## Listas de pedidos sem truncamento
- [x] Expedição corrigida com paginação integral; 14 testes e navegador autenticado computador/celular, sem alterar pedidos.
- [x] Varredura de consultas relacionadas em telas, agrupamento, eventos, MCP e rotinas; limites e riscos registrados no plano.
- [ ] Corrigir leituras relacionadas e avanço das rotinas com testes isolados; aguarda aprovação da ampliação que envolve pagamentos e comunicações. Não executar operações na loja nem alterar pedidos concluídos.

## Hub de Retirada e Envio
- [x] Investigar páginas, grupos, calendários, pagamentos, notificações e permissões existentes sem alterar dados ou fluxos; estrutura consultada em modo somente leitura.
- [x] Plano apresentado e aprovado; leilões pagos somente leitura nos campos originais.
- [x] Regras puras iniciais de elegibilidade, cidade, prazo, reagendamento pago e classificação de Pix implementadas com testes, sem ativar fluxos ou alterar pedidos.
- [x] Primeira estrutura aditiva aplicada após backup e testes isolados (leitura só dono/admin, histórico imutável), sem preencher pedidos.
- [ ] Após aprovação, guardar backup e obter confirmação antes de cada migração; implementar página do cliente e hub admin com operações únicas por grupo.
- [x] Regra definida: cancelamento antecipado de entrega paga reaproveita os R$15 e agenda automaticamente a próxima quinta disponível, permitindo alteração pelo cliente.
- [ ] Entrega em mãos: pagamento somente no site; remover opções/instruções de Pix externo e comprovante no WhatsApp das telas e e-mails, após aprovação.
- [ ] Implementar e testar reagendamento automático de entrega paga sem nova cobrança, após aprovação das mudanças.
- [ ] Validar cenários de pagamento, prazos, acesso, entrega e preservação dos leilões em ambiente isolado; pagamento real exige provedor de teste confirmado.

## Ajuste pontual de Treinadores para R$ 0,99
- [x] Backup dos 997 registros; 33 preços de R$ 0,66–0,98 atualizados para R$ 0,99 (10 Apoiadores, 15 Itens, 2 Ferramentas Pokémon, 6 Estádios). Normal/Reverse Foil/Foil/Shattered Holo; leitura persistida validada, 964 registros fora do escopo conferidos; uma edição simultânea de preço/estoque por admin confirmada nos históricos, sem interferência.

## Ajuste pontual de Apoiadores e listagem de Itens
- [x] Backup verificado; 291 Apoiadores conferidos (266 preços alterados, 25 já no destino), quatro faixas sem cascata com R$ 0,25 na primeira; 93 Itens listados sem alterações. Testes de leitura persistida passaram; uma edição simultânea de estoque por admin foi confirmada no histórico, sem interferir nela.

## Troca de arrematante no painel
- [x] Prévia e confirmação por carta em Pedidos Leilão e Acompanhar Leilão; maior lance anterior de outro cliente, operação atômica de admin e histórico; pedidos pagos/com pagamento iniciado bloqueados e conta de código interno selecionada explicitamente.
- [x] Banco descartável validou transferência, totais, preservação dos demais itens/pedido pago, cancelamento vazio, identificação, autorização, bloqueios, rollback e idempotência; 12 testes existentes de leilões passaram e compilação OK.
- [x] Painel autenticado e prévia real conferidos no computador/celular, sem salvar; histórico real permanece vazio. A transferência foi executada apenas nos testes isolados, não pela tela contra pedidos reais.

## Checkout abandonado e agendamentos anteriores
- [x] Confirmar alteração prematura nos quatro caminhos de criação e ausência de restauração no cancelamento.
- [x] Plano aprovado; intenção protegida persistida nos quatro caminhos, aplicada atomicamente após confirmação paga; seleção inicial vazia, aviso de revisão e recuperação no cron sem repetir finanças.
- [x] 45 testes automatizados passaram; PostgreSQL descartável validou abandono/cancelamento/recusa, seleção explícita, confirmação única, horário expirado, membro indisponível e autorização, preservando financeiro/leilão. Estrutura aplicada conferida, compilação OK.
- [ ] Pagamento completo no navegador com pedidos anteriores: aguarda ambiente de aplicação isolado e provedor comprovadamente de teste. Checkout autenticado com carta real foi aberto sem submeter compra, sem erro e sem transbordamento no celular; lista não apareceu nessa conta, portanto seleção visual com pedidos não foi verificada.

## Eventos ativos nas opções de retirada
- [x] Eventos inativos filtrados no calendário do cliente e no editor mostrado na imagem; 9 testes de eventos passaram e Pilha autenticada mostrou Sevii Day em 21/11 com horários, sem criar solicitação. Verificação adicional identificou teste antigo de frete rastreado incompatível com a regra atual (fora deste ajuste).

## Correção dos locais de retirada na Pilha
- [x] Restaurar Aruana/Aeroporto junto ao calendário; seleção e permanência após escolher horário conferidas com conta conectada, também no celular, sem criar solicitação real.

## Grupos de envio e retirada
- [x] Ler documento atualizado, conferir os vínculos e apresentar plano antes de alterar dados.
- [ ] Aprovação do plano e da atualização dos dados existentes: 43 OS, 41 com pedidos vinculados, 90 pedidos; nenhum pedido em mais de uma OS; 26 pedidos em andamento, 63 entregues e 1 cancelado.
- [ ] Guardar e verificar backup privado; implementar grupos transacionais, seleção de pedidos, taxa única, edição/entrega/reabertura, avisos únicos e reprocessamento confirmado, sem mudar leilões nem a estrutura das OS.
- [ ] Validar os cenários do documento em ambiente isolado e conferir telas de cliente/admin; não executar cobranças nem enviar avisos de teste a clientes reais.

## Integração de Acessórios
- [x] Investigar diferenças de páginas, catálogo, busca, estoque, pedidos e variações; preparar plano sem alterar dados, mantendo regra atual de cancelamento.
- [x] Plano aprovado; backups privados verificados dos 21 acessórios e definições; páginas/catálogo/editores compartilhados, busca integrada, pedidos manuais, reservas/baixa/reposição transacionais por variação, links e sitemap implementados.
- [x] 10 testes automáticos; PostgreSQL descartável validou slugs/histórico, concorrência, idempotência, variações, claim atômico, permissões e auditoria; páginas reais/carrinho/zoom/cópia/celular e cartas/lacrados conferidos, admin com fixtures fictícias.
- [ ] Compra paga completa, pedido manual persistido, Pilha e entrega de aviso de reposição: aguardam backend isolado e credenciais do provedor comprovadamente de teste; não cobrar/enviar e-mails nem alterar pedidos reais.

# Fundo do site
- [ ] Substituir a imagem de fundo quando o usuário enviar o arquivo (medidas combinadas: 360x360 quadrada, PNG com fundo transparente, para o padrão repetido; 1920x1080 se for fundo único).

## Reinado Delta
- [x] Inseridas 141 cartas via dados, sem estoque/preço; Grama → Planta e Escuridão → Sombrio; coleção adicionada.
- [x] Conferidos 141 números únicos de 001/103 a 141/103 e dados persistidos; todas as 141 imagens responderam corretamente, incluindo 138 e 141; página mostra Preço pendente/Indisponível.

# Confirmações de agendamento
## Reembolso no cancelamento de cartas
- [x] Integrar escolha de saldo/forma original ao cancelamento de item na página administrativa do pedido, com quantidade, justificativa e confirmação; formas anteriores preservadas.
- [x] Validar cancelamento e obrigação financeira atômicos em PostgreSQL descartável e fluxo administrativo com fixtures interceptadas; 28 testes existentes passaram, sem estoque, saldo, pedidos ou e-mails reais.
- [x] Aplicar somente estrutura da operação autenticada (migration 0021), sem executar cancelamentos ou valores no banco compartilhado; não publicado.
## Saldo de clientes e reembolsos
- [x] Analisar estrutura atual e apresentar plano de integração financeira segura.
- [x] Implementar saldo/extrato, reservas atômicas e reembolsos parciais com auditoria e permissões existentes; cenários PostgreSQL isolados passaram.
- [x] Integrar escolha segura, painel administrativo, templates de e-mail e processamento/conciliação Mercado Pago; nenhum estorno real executado.
- [x] Integrar pagamento total/parcial no checkout e pedidos existentes, checagem de origem/valor e liberação após estado externo terminal confirmado.
- [x] 47 testes automatizados passaram, incluindo recuperação de pagamentos; banco descartável validou concorrência, uso único, limites, RLS, liberação, captura e reembolsos mistos; extrato/painel autenticados verificados; compilação OK.
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
