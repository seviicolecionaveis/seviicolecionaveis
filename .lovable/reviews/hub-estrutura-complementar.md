# Confirmação da estrutura complementar do Hub

As regras iniciais foram implementadas e testadas sem alterar pedidos. As páginas e cobranças ainda não foram ativadas.

## Primeira migração proposta
Criar somente registros auxiliares ligados ao **grupo já existente**, sem substituir a Pilha, a OS ou os pedidos:

1. **Andamento do grupo:** ID existente, conta proprietária, situação do agendamento e versão para controle de concorrência. Modalidade, agenda e endereço continuam na estrutura operacional existente.
2. **Andamento de cada pedido do grupo:** referência ao pedido/grupo, status operacional, rastreio, separação e confirmação de recebimento. Campos originais dos leilões permanecem intactos.
3. **Tentativas de pagamento complementar:** grupo, valor em centavos, referência única, número da tentativa, ID Mercado Pago, vencimento e situação. Sem cobrar nem quitar pedidos nesta migração; sem converter taxa em saldo da loja.
4. **Histórico de ações:** grupo, responsável, ação, data e detalhes operacionais; registros não podem ser editados/apagados pelo cliente.

As quatro estruturas terão acesso mínimo e proteção por conta/admin. O cliente não escreverá diretamente status, pagamentos ou histórico. As operações seguintes usarão funções que revalidam o usuário e a permissão dentro da transação; estas estruturas não concedem acesso privilegiado por si só.

## Limites desta autorização
- Sem preencher registros antigos, alterar pedidos/OS, migrar agendamentos, criar cobranças, enviar e-mails ou ligar rotinas automáticas.
- Sem modificar valores, pagamento, estoque, prazo da Pilha, bot ou campos originais de leilões.
- Antes de aplicar, guardar e verificar backup privado das definições afetadas; testar a estrutura e suas permissões em PostgreSQL descartável. Somente aplicar se os testes passarem.
- Esta confirmação autoriza a primeira migração aditiva descrita acima; alterações posteriores de funções existentes serão apresentadas separadamente, conforme o plano.

Depois desta estrutura, implementar as operações seguras, a integração Pix e as páginas reutilizando os serviços existentes.