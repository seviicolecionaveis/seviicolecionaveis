# Adicionar coleção "30C - Celebração de 30 Anos" (158 cartas)

## O que será feito

1. **Cadastrar as 158 cartas** do arquivo SQL enviado, com estoque 0 e sem preço (você define preço e estoque depois pelo admin, como de costume).
2. **Adicionar a coleção à lista de coleções do site** para aparecer nos filtros e na página de coleções.

## Ajustes necessários no SQL enviado

O arquivo não roda direto no banco — precisa de 3 correções:

- **Idioma:** o arquivo usa `en`, mas o banco só aceita `Inglês` (padrão do site). Será convertido.
- **Coluna de ilustrador:** o arquivo usa uma coluna `illustrator` que não existe — o banco usa `illustrator_id` (referência à tabela de ilustradores). Como os valores estão vazios (NULL), a coluna será simplesmente removida do insert; os ilustradores podem ser preenchidos depois pelo admin.
- **Nome da coleção:** será cadastrada como `30C - Celebração de 30 Anos`, seguindo o padrão das outras coleções (código + nome).

## Detalhes técnicos

- Inserção via run_sql (operação de dados, não migration), com os ajustes acima aplicados ao arquivo.
- Adicionar `30C - Celebração de 30 Anos` em `EXTRA_COLLECTIONS` em `src/data/cards.ts`.
- As cartas entram com `stock = 0` e `base_price_cents = NULL` — não aparecem como disponíveis para compra até você definir estoque/preço.
- `pokemon_type` fica NULL (o próprio arquivo indica que exigiria consulta individual por carta).

## Ressalva sobre as imagens

O próprio arquivo avisa: as URLs de imagem usam o padrão TCGdex (`assets.tcgdex.net/en/me/30c/...`) **ainda não confirmado** para este set. Após inserir, vou testar algumas URLs e te aviso se estiverem quebradas — nesse caso, as imagens precisarão ser corrigidas depois.
