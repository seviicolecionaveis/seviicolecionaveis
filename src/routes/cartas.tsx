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
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/cartas" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Cartas Pokémon — Catálogo completo",
          url: "https://seviicolecionaveis.com.br/cartas",
          inLanguage: "pt-BR",
          isPartOf: { "@type": "WebSite", name: "Sevii Colecionáveis", url: "https://seviicolecionaveis.com.br" },
        }),
      },
    ],
  }),
  component: CartasPage,
});

function CartasPage() {
  return <CatalogView heading="Todas as cartas — Estoque completo" showBanners={false} />;
}
