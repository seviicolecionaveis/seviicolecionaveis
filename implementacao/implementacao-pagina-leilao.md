# Especificação de Implementação: Sistema de Leilões WhatsApp (Painel Sevii Colecionáveis)

Este documento descreve detalhadamente a arquitetura de **banco de dados, páginas administrativas, componentes e endpoints de API** que o **Lovable** deve implementar no projeto **Sevii Colecionáveis** (`https://zuypkggpecsqormwculg.supabase.co`) para operar leilões integrados ao bot WhatsApp **`bot_seviicolecionaveis`**.

---

## 1. Visão Geral do Ciclo de Vida do Leilão

```
[Painel Admin: /admin/criar-leilao]
          │
          ▼ 1. Salva Leilão + Itens + Agendamento (auction_schedules)
[Supabase Database]
          ▲
          │ 2. Bot consulta GET /api/public/bot/schedules/pending a cada 60s
[bot_seviicolecionaveis (VPS)]
          │
          ▼ 3. Na hora marcada:
             - Tranca o grupo do WhatsApp para mensagens de membros
             - Envia fotos e mensagens de abertura do leilão
             - Envia as enquetes interativas para cada lote/item
             - Fica escutando os votos em tempo real via WUZAPI Webhook
          │
          ▼ 4. No horário de encerramento (ou encerramento manual):
             - Fecha as enquetes
             - Mapeia os LIDs para telefones reais (resolverParaPN)
             - Envia resumo de encerramento no grupo do WhatsApp
             - Envia lances consolidados para POST /api/public/bot/bids/create
          │
[Painel Admin: /admin/acompanhar-leilao]
          │ 5. Operador confere os vencedores e clica em "Aprovar Lances"
          ▼
[bot_seviicolecionaveis]
          │ 6. Bot detecta lances aprovados:
          │    - Anuncia os vencedores no grupo (@telefone)
          │    - Envia mensagem privada (PV) para cada vencedor com link de pagamento
```

---

## 2. Modelagem do Banco de Dados no Supabase

O Lovable deve aplicar as migrations abaixo no Supabase:

### 2.1 Tabela `auctions` (Leilões)
```sql
CREATE TABLE IF NOT EXISTS public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  group_jid TEXT NOT NULL, -- Ex: 120363XXXXXXXXXX@g.us
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, live, finished, cancelled
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  closing_message TEXT DEFAULT 'Os links de pagamento foram enviados no privado!',
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total service_role auctions" ON public.auctions USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
```

### 2.2 Tabela `auction_items` (Itens/Lotes do Leilão)
```sql
CREATE TABLE IF NOT EXISTS public.auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  sequence INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starting_price NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  bid_increment NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  buyout_price NUMERIC(10, 2), -- Valor fixo de compra imediata (opcional)
  quantity INT NOT NULL DEFAULT 1,
  winner_phone TEXT,
  winner_name TEXT,
  final_bid NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, sold, unsold
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total service_role auction_items" ON public.auction_items USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_items;
```

### 2.3 Tabela `auction_schedules` (Disparos Automatizados do Bot)
```sql
CREATE TABLE IF NOT EXISTS public.auction_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- START, CLOSE, REMINDER
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  group_jid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, done, error
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auction_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total service_role auction_schedules" ON public.auction_schedules USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_schedules;
```

### 2.4 Tabela `auction_bids` (Lances e Votos Consolidados)
```sql
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.auction_items(id) ON DELETE SET NULL,
  sequence INT NOT NULL DEFAULT 1,
  item_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  bidder_name TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, order_created
  order_id UUID, -- Relacionamento com a tabela de pedidos após aprovação
  announced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total service_role auction_bids" ON public.auction_bids USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
```

### 2.5 Storage Bucket para Fotos das Cartas/Itens
- Bucket público: `auction-images`
- Acesso público para leitura de imagens.

---

## 3. Páginas Administrativas que o Lovable Deve Criar

### 3.1 Página `/admin/leiloes` (Listagem e Gestão)
- **Header:** Título "Leilões WhatsApp", badge de status geral e botão "+ Criar Novo Leilão".
- **Tabs de Filtro:** Todos | Ao Vivo 🔴 | Agendados ⏳ | Concluídos ✅.
- **Card de Cada Leilão:**
  - Número e Título: `Leilão #1 — Especiais de Fim de Semana`
  - Grupo WhatsApp associado (nome do grupo obtido da `bot_groups`).
  - Total de Itens / Lotes cadastrados.
  - Data e Hora de Abertura e Encerramento.
  - Badge de Status (`Ao Vivo`, `Agendado`, `Finalizado`).
  - Ações:
    - **Acompanhar Ao Vivo** (link para `/admin/acompanhar-leilao?id=...`).
    - **Editar Leilão** (se status `draft` ou `scheduled`).
    - **Excluir** (se não tiver sido disparado).

### 3.2 Página `/admin/criar-leilao` (Formulário de Cadastro)
1. **Dados Gerais:**
   - Título do leilão.
   - Seleção do Grupo de Destino (dropdown puxando os grupos ativos de `bot_groups`).
   - Data e Hora de Início (`scheduled_start`).
   - Data e Hora de Término (`scheduled_end`).
   - Mensagem personalizada de encerramento (`closing_message`).
2. **Construtor de Lotes / Itens:**
   - Botão "+ Adicionar Lote".
   - Upload de foto da carta/item (salva no bucket `auction-images`).
   - Nome do Item (ex: *Charizard VMax Ultra Rara*).
   - Descrição / Condição (ex: *NM - Edição Darkness Ablaze*).
   - Lance Inicial (R$) (padrão: R$ 1,00).
   - Incremento de Lance (R$) (padrão: R$ 2,00).
   - Valor Fixo de Arremate / Buyout (opcional).
   - Botão para reordenar sequência (subir / descer).
3. **Ações:**
   - **Salvar Rascunho:** Salva com `status = 'draft'`.
   - **Programar Leilão:** Valida todos os campos, salva o leilão com `status = 'scheduled'` e insere automaticamente os registros de agendamento em `auction_schedules` (ação `START` e `CLOSE`).

### 3.3 Página `/admin/acompanhar-leilao` (Painel em Tempo Real)
- **Cabeçalho:**
  - Cronômetro regressivo até o encerramento.
  - Indicador de status ao vivo 🔴.
  - Botão de Ação: **"Encerrar Leilão Manualmente"** (cria um agendamento imediato de `CLOSE` ou envia comando direto ao bot).
- **Grid de Lotes:**
  - Card visual para cada item com foto, título e sequência.
  - Lance Atual / Valor Vencedor.
  - Telefone do Arrematante parcial.
  - Histórico de lances recebidos.
- **Painel de Pós-Leilão (quando `status === 'finished'`):**
  - Tabela com todos os lances recebidos enviados pelo bot via `bids/create`.
  - Botão **"Aprovar Todos os Arremates"**:
    - Converte os lances em pedidos oficiais (tabela `orders`).
    - Atualiza os lances para `approved`.
    - Dispara notificação para o bot avisar os clientes com os links de pagamento no privado e marcar a lista no grupo.

---

## 4. Endpoints de API que o Lovable Deve Implementar

Todas as rotas devem validar o header `x-bot-secret: <BOT_API_SECRET>`.

### 4.1 `GET /api/public/bot/schedules/pending`
- **Consulta:** Agendamentos em `auction_schedules` onde `status = 'pending'` e `scheduled_time <= NOW()`.
- **Resposta:**
  ```json
  {
    "schedules": [
      {
        "id": "schedule-uuid",
        "auction_id": "auction-uuid",
        "action": "START", // ou CLOSE
        "group_jid": "120363XXXXXXXXXX@g.us",
        "auction": {
          "auction_number": 1,
          "title": "Leilão Sevii #1",
          "closing_message": "Parabéns aos vencedores! Pagamentos no PV.",
          "items": [
            {
              "id": "item-uuid",
              "sequence": 1,
              "name": "Pikachu Illustrator Promo",
              "description": "Carta Graduada PSA 9",
              "image_url": "https://zuypkggpecsqormwculg.supabase.co/storage/v1/object/public/auction-images/pikachu.jpg",
              "starting_price": 50,
              "bid_increment": 5,
              "buyout_price": null
            }
          ]
        }
      }
    ]
  }
  ```

### 4.2 `POST /api/public/bot/schedules/:id/mark`
- **Ação:** Atualiza o status do agendamento para `sending`, `done` ou `error`.
- **Payload:** `{ "action": "done" }`.

### 4.3 `GET /api/public/bot/auctions/:id`
- **Ação:** Retorna todos os dados detalhados de um leilão e seus itens.

### 4.4 `POST /api/public/bot/bids/create`
- **Ação:** Inserção dos lances/vencedores apurados pelo bot ao fechar o leilão.
- **Payload:**
  ```json
  {
    "auctionId": "auction-uuid",
    "auctionNumber": 1,
    "bids": [
      {
        "phone": "5547992671477",
        "item_name": "Pikachu Illustrator Promo",
        "amount": 75,
        "sequence": 1
      }
    ]
  }
  ```
- **Lógica interna:** Insere em `auction_bids` e atualiza `auction_items.winner_phone`, `final_bid` e `status = 'sold'`. Atualiza o leilão para `status = 'finished'`.

### 4.5 `GET /api/public/bot/bids/approved`
- **Ação:** Retorna compradores com lances aprovados que ainda não foram anunciados (`announced = false`).
- **Resposta:**
  ```json
  {
    "buyers": [
      {
        "phone": "5547992671477",
        "group_jid": "120363XXXXXXXXXX@g.us",
        "order_number": "1042",
        "payment_link": "https://seviicolecionaveis.com.br/pay/uuid-pedido",
        "items": [
          { "item_name": "Pikachu Illustrator Promo", "amount": 75 }
        ]
      }
    ]
  }
  ```

### 4.6 `POST /api/public/bot/bids/mark`
- **Ação:** Marca os lances como anunciados pelo bot (`announced = true`).
- **Payload:** `{ "auctionId": "auction-uuid", "phones": ["5547992671477"] }`.

---

## 5. Checklist de Entrega para o Lovable

O Lovable deve confirmar que:
1. Criou as 4 tabelas de leilão no Supabase (`auctions`, `auction_items`, `auction_schedules`, `auction_bids`).
2. Criou o bucket de Storage `auction-images` com acesso público.
3. Criou as rotas visuais `/admin/leiloes`, `/admin/criar-leilao` e `/admin/acompanhar-leilao`.
4. Criou as rotas de API `/api/public/bot/schedules/pending`, `/api/public/bot/schedules/:id/mark`, `/api/public/bot/bids/create`, `/api/public/bot/bids/approved` e `/api/public/bot/bids/mark`.
5. Informou ao desenvolvedor do bot a URL de produção para testes.
