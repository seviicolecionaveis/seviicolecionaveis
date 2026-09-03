# 🛠️ Ajustes Necessários no Painel Sevii Colecionáveis (Lovable)

Este documento contém os ajustes prioritários para integração perfeita entre o painel e o bot WhatsApp (`bot_seviicolecionaveis`).

---

## 1. Criar Endpoint de Sincronização Automática de Grupos: `POST /api/public/bot/groups/upsert`

### Contexto:
Atualmente, para um grupo de WhatsApp aparecer no painel, é necessário:
1. Ir em `/admin/conectar-bot` e gerar um código de 10 dígitos;
2. Enviar `!ativar <codigo>` no grupo do WhatsApp.

Para que o bot envie **automaticamente** todos os grupos que ele participa para o painel (sem depender de digitação manual de código a cada novo grupo), precisamos da rota de upsert automático.

### Especificação da Rota:
- **Método:** `POST`
- **Caminho:** `/api/public/bot/groups/upsert`
- **Header Obrigatório:** `x-bot-secret: <BOT_API_SECRET>`
- **Payload esperado:**
  ```json
  {
    "groups": [
      {
        "jid": "120363431037710322@g.us",
        "name": "teste grupo sevii",
        "participants_count": 3,
        "is_active": true
      }
    ]
  }
  ```
  *(Também deve aceitar payload de um único grupo: `{ "jid": "...", "name": "..." }`)*

### Ação no Banco de Dados:
- Fazer `upsert` na tabela `bot_groups` usando a coluna `group_jid` (ou `jid`) como chave única (`onConflict: "group_jid"`):
  - `group_jid`: `g.jid`
  - `group_name`: `g.name`
  - `group_type`: `g.group_type || 'principal'`
  - `status`: `g.is_active ? 'active' : 'inactive'`
  - `updated_at`: `now()`
- Retornar: `200 { "success": true, "count": X }`.

---

## 2. Confirmação do Grupo Já Ativado

O grupo de teste abaixo já foi ativado com sucesso via código `5451027142` e consta como ativo:
- **JID:** `120363431037710322@g.us`
- **Nome:** `teste grupo sevii`
- **Status:** `active`

Favor confirmar que ele está visível e selecionável:
1. Na listagem de grupos em `/admin/conectar-bot`.
2. No campo de seleção de grupo em `/admin/criar-leilao`.

---

## 3. Fluxo de Lances Aprovados e Pedidos (`orders`)

Na documentação anterior (`leiloes-whatsapp-m.md`), foi apontado que os vencedores do leilão possuem apenas número de telefone e não possuem cadastro obrigatório na tabela `orders`.

### Sugestão de Implementação:
1. No endpoint `GET /api/public/bot/bids/approved`:
   - Já está retornando `{ buyers: [...] }` com `payment_link`.
2. Quando o comprador clicar no `payment_link`, a página de checkout/pagamento deve:
   - Identificar o número de telefone e os lotes arrematados;
   - Permitir que ele preencha os dados de entrega (endereço) e pague via PIX / Cartão, gerando o pedido com status `pago` ou `aguardando_envio`.

---

## Resumo do que Responder para Nós:
1. Confirmação de criação da rota `POST /api/public/bot/groups/upsert`.
2. Confirmação de que o grupo `teste grupo sevii` já está acessível no construtor de leilões.
