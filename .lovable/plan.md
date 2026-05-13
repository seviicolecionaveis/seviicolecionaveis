## Área Pessoal do Trainer

Criar uma área completa do cliente com dados pessoais, pedidos, favoritos e pesquisa pós-compra.

### 1. Banco de dados (migration)

**Estender `profiles`** com campos novos:
- `whatsapp` (text)
- `birth_date` (date)
- `favorite_pokemons` (text[])
- `favorite_categories` (text[])

**Nova tabela `post_purchase_surveys`**:
- `order_id` (uuid, único, ref orders)
- `user_id` (uuid)
- `how_found_us` (text) — Instagram, indicação, Google, etc.
- `satisfaction` (int 1–5)
- `comment` (text, opcional)
- RLS: usuário insere/lê próprio; admin lê tudo

**Atualizar `handle_new_user`** para gravar `whatsapp` e `birth_date` vindos de `raw_user_meta_data`.

### 2. Cadastro (`/auth`)

Adicionar ao formulário de signup:
- WhatsApp (com máscara `(99) 99999-9999`)
- Data de nascimento (input `date`)

Enviar via `options.data` no `signUp` para o trigger persistir no profile.

### 3. Nova rota `/conta` (Área Pessoal)

Layout com **abas/tabs** (shadcn `Tabs`):

```
/conta
 ├─ Visão geral   → resumo + atalhos para pedidos/favoritos
 ├─ Dados pessoais → nome, e-mail (readonly), WhatsApp, nascimento, CPF, senha
 ├─ Preferências   → pokémons favoritos (chips/tags), categorias favoritas (multi-select)
 ├─ Endereços      → CRUD usando tabela `addresses` existente
 ├─ Pedidos        → reaproveita lista de `/orders`
 └─ Favoritos      → reaproveita lista de `/favoritos`
```

Acessível pelo menu do usuário no header (`HeaderActions`), substituindo/complementando os links atuais "Meus pedidos" e "Meus favoritos" por **"Minha conta"** que cai em `/conta`.

### 4. Pesquisa pós-compra

- Componente `PostPurchaseSurvey` exibido em `/orders/$orderId` quando:
  - status = `paid`
  - ainda não há survey para o pedido
- Modal/card com:
  - "Como nos encontrou?" (select: Instagram, TikTok, Google, Indicação, Outro)
  - Satisfação (5 estrelas)
  - Comentário (textarea opcional)
- Botão "Pular" também marca como respondido (insere com valores nulos exceto how_found_us=`skipped`) para não reaparecer.

### 5. Componentes/arquivos

**Criar:**
- `src/routes/conta.tsx` (layout com Tabs)
- `src/components/account/PersonalDataForm.tsx`
- `src/components/account/PreferencesForm.tsx`
- `src/components/account/AddressesManager.tsx`
- `src/components/PostPurchaseSurvey.tsx`

**Editar:**
- `src/components/HeaderActions.tsx` — adicionar link "Minha conta"
- `src/routes/auth.tsx` — campos WhatsApp + nascimento
- `src/routes/orders.$orderId.tsx` — montar `<PostPurchaseSurvey />`

### Observações técnicas

- Tudo client-side com `supabase` (RLS já garante isolamento).
- Lista fixa de categorias = mesma usada nos filtros (Pokémon, Treinador, Energia…).
- Pokémons favoritos: input de tags livre (sem catálogo externo) — simples e rápido.
- E-mail é readonly (mudança de e-mail exige fluxo Supabase separado, fora do escopo).
- Senha: botão "Alterar senha" abre mini-form usando `supabase.auth.updateUser({ password })`.

Posso seguir?
