## Unificar coleção "Caos Ascendente"

Rodar um `UPDATE` na tabela `cards` para renomear todas as 122 cartas que estão como `Caos Ascendente` para `CRI - Caos Ascendente`, juntando com as 72 já existentes (total: 194 cartas em uma única coleção).

### SQL

```sql
UPDATE cards
SET collection = 'CRI - Caos Ascendente', updated_at = now()
WHERE collection = 'Caos Ascendente';
```

### Depois disso

- Em `/cartas`, filtrar por **CRI - Caos Ascendente** mostra as 194 cartas.
- As 122 novas continuam aparecendo como "esgotadas" até receberem estoque/preço em `/admin/manage-cards`.
- Nenhuma alteração de código é necessária.