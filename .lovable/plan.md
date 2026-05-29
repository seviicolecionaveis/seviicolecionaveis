Adicionar um link "Sobre os Tipos de Carta" no modal de detalhe da carta (`src/components/catalog/CardModal.tsx`), logo abaixo da linha "X idiomas · Y versões" (área indicada pelo retângulo azul na imagem).

Detalhes:
- Usar `<Link to="/tipos-de-carta">` do `@tanstack/react-router` (já é o roteador do projeto).
- Texto: "Sobre os Tipos de Carta".
- Estilo: pequeno, na cor da marca (`text-[#20a5c9]`), com `hover:underline`, alinhado à esquerda, com um pequeno espaço acima da linha de idiomas/versões.
- Fechar o modal ao clicar (via `onClick` chamando o `onClose` existente), para que a navegação seja perceptível.
- Não exibir quando `magnetOnly` for verdadeiro (segue o mesmo padrão da linha de idiomas/versões logo acima).

Sem outras mudanças.