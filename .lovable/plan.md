## Adicionar coleção CPA - Caminho do Campeão

Adicionar `"CPA - Caminho do Campeão"` ao array `EXTRA_COLLECTIONS` em `src/data/cards.ts`.

Isso fará a coleção aparecer no filtro de Coleção em `/cartas` mesmo sem cartas cadastradas ainda, ficando pronta para receber cartas via `/admin/manage-cards`.

Nenhuma outra alteração necessária — `COLLECTIONS` já é derivado de `EXTRA_COLLECTIONS` + coleções vindas do banco.