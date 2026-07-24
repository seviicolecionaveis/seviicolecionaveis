# Sistema de Pré-Venda

Estrutura em 3 partes: botão no header, página pública e painel admin com agendamento automático.

## 1. Banco de dados

Nova migration com duas tabelas:

**`presale_pages`** — cada página de pré-venda
- `slug` (único, para URL `/pre-venda/$slug`)
- `title`
- `is_active` (toggle manual)
- `starts_at` / `ends_at` (agendamento opcional; nulos = sem limite)
- `sort_order`

**`presale_products`** — produtos dentro de cada página
- `page_id` (FK → presale_pages, cascade delete)
- `name`, `description`, `image_url`
- `price_cents`
- `quantity` (interno, só admin)
- `language` (PT/EN/JP/…)
- `release_year`
- `available_from` (data prevista de entrega, informativa)
- `whatsapp_button_text` (default: "Quero reservar o meu!")
- `whatsapp_message_template` (default: `Olá! Vim do site e gostaria de reservar o meu "[nome do produto]".`)
- `sort_order`

**RLS / GRANTs:**
- `anon` + `authenticated`: SELECT apenas em páginas ativas e dentro da janela `starts_at`/`ends_at`, e nos produtos dessas páginas — mas **sem** a coluna `quantity` exposta ao público (via view `presale_products_public` que omite `quantity`, ou policy + fetch com colunas explícitas).
- Admin: ALL via `has_role(auth.uid(), 'admin')`.
- Storage: imagens no bucket existente `card-images` (subpasta `presale/`).

## 2. Página pública

**Rota nova:** `src/routes/pre-venda.$slug.tsx`
- Loader busca a página pelo slug via server fn pública (client publishable), valida ativa + janela; caso contrário, `notFound()`.
- Renderiza lista de produtos: imagem, descrição, preço, idioma/ano/data prevista, botão azul "Quero reservar o meu!" → `https://wa.me/5579981509552?text=<mensagem urlencoded com [nome do produto] substituído>`.
- `head()` com título/description/OG por página.
- **Nunca renderiza `quantity`.**

**Rota índice:** `src/routes/pre-venda.index.tsx`
- Lista todas as pré-vendas ativas no momento.
- Se houver apenas 1 ativa, redireciona para `/pre-venda/$slug`.
- Se 0 ativas, mostra estado vazio ("Nenhuma pré-venda no momento").

## 3. Botão no header

Editar `src/components/SiteNav.tsx` (ou onde vive a barra entre busca e menu) — adicionar botão "Pré-Venda":
- Cor: azul da marca (usar token existente ou adicionar `--brand-blue` em `src/styles.css` se ainda não houver).
- Estilo destacado (fundo sólido azul, texto branco, leve `shadow`/`hover`) para se sobressair sobre os demais links.
- `<Link to="/pre-venda">` — a rota índice cuida do "mais recente vs listagem".
- Só aparece quando existe ao menos uma pré-venda ativa (checagem leve via hook/query cacheada, para não poluir header quando não há campanha).

## 4. Painel Admin

**Nova rota:** `src/routes/admin.pre-venda.tsx` + adicionar em `NAV_GROUPS` de `src/routes/admin.tsx` no grupo **Marketing**.

**Listagem:**
- Todas as páginas com badge de status (Ativa / Agendada / Encerrada / Desativada — derivado de `is_active` + janela de datas).
- Ações: editar, duplicar, ativar/desativar (toggle), excluir.

**Form de página:**
- Slug, título, toggle `is_active`, datepickers `starts_at`/`ends_at`.
- Sub-form repetível de produtos com todos os campos acima (incluindo `quantity` visível só aqui), upload de imagem via storage, reordenação.

**Server fns:** `src/lib/presale.functions.ts` (público: listar ativas, obter por slug — sem quantity) + `src/lib/admin-presale.functions.ts` (admin CRUD com `requireSupabaseAuth` + checagem `has_role`).

## 5. Ativação automática (sem cron)

Não requer job — a validação de janela é feita **na leitura**:
- Fetches públicos aplicam `WHERE is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`.
- Isso garante ativação/desativação no horário sem intervenção. O botão do header consulta a mesma regra.

## Detalhes técnicos

- Encoding da mensagem WhatsApp: `encodeURIComponent` no client, com substituição de `[nome do produto]`.
- Preços em `cents` (padrão do projeto).
- Imagens: reutilizar bucket `card-images` público existente.
- `quantity` **nunca** é retornado pelas server fns/queries públicas (projeção explícita de colunas).
- SEO: `head()` por página com `og:image` = imagem do primeiro produto (URL absoluta https).

## Fora do escopo (confirmar depois)

- Não cria checkout/pagamento — reserva é 100% via WhatsApp.
- Não decrementa `quantity` automaticamente (é controle interno; admin ajusta manualmente conforme confirmações no WhatsApp).
