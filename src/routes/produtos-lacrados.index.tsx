import { createFileRoute } from "@tanstack/react-router";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { ProductShell } from "@/components/products/ProductShell";
import { listStoreProducts } from "@/lib/product-catalog.functions";
export const Route = createFileRoute("/produtos-lacrados/")({
  loader: () => listStoreProducts({ data: { kind: "sealed" } }),
  head: () => ({
    meta: [
      { title: "Produtos Lacrados Pokémon | Sevii Colecionáveis" },
      {
        name: "description",
        content: "Booster boxes, ETBs e produtos lacrados Pokémon da Sevii Colecionáveis.",
      },
      { property: "og:title", content: "Produtos Lacrados Pokémon | Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Booster boxes, ETBs e produtos lacrados Pokémon da Sevii Colecionáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/produtos-lacrados" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/produtos-lacrados" }],
  }),
  component: Page,
});
function Page() {
  const { items } = Route.useLoaderData();
  return (
    <ProductShell>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 text-3xl font-bold sm:text-4xl">Produtos Lacrados</h1>
        <ProductCatalog items={items} kind="sealed" />
      </main>
    </ProductShell>
  );
}
