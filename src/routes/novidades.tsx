import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/CatalogView";
import { RecentOtherProducts } from "@/components/catalog/RecentOtherProducts";

export const Route = createFileRoute("/novidades")({
  head: () => ({
    meta: [
      { title: "Novidades — Adicionados recentemente | Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Veja as cartas, painéis, produtos lacrados e acessórios adicionados e reabastecidos mais recentemente no estoque da Sevii Colecionáveis.",
      },
      { property: "og:title", content: "Novidades — Adicionados recentemente | Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Cartas, painéis, produtos lacrados e acessórios que acabaram de chegar ou foram reabastecidos no estoque.",
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
    <>
      <CatalogView
        heading="Novidades — Cartas adicionadas e reabastecidas recentemente"
        showBanners={false}
        initialSort="newest"
        recentOnlyDays={30}
      />
      <RecentOtherProducts windowDays={30} limit={24} />
    </>
  );
}
