
## Objetivo

Criar uma nova seção **Acessórios** no site, posicionada no menu entre **Ímãs** e **Selados**, seguindo o mesmo padrão usado em Selados (vitrine pública + área admin para cadastrar produtos), mas com uma **categoria** obrigatória por produto.

Categorias disponíveis:
- Sleeves/Shields
- Dados
- Marcadores de dano
- Moedas
- Playmats
- Binders
- Top Loader
- Deck box
- Kit jogável

## Mudanças

### 1. Banco de dados (migração)
Nova tabela `public.accessories` (mesma estrutura de `sealed_products` + coluna `category`):
- `title`, `description`, `price_cents`, `stock`, `images[]`, `active`, `sort_order`, `category` (text com CHECK das 9 categorias)
- GRANTs para anon (SELECT) / authenticated / service_role
- RLS: "Anyone can view active accessories" (active=true ou admin) + "Admins manage accessories"
- Trigger `update_updated_at`

### 2. Frontend público — `src/routes/acessorios.tsx`
- Estrutura igual à página Selados: header com `SiteNav`, grid de cards, modal ao clicar
- Adicional: barra de filtro por categoria (chips "Todos" + as 9 categorias)
- Carregamento via `supabase.from("accessories")...eq("active", true)`
- SEO: title/description próprios

### 3. Modal — `src/components/catalog/AccessoryModal.tsx`
- Cópia do `SealedModal` adaptada: exibe a categoria abaixo do título
- Ao adicionar ao carrinho usa `id: accessory:<id>`, `collection: "Acessório"`, `finish: <categoria>`

### 4. Navegação — `src/components/SiteNav.tsx`
Inserir item `{ to: "/acessorios", label: "Acessórios" }` entre Ímãs e Selados.

### 5. Admin — `src/routes/admin.accessories.tsx`
Cópia do `admin.sealed.tsx` com:
- Lista de produtos com capa, título, preço, estoque, **categoria**
- Botões "Novo acessório", editar, remover, reordenar
- Editor (modal) com campos: título, descrição, preço, estoque, ativo, **select de categoria (obrigatório)**, gerenciador de imagens (upload + URL, igual ao Sealed)

### 6. Link no header do admin — `src/routes/admin.tsx`
Adicionar `<Link to="/admin/accessories">Acessórios</Link>` na barra de navegação do admin, próximo a "Selados".

## Detalhes técnicos

- Imagens reutilizam o bucket público `card-images` em pasta `accessories/`
- A categoria entra no banco como `text` com `CHECK (category IN (...))` para garantir consistência sem precisar de enum
- A página `/acessorios` segue o padrão SSR/route-tree (será detectada automaticamente pelo plugin TanStack; `routeTree.gen.ts` é regenerado)
- Nenhuma alteração no fluxo de checkout/orders: produtos viram itens do carrinho com `cardId="accessory:<uuid>"` (mesmo padrão dos selados, que já é tratado em `orders.server.ts` / `payments.server.ts`)
