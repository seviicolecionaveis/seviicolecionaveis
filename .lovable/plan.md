Mover a linha de atributos (Idioma, Ano, Disponibilidade) para **acima do título** do produto em `/pre-venda/[slug]`, exibindo em **horizontal**, com **fonte menor e mais clara**.

## Mudanças

Arquivo: `src/routes/pre-venda.$slug.tsx` (função `PresaleProductBlock`)

- Remover o bloco `<dl>` atual de specs (grid vertical, aparece depois da descrição).
- Renderizar acima do `<h1>` uma linha única com os valores presentes, separados por um divisor sutil (`·`), no formato:
  `Idioma · Ano · Disponível em <data>`
- Estilo: `text-xs uppercase tracking-wide text-muted-foreground` (menor e mais clarinha), com `mb-2`.
- Só renderiza se houver ao menos um valor; itens vazios são omitidos.

Nada mais muda (galeria, preço, botão de WhatsApp, descrição permanecem iguais).
