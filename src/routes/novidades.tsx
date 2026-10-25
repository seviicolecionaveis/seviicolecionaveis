import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/CatalogView";

export const Route = createFileRoute("/novidades")({
  head: () => ({
    meta: [
      { title: "Novidades — Cartas recém-chegadas | Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Veja as cartas Pokémon adicionadas e reabastecidas mais recentemente no estoque da Sevii Colecionáveis.",
      },
      { property: "og:title", content: "Novidades — Cartas recém-chegadas | Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Cartas Pokémon que acabaram de chegar ou foram reabastecidas no estoque.",
      },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/novidades" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/novidades" }],
  }),
  component: NovidadesPage,
});

function NovidadesPage() {
  return (
    <CatalogView
      heading="Novidades — Cartas adicionadas e reabastecidas recentemente"
      showBanners={false}
      initialSort="newest"
      recentOnlyDays={30}
    />
  );
}
