# Sistema de Ilustrador (Illustrator)

## 1. Banco de dados

Migração única criando:

- `public.illustrators`
  - `id uuid pk default gen_random_uuid()`
  - `name text not null unique`
  - `created_at timestamptz not null default now()`
- GRANTs: `SELECT` para `anon` e `authenticated` (lista é pública, aparece no filtro do site); `INSERT` para `authenticated` (validado por policy de admin); `ALL` para `service_role`.
- RLS habilitado:
  - `SELECT` para todos (`using (true)`)
  - `INSERT/UPDATE/DELETE` restritos a admin via `has_role(auth.uid(), 'admin')`
- `public.cards.illustrator_id uuid null references public.illustrators(id) on delete set null`
- Índice `idx_cards_illustrator_id` parcial (where not null).
- Seed com os ~230 nomes fornecidos (`INSERT ... ON CONFLICT (name) DO NOTHING`).

## 2. Server functions

Novo arquivo `src/lib/illustrators.functions.ts`:

- `listIllustrators()` — público; retorna `{ id, name, card_count }` ordenado por nome. Usa client publishable no servidor com um LEFT JOIN agregado (view/RPC simples ou duas queries + merge).
- `createIllustrator({ name })` — admin only (`requireSupabaseAuth` + checagem de role via `context.supabase`); trim + case-insensitive uniqueness; devolve linha existente se já houver.

Tipos regenerados automaticamente após a migração.

## 3. Admin — cadastro/edição de cartas (`src/routes/admin.manage-cards.tsx`)

- Novo campo "Ilustrador" no formulário de criar/editar carta e no Quick Edit.
- Componente `IllustratorCombobox` (novo, em `src/components/admin/IllustratorCombobox.tsx`) usando `Command`/`Popover` do shadcn já presentes no projeto:
  - Busca por texto (filtro client-side sobre a lista carregada).
  - Item "+ Criar '<texto>'" quando não há match exato — chama `createIllustrator` e seleciona automaticamente.
  - Opção de limpar seleção.
- Salva `illustrator_id` no insert/update de cartas (adicionar campo ao payload existente).

## 4. Catálogo público — filtro

- Em `src/components/catalog/Filters.tsx`, adicionar seção "Ilustrador":
  - Multi-select com busca (mesmo `IllustratorCombobox` em modo multi, ou um `Command` inline com checkboxes) exibindo `Nome (N)` — contagem vinda de `listIllustrators`.
  - Chips dos selecionados removíveis.
- Estender `FilterState` com `illustratorIds: string[]` e propagar em `useCardsCatalog` para filtrar as cartas por `illustrator_id`.
- Contagem total de cartas encontradas continua usando o mecanismo atual.
- Reset limpa também `illustratorIds`.

## 5. UX / detalhes

- Ordem alfabética (pt-BR, `localeCompare`) em dropdown do admin e no filtro.
- Contagem por ilustrador exibida no filtro do site (não no admin).
- Componentes shadcn existentes; sem novas dependências.
- Sem alterações em SEO/rotas.

## Fora de escopo

- Página dedicada por ilustrador (`/ilustrador/$slug`) — posso adicionar depois se quiser.
- Exibir ilustrador na página pública da carta (posso incluir se pedir; hoje não está listado).
