import { createFileRoute,notFound,Link } from '@tanstack/react-router';
import { listStoreProducts } from '@/lib/product-catalog.functions';
import { productSlug } from '@/lib/product-catalog';
import { productHead } from '@/lib/product-head';
import { ProductDetail } from '@/components/products/ProductDetail';
import { ProductShell } from '@/components/products/ProductShell';
export const Route=createFileRoute('/produtos-lacrados/$slug')({loader:async({params})=>{const {items}=await listStoreProducts({data:{kind:'sealed'}});const item=items.find(p=>productSlug(p)===params.slug);if(!item)throw notFound();return {item};},head:({loaderData})=>productHead(loaderData?.item,'sealed'),component:Page,notFoundComponent:Missing});
function Page(){return <ProductDetail item={Route.useLoaderData().item} kind="sealed"/>;}
function Missing(){return <ProductShell><main className="mx-auto max-w-6xl px-4 py-12"><h1 className="text-2xl font-bold">Produto não encontrado</h1><p className="mt-3">O produto que você procura não está mais disponível.</p><Link to="/produtos-lacrados" className="mt-4 inline-block text-primary">Voltar para Produtos Lacrados</Link></main></ProductShell>;}
