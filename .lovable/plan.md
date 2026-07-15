## Escopo

Implementar as 5 features em ordem de dependência, cada uma isolada para poder revisar/pausar entre elas.

---

### 1. Bundle "Complete a coleção" (item 2)

**Como funciona pro cliente:**
- Na página de cada coleção (`/colecao/$slug`), aparece um card no topo: "Você tem X de Y cartas desta coleção. Complete agora com R$ ZZ,ZZ (10% off)."
- Botão adiciona todas as cartas faltantes em estoque ao carrinho de uma vez, aplicando desconto automático.

**Backend:**
- Nova tabela `collection_bundles` (opcional — se quiser controle manual do desconto por coleção; caso contrário aplicar % fixo).
- Server function `getCollectionCompletion({ collectionSlug })` que retorna: cartas do cliente (via `orders`), cartas faltantes em estoque, preço total e preço com desconto.
- Cupom automático interno (não visível) aplicado no checkout quando o bundle é usado.

**UI:** Novo componente `CollectionCompletionCard` em `src/components/catalog/`.

---

### 2. Wishlist compartilhável (item 5)

- Adicionar coluna `share_token` (uuid, único) na tabela `wishlist` ou criar tabela `wishlist_shares` (user_id, token, created_at).
- Nova rota pública `/lista/$token` — mostra a wishlist do usuário sem exigir login.
- Botão "Compartilhar minha lista" na aba de favoritos (`/favoritos`) que copia o link.
- Meta OG dinâmico (nome do usuário + qtd cartas) pra ficar bonito no WhatsApp.
- RLS: qualquer um pode ler wishlist pelo token; só o dono edita.

---

### 3. Deck builder (item 6)

**Escopo mínimo (v1):**
- Nova rota `/deck-builder` (autenticada).
- Cliente monta um deck de até 60 cartas (regra do TCG) escolhendo do catálogo.
- Persistência em nova tabela `decks` (id, user_id, name, format, created_at, updated_at) e `deck_cards` (deck_id, card_id, quantity).
- Exibe: total de cartas, distribuição por tipo (usa `pokemon_type`/`category`), custo pra comprar as que faltam no estoque da loja.
- Botão "Adicionar faltantes ao carrinho".
- Compartilhamento por link público (mesma lógica da wishlist).

**Não incluído no v1:** validação de regras oficiais (limite de 4 por carta com mesmo nome, etc.) — pode virar v2.

---

### 4. Histórico público de preço (item 7)

- Já temos `card_price_watch` com histórico. Criar rota pública `/carta/$slug/preco` (ou seção dentro de `/carta/$slug`) com:
  - Gráfico de linha (recharts, já instalado) mostrando `price_cents` ao longo do tempo.
  - Preço atual, mínimo histórico, máximo histórico, variação 30d.
  - Comparação: preço na Sevii vs preço no Liga Pokémon (via `card_prices`).
- Server function pública que retorna apenas dados não sensíveis.
- SEO: meta description dinâmica "Histórico de preço da carta X — R$ Y hoje".

---

### 5. PWA instalável (item 10)

- Apenas manifest-only (não offline): "Adicionar à tela inicial" no celular.
- Criar `public/manifest.webmanifest` com nome, ícones, theme color da marca (roxo Sevii), `display: standalone`.
- Adicionar `<link rel="manifest">` e `<meta name="theme-color">` em `src/routes/__root.tsx`.
- Gerar ícones (192x192, 512x512, apple-touch-icon 180x180) via imagegen com logo Sevii.
- **Não** adicionar service worker (push notifications já usa um separado — não mexo nele).

---

## Ordem de execução

Vou implementar **1 → 2 → 4 → 5 → 3** (deixando o deck builder por último por ser o mais complexo). Cada etapa termina com um checkpoint pra você testar antes da próxima.

## Alterações no banco (resumo)

- `wishlist`: adicionar `share_token uuid unique`
- `decks`, `deck_cards`: novas tabelas com RLS + GRANTs
- (Opcional) `collection_bundles`: se quiser desconto configurável por coleção

## Estimativa de arquivos

~15-20 arquivos novos, ~5 editados, 3 migrations.

Posso começar?