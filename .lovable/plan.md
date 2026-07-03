## Objetivo

Transformar cada produto lacrado numa página completa e compartilhável (URL própria, SEO, zoom de imagem), no lugar do modal atual.

## O que muda

### 1. Nova rota `/produtos-lacrados/$slug`
- Arquivo: `src/routes/produtos-lacrados.$slug.tsx`
- `loader` busca o produto em `sealed_products` por slug (via server function nova)
- `head()` dinâmico com título, descrição, canonical, `og:title`, `og:description`, `og:image` (primeira imagem do produto), `twitter:card=summary_large_image` e JSON-LD `Product` (nome, imagens, preço, disponibilidade, SKU)
- Layout de página inteira (não modal), reutilizando `SiteNav` + `SiteFooter`:
  - Galeria à esquerda: imagem principal grande + miniaturas
  - Clique na imagem principal abre **lightbox de zoom** (overlay fullscreen, arrastar/pinch em mobile, roda do mouse em desktop, setas para navegar entre imagens)
  - À direita: título, badge de pré-venda, descrição, tabela de specs (SKU, produto, coleção, idioma, distribuição, condição, faixa etária), preço, seletor de quantidade, botão "Adicionar ao carrinho"/"Reservar pré-venda"
  - Botão "Compartilhar no WhatsApp" + botão "Copiar link"
  - Breadcrumb: Início → Produtos Lacrados → [nome]

### 2. Slug
- Adicionar helper `sealedSlug(title, id)` em `src/lib/slug.ts` (reusa `slugify`), com sufixo curto do id para garantir unicidade
- Não altera o banco — slug é derivado do `title` na exibição/lookup

### 3. Listagem `/produtos-lacrados`
- Trocar `onClick={() => setActive(p)}` por `<Link to="/produtos-lacrados/$slug" params={{ slug }}>`
- Remover `SealedModal` e o estado `active`
- Mantém grid, badges, thumbnails, ordenação

### 4. Server function
- `src/lib/sealed.functions.ts` novo: `getSealedBySlug({ slug })` — busca todos os produtos ativos, encontra por slug derivado, retorna o registro completo. Usado pelo `loader`.

### 5. Compartilhamento
- URL canônica: `https://seviicolecionaveis.com.br/produtos-lacrados/<slug>`
- WhatsApp: mesma UX do modal atual, mas com URL da página do produto
- Botão adicional "Copiar link"

### 6. Compatibilidade
- `SealedModal.tsx` deixa de ser usado na listagem; mantenho o arquivo (usado potencialmente em outros pontos como `NewArrivals`) para não quebrar. Se quiser, posso migrar `NewArrivals` também para linkar para a nova página em vez de abrir modal — confirmo antes.
- Sitemap: incluir cada produto lacrado ativo em `src/lib/sitemap.server.ts`

## Fora do escopo (não vou mexer)
- Painel admin de produtos lacrados
- Estrutura da tabela `sealed_products`
- Modal de cartas (`CardModal`)

## Confirmação
Devo também trocar o clique no card de "Novidades" (`NewArrivals`) para levar à nova página do produto em vez de abrir o modal?
