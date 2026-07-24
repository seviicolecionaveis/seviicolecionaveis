## Objetivo
Melhorar a legibilidade e o equilíbrio visual do bloco de produto em `/pre-venda/[slug]`, garantindo que o botão de reserva não fique "escondido".

## Mudanças em `src/routes/pre-venda.$slug.tsx`

### 1. Camada branca opaca atrás do conteúdo
Envolver cada `PresaleProductBlock` em um card com fundo claro sólido, mantendo as bolinhas do background visíveis apenas nas laterais externas.

- Adicionar wrapper: `rounded-2xl bg-card/95 backdrop-blur-sm shadow-sm ring-1 ring-border p-6 sm:p-8`
- Breadcrumb e botão "Voltar" ficam fora do card (sobre o fundo com bolinhas), para o card começar já no bloco imagem+texto.
- Ajustar `main` para `space-y-8` e reduzir `max-w` se necessário para manter respiro lateral das bolinhas.

### 2. Rebalancear proporção imagem × texto
Hoje é `md:grid-cols-2` (50/50). A imagem quadrada domina e empurra o CTA para baixo da dobra em telas médias.

Proposta: **`md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`** — imagem ~42%, texto ~58%. Isso:
- Reduz a altura da imagem (aspect-square continua, mas em coluna mais estreita).
- Dá mais largura ao bloco de texto → título/descrição ocupam menos linhas → CTA sobe.

Adicionalmente:
- Limitar altura máxima da imagem em desktop: `md:max-h-[520px]` no container (mantendo `aspect-square` até esse teto via `md:aspect-auto md:h-[520px]`).
- Coluna de texto vira `md:sticky md:top-24 md:self-start` para que, em blocos longos, o preço + CTA fiquem sempre visíveis ao rolar dentro do card.

### 3. Destaque do CTA
- Aumentar peso visual: `py-3.5 text-base`, ícone WhatsApp à esquerda (lucide `MessageCircle`).
- Adicionar um "sticky footer" leve **apenas no mobile** com o preço + botão de reserva:
  `md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3 flex items-center justify-between gap-3`
  Isso resolve o "botão escondido" em mobile sem alterar layout desktop.
- Adicionar `pb-24 md:pb-0` no `main` para não sobrepor o conteúdo final.

## Escopo
Somente `src/routes/pre-venda.$slug.tsx`. Sem mudanças de dados, server functions ou tokens de tema — usa `bg-card`, `border`, `ring-border` já existentes.

## Fora de escopo
- `/pre-venda` (index) — pode receber tratamento equivalente em outra rodada se desejar.
- Alterar o background com bolinhas em si.
