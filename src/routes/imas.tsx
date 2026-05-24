import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { CardItem } from "@/components/catalog/CardItem";
import { CardModal } from "@/components/catalog/CardModal";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { useCardPrices, priceLookupKey } from "@/hooks/useCardPrices";
import type { Card, Finish } from "@/data/cards";
import logoUrl from "@/assets/logo.png";

const MAGNET_EXCLUDED_KEYS = new Set<string>([
  "Psyduck__TRR - Team Rocket Returns__70/109",
  "Hitmonlee__SSH - Espada e Escudo__94/202",
  "Suicune__NBSP - Nintendo Black Star Promos__30/40",
  "Kabutops__MEW - 151__141/165",
  "Totodile__ASC - Heróis Excelsos__041/217",
]);

export const Route = createFileRoute("/imas")({
  head: () => ({
    meta: [
      { title: "Ímãs de Cartas Pokémon | Sevii Colecionáveis" },
      { name: "description", content: "Transforme cartas Pokémon em ímãs colecionáveis. Veja todas as cartas disponíveis para virar ímã." },
      { property: "og:title", content: "Ímãs de Cartas Pokémon | Sevii Colecionáveis" },
      { property: "og:description", content: "Cartas Pokémon disponíveis no acabamento Ímã." },
    ],
  }),
  component: ImasPage,
});

function ImasPage() {
  const { cards, loading } = useCardsCatalog();
  const { prices } = useCardPrices();
  const [active, setActive] = useState<Card | null>(null);

  const magnetCards = useMemo(() => {
    const resolve = (c: Card, finish: Finish, language: string): number | null => {
      const p = prices.get(priceLookupKey(c.name, c.collection, c.number, finish, language));
      return p != null ? p / 100 : null;
    };
    return cards.filter((c) => {
      if (c.category !== "Pokémon") return false;
      if (MAGNET_EXCLUDED_KEYS.has(`${c.name}__${c.collection}__${c.number}`)) return false;
      return c.languages.some((lang) => {
        if (lang.finishes.some((f) => f.finish === "Ímã")) return true;
        const baseFinishes = lang.finishes.filter((f) => f.finish === "Foil" || f.finish === "Normal");
        const baseStock = baseFinishes.reduce((s, f) => s + f.stock, 0);
        if (baseStock <= 0) return false;
        const basePrices = baseFinishes
          .map((f) => f.price ?? resolve(c, f.finish, lang.language))
          .filter((p): p is number => p != null);
        if (!basePrices.length) return false;
        return basePrices.every((p) => p <= 2);
      });
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, prices]);

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" width={224} height={56} className="h-12 w-auto sm:h-14" />
          </Link>
          <SiteNav className="hidden md:flex" />
        </div>
        <div className="md:hidden border-t border-border px-4 py-3">
          <SiteNav className="-mx-1 overflow-x-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold sm:text-4xl">Ímãs de Cartas Pokémon</h1>
          <p className="mt-3 text-muted-foreground">
            Escolha uma carta abaixo e selecione o acabamento <strong>Ímã</strong> para transformá-la em
            um colecionável magnético. R$ 10 (Foil) ou R$ 9 (Normal).
          </p>
        </div>

        {loading && magnetCards.length === 0 ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando ímãs...
            </div>
          </div>
        ) : magnetCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma carta disponível para ímã no momento.</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{magnetCards.length}</span>{" "}
              {magnetCards.length === 1 ? "carta disponível" : "cartas disponíveis"} para virar ímã
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {magnetCards.map((card) => (
                <CardItem key={card.id} card={card} onClick={() => setActive(card)} />
              ))}
            </div>
          </>
        )}
      </main>

      <CardModal card={active} onClose={() => setActive(null)} />
      <SiteFooter />
    </div>
  );
}
