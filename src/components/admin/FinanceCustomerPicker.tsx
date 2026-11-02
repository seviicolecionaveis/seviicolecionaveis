import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchCustomersFn } from '@/lib/admin-customers.functions';
import { Button } from '@/components/ui/button';

export type FinanceCustomer = { user_id: string; full_name: string | null; email: string | null };

export function FinanceCustomerPicker({ onSelect, onClear }: {
  onSelect: (customer: FinanceCustomer) => void;
  onClear: () => void;
}) {
  const search = useServerFn(searchCustomersFn);
  const [text, setText] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const results = useQuery({
    queryKey: ['finance-customer-search', query, page],
    queryFn: () => search({ data: { q: query ?? '', limit: 10, offset: page * 10 } }),
    enabled: query !== null,
  });
  return <div className="space-y-3">
    <form className="flex flex-wrap gap-3" onSubmit={event => {
      event.preventDefault(); setPage(0); setQuery(text.trim()); setSelectedId(''); onClear();
      if (query === text.trim() && page === 0) void results.refetch();
    }}>
      <input className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
        aria-label="Buscar cliente por nome ou e-mail" placeholder="Nome, e-mail, CPF ou telefone" maxLength={120}
        value={text} onChange={event => { setText(event.target.value); setQuery(null); setSelectedId(''); onClear(); }} />
      <Button type="submit" variant="outline" disabled={results.isFetching}><Search className="h-4 w-4 mr-2" />Consultar</Button>
    </form>
    {query !== null && (results.isPending ? <p role="status" className="text-sm text-muted-foreground">Buscando clientes…</p>
      : results.isError ? <div role="alert" className="text-sm text-destructive">Não foi possível buscar os clientes. <Button variant="outline" onClick={() => results.refetch()}>Tentar novamente</Button></div>
      : <>
        {results.data.rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
        <div className="divide-y divide-border">{results.data.rows.map(customer => <div key={customer.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="font-semibold break-words">{customer.full_name || 'Sem nome'}</p>
            <p className="text-sm text-muted-foreground break-all">{customer.email || 'Sem e-mail'}{customer.phone ? ` · ${customer.phone}` : ''}</p></div>
          <Button type="button" variant={selectedId === customer.user_id ? 'secondary' : 'outline'} onClick={() => {
            setSelectedId(customer.user_id); onSelect(customer);
          }}>{selectedId === customer.user_id ? 'Selecionado' : 'Selecionar'}</Button>
        </div>)}</div>
        {results.data.total > 10 && <div className="flex items-center gap-3 justify-end">
          <span className="text-sm text-muted-foreground">Página {page + 1} de {Math.ceil(results.data.total / 10)}</span>
          <Button size="icon" variant="outline" aria-label="Clientes anteriores" disabled={page === 0 || results.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Próximos clientes" disabled={(page + 1) * 10 >= results.data.total || results.isFetching} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>}
      </>)}
  </div>;
}