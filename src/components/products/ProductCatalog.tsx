import { useMemo,useState } from 'react';
import { Search } from 'lucide-react';
import { productMatches,productPrice,productStock,type StoreProduct } from '@/lib/product-catalog';
import { ProductCard } from './ProductCard';
import { Button } from '@/components/ui/button';
export function ProductCatalog({items,kind}:{items:StoreProduct[];kind:'accessory'|'sealed'}) {
 const [q,setQ]=useState(''); const [category,setCategory]=useState(''); const [sort,setSort]=useState('default'); const [stock,setStock]=useState(false);
 const categories=Array.from(new Set(items.map(p=>p.category||p.product_type).filter((c):c is string=>!!c)));
 const filtered=useMemo(()=>{const result=items.filter(p=>productMatches(p,q)&&(!category||(p.category||p.product_type)===category)&&(!stock||productStock(p)>0||p.is_preorder));
 if(sort==='price-asc') result.sort((a,b)=>productPrice(a)-productPrice(b)); if(sort==='price-desc') result.sort((a,b)=>productPrice(b)-productPrice(a)); if(sort==='name')result.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));return result;},[items,q,category,sort,stock]);
 return <><div className="mb-6 flex flex-wrap items-center gap-3">
 <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input aria-label="Buscar produtos" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produtos" className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"/></label>
 <select aria-label="Categoria" value={category} onChange={e=>setCategory(e.target.value)} className="max-w-full rounded-md border border-border bg-background p-2 text-sm"><option value="">Todas as categorias</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
 <select aria-label="Ordenar produtos" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-md border border-border bg-background p-2 text-sm"><option value="default">Mais recentes</option><option value="name">Nome</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/>Em estoque</label></div>
 <p className="mb-4 text-xs text-muted-foreground">{filtered.length} produtos</p>
 {filtered.length?<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4">{filtered.map(p=><ProductCard key={p.id} product={p} kind={kind}/>)}</div>:<div className="py-10"><p>Nenhum produto encontrado.</p><Button variant="link" onClick={()=>{setQ('');setCategory('');setStock(false);}}>Limpar filtros</Button></div>}
 </>;
}
