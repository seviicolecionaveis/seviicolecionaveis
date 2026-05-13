## Pop-up de Boas-vindas — Trainer

Vou criar um novo componente `WelcomeDialog` (separado do `PaymentNoticeDialog` existente) que aparece ao entrar na página inicial (`/`), com visual profissional e temático Pokémon.

### Comportamento
- Abre automaticamente ~400ms após carregar a home
- Aparece **uma vez por sessão** (usa `sessionStorage` com a chave `welcome-dialog-dismissed`) — não incomoda a cada navegação
- Fecha pelo botão "Vamos lá!" ou pelo X padrão do dialog

### Conteúdo
- **Ícone:** Pokébola/Sparkles em destaque no topo, dentro de um círculo com gradiente da marca (brand-gold)
- **Título:** *Bem-vindo, Trainer!*
- **Mensagem:** "Nosso site está em fase de implementação e podem ocorrer alguns erros, mas não desanime!"
- **Bloco de contato destacado:** caixa suave com ícone de e-mail + link clicável para `seviicolecionaveis@gmail.com` (abre o cliente de e-mail)
- **CTA primário:** botão "Vamos lá!" com a cor da marca

### Estilo
- Componente baseado no `Dialog` do shadcn (mesmo padrão do `PaymentNoticeDialog`)
- Usa apenas tokens semânticos do design system (`bg-primary`, `text-foreground`, `brand-gold`, etc.) — nada hardcoded
- Largura `sm:max-w-md`, cantos arredondados, espaçamento generoso
- Texto centralizado, tipografia já definida no projeto

### Arquivos
1. **Criar** `src/components/WelcomeDialog.tsx` — novo componente
2. **Editar** `src/routes/index.tsx` — importar e renderizar `<WelcomeDialog />` dentro de `Index` (perto do `CardModal`/`CartDrawer`)

Sem mudanças de backend, banco ou rotas.