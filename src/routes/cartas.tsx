import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/CatalogView";

export const Route = createFileRoute("/cartas")({
  head: () => ({
    meta: [
      { title: "Cartas — Catálogo completo | Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Veja todo o estoque de cartas Pokémon da Sevii Colecionáveis. Filtre por coleção, raridade, idioma, condição e preço.",
      },
      { property: "og:title", content: "Cartas — Catálogo completo | Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Todo o estoque de cartas Pokémon em um só lugar, com filtros avançados.",
      },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/cartas" },
    ],
  }),
  component: CartasPage,
});

function CartasPage() {
  return <CatalogView heading="Todas as cartas — Estoque completo" showBanners={false} />;
}
