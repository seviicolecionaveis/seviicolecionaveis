import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { listStoreProducts } from "@/lib/product-catalog.functions";
import { productSlug } from "@/lib/product-catalog";
import { productHead } from "@/lib/product-head";
import { ProductDetail } from "@/components/products/ProductDetail";
import { ProductShell } from "@/components/products/ProductShell";
import { ProductCard } from "@/components/products/ProductCard";
export const Route = createFileRoute("/acessorios/$slug")({
  loader: async ({ params }) => {
    const { items, history } = await listStoreProducts({ data: { kind: "accessory" } });
    const item = items.find((p) => productSlug(p) === params.slug);
    if (item) return { item, suggestions: [] };
    const old = history.find((h) => h.slug === params.slug);
    const current = items.find((p) => p.id === old?.accessory_id);
    if (current)
      throw redirect({
        to: "/acessorios/$slug",
        params: { slug: productSlug(current) },
        statusCode: 301,
      });
    return { item: undefined, suggestions: items.slice(0, 4) };
  },
  head: ({ loaderData }) => productHead(loaderData?.item, "accessory"),
  component: Page,
});
function Page() {
  const { item, suggestions } = Route.useLoaderData();
  if (item) return <ProductDetail item={item} kind="accessory" />;
  return (
    <ProductShell>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Acessório indisponível</h1>
        <p className="mt-3 text-muted-foreground">
          O acessório que você procura não está mais disponível.
        </p>
        <Link to="/acessorios" className="mt-4 inline-block text-primary">
          Voltar para Acessórios
        </Link>
        <h2 className="mb-4 mt-10 text-lg font-semibold">Outros acessórios</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {suggestions.map((p) => (
            <ProductCard key={p.id} product={p} kind="accessory" />
          ))}
        </div>
      </main>
    </ProductShell>
  );
}
