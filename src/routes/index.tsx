import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/CatalogView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sevii Colecionáveis — Catálogo de Cartas Pokémon" },
      {
        name: "description",
        content:
          "Catálogo completo de cartas Pokémon com filtros por tipo, coleção, condição, idioma e preço. Galeria visual com estoque em tempo real.",
      },
      { property: "og:title", content: "Sevii Colecionáveis — Catálogo de Cartas Pokémon" },
      {
        property: "og:description",
        content: "Encontre cartas Pokémon raras e colecionáveis com filtros avançados.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <CatalogView />;
}
