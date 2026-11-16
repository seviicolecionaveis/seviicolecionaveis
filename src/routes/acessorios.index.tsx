import { createFileRoute } from "@tanstack/react-router";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { ProductShell } from "@/components/products/ProductShell";
import { listStoreProducts } from "@/lib/product-catalog.functions";
export const Route = createFileRoute("/acessorios/")({
  loader: () => listStoreProducts({ data: { kind: "accessory" } }),
  head: () => ({
    meta: [
      { title: "Acessórios Pokémon TCG | Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Sleeves, dados, playmats, binders e acessórios para Pokémon TCG na Sevii Colecionáveis.",
      },
      { property: "og:title", content: "Acessórios Pokémon TCG | Sevii Colecionáveis" },
      {
        property: "og:description",
        content:
          "Sleeves, dados, playmats, binders e acessórios para Pokémon TCG na Sevii Colecionáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/acessorios" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/acessorios" }],
  }),
  component: Page,
});
function Page() {
  const { items } = Route.useLoaderData();
  return (
    <ProductShell>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 text-3xl font-bold sm:text-4xl">Acessórios</h1>
        <ProductCatalog items={items} kind="accessory" />
      </main>
    </ProductShell>
  );
}
