import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCreditStatement } from '@/lib/customer-finance.functions';
import { money } from '@/lib/customer-finance';
export function CreditStatement({ userId }: { userId?: string }) {
  const [page,setPage]=useState(0);
  const read=useServerFn(getCreditStatement);
  const q=useQuery({queryKey:['credit-statement',userId,page],queryFn:()=>read({data:{page,userId}})});
  if(q.isPending) return <p role="status" className="text-muted-foreground">Carregando saldo…</p>;
  if(q.isError) return <div role="alert"><p>{q.error.message}</p><Button variant="outline" onClick={()=>q.refetch()}>Tentar novamente</Button></div>;
  const data=q.data;
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold flex gap-2 items-center"><Wallet className="h-5 w-5"/>Meu saldo</h2><Button size="icon" variant="ghost" aria-label="Atualizar saldo" title="Atualizar saldo" onClick={()=>q.refetch()}><RefreshCw className="h-4 w-4"/></Button></div>
    <div className="grid grid-cols-2 gap-4 border-y border-border py-5"><div><p className="text-sm text-muted-foreground">Disponível</p><p className="text-2xl font-bold break-words">{money(data.balanceCents-data.reservedCents)}</p></div><div><p className="text-sm text-muted-foreground">Reservado em pagamentos</p><p className="text-xl font-semibold break-words">{money(data.reservedCents)}</p></div></div>
    <h3 className="font-semibold">Movimentações</h3>
    {data.entries.length===0?<p className="text-sm text-muted-foreground">Nenhuma movimentação de saldo.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-3 pr-4">Data / Descrição</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Saldo após</th></tr></thead><tbody>{data.entries.map(e=><tr key={e.id} className="border-t border-border"><td className="py-3 pr-4"><p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</p><p>{e.description}</p>{e.order_id&&<p className="text-xs text-muted-foreground">Pedido #{e.order_id.slice(0,8).toUpperCase()}</p>}</td><td className="p-3 text-right whitespace-nowrap font-semibold">{e.amount_cents>0?'+':''}{money(e.amount_cents)}</td><td className="p-3 text-right whitespace-nowrap">{money(e.balance_after_cents)}</td></tr>)}</tbody></table></div>}
    <div className="flex items-center justify-end gap-3"><span className="text-xs text-muted-foreground">{data.total} movimentações · Página {page+1}</span><Button variant="outline" size="icon" title="Anterior" aria-label="Página anterior" disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" size="icon" title="Próxima" aria-label="Próxima página" disabled={(page+1)*25>=data.total} onClick={()=>setPage(page+1)}><ChevronRight className="h-4 w-4"/></Button></div>
  </section>;
}