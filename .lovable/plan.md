## Objetivo
Facilitar o acesso à pilha de cartas adicionando um item "Pilha de cartas" no dropdown da conta no header (já existe a página `/pilha` funcionando com compras, retirada e envio).

## Mudança

**`src/components/HeaderActions.tsx`** — adicionar um novo `<Link to="/pilha">` no dropdown, logo após "Meus pedidos", usando o ícone `Layers` do lucide-react.

```tsx
<Link to="/pilha" ...>
  <Layers className="h-4 w-4" /> Pilha de cartas
</Link>
```

E adicionar `Layers` no import de `lucide-react`.

Nenhuma outra alteração — a página `/pilha` e seus fluxos (retirada/envio) já estão implementados.

## Verificação
- Abrir o menu da conta no header → item "Pilha de cartas" aparece entre "Meus pedidos" e "Admin".
- Clicar leva para `/pilha` e o menu fecha.