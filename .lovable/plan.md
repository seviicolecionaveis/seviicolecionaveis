## Objetivo

Criar uma seção completa de **Videogames** no site, começando com Nintendo Switch, seguindo exatamente o mesmo padrão já usado para Acessórios/Selados: tabela própria, admin, catálogo público, carrinho e checkout integrados.

## O que vai ser feito

### 1. Banco de dados
Nova tabela `videogames` (espelha `accessories`) com campos:
- `title`, `description`, `platform` (texto — começa em "Nintendo Switch", aberto para novas), `condition` (Novo / Seminovo / Usado), `region` (opcional), `includes_box`, `price_cents`, `stock`, `images[]`, `sort_order`, `active`.
- RLS: leitura pública dos ativos; escrita restrita a admin.
- GRANTs para `anon` (SELECT dos ativos), `authenticated` e `service_role`.

### 2. Admin
Nova página `/admin/videogames` (baseada em `admin.accessories.tsx`) com:
- Listagem, criar, editar, arquivar/reativar, ordenar.
- Upload de múltiplas imagens (bucket `card-images` já existente).
- Campo de plataforma como select livre (Nintendo Switch por padrão, com opção de adicionar novas plataformas escrevendo).
- Link no menu do admin.

### 3. Catálogo público
- Rota `/videogames` listando os itens ativos, com filtro por plataforma e condição, ordenação por preço/relevância.
- Modal de detalhes (`VideogameModal`) com galeria, descrição, condição, "Adicionar ao carrinho".
- Link no menu principal (SiteNav) e no rodapé.
- SEO próprio (title, description, og:*).

### 4. Carrinho e checkout
- Item entra no carrinho com `cardId = videogame:<uuid>` (mesmo padrão de `accessory:<uuid>`).
- `orders.server.ts` ganha um branch para debitar estoque da tabela `videogames` ao confirmar pagamento.
- Aparece normalmente no e-mail de pedido recebido / atualizações de status.

### 5. Extensibilidade futura
- Como `platform` é texto livre, adicionar PS5 / Xbox / retro no futuro é só cadastrar itens novos com a plataforma desejada — sem migração.

## Detalhes técnicos

- Arquivos novos: migração SQL, `src/routes/admin.videogames.tsx`, `src/routes/videogames.tsx`, `src/components/catalog/VideogameModal.tsx`.
- Arquivos alterados: `src/lib/orders.server.ts` (branch `videogame:`), `src/components/SiteNav.tsx`, `src/components/SiteFooter.tsx`, `src/routes/admin.tsx` (link no menu admin), `src/utils/payments.server.ts` se necessário para exibir metadados.
- Cart hook não precisa mudar — já é agnóstico ao tipo do item, o prefixo do `cardId` identifica.

## Fora do escopo (posso fazer depois se quiser)

- Variações (ex.: cor do console) — hoje cada SKU seria uma linha separada.
- Trade-in / compra de usados dos clientes.
- Página de detalhe SEO-friendly por produto (`/videogames/$slug`) — hoje o padrão do site abre num modal, igual acessórios.

Confirma que posso seguir?
