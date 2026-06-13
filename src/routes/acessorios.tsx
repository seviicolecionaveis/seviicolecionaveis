import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AccessoryModal, type Accessory } from "@/components/catalog/AccessoryModal";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo.webp";

const CATEGORIES = [
  "Sleeves/Shields",
  "Dados",
  "Marcadores de dano",
  "Moedas",
  "Playmats",
  "Binders",
  "Top Loader",
  "Deck box",
  "Kit jogável",
] as const;

export const Route = createFileRoute("/acessorios")({
  head: () => ({
    meta: [
      { title: "Acessórios para Pokémon TCG | Sevii Colecionáveis" },
      { name: "description", content: "Sleeves, dados, marcadores, playmats, binders, top loaders, deck boxes e mais acessórios para Pokémon TCG." },
      { property: "og:title", content: "Acessórios para Pokémon TCG | Sevii Colecionáveis" },
      { property: "og:description", content: "Acessórios essenciais para jogadores e colecionadores de Pokémon TCG." },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/acessorios" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/acessorios" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Acessórios para Pokémon TCG",
          url: "https://seviicolecionaveis.com.br/acessorios",
          inLanguage: "pt-BR",
          isPartOf: { "@type": "WebSite", name: "Sevii Colecionáveis", url: "https://seviicolecionaveis.com.br" },
        }),
      },
    ],
  }),
  component: AcessoriosPage,
});

function AcessoriosPage() {
  const [items, setItems] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Accessory | null>(null);
  const [filter, setFilter] = useState<string>("Todos");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("accessories")
        .select("id, title, description, category, price_cents, stock, images")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as Accessory[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => (filter === "Todos" ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

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
          <h1 className="text-3xl font-bold sm:text-4xl">Acessórios</h1>
          <p className="mt-3 text-muted-foreground">
            Sleeves, dados, marcadores, playmats, binders e mais para seu deck e coleção.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {["Todos", ...CATEGORIES].map((c) => {
            const activeChip = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeChip
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando acessórios...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acessório disponível{filter !== "Todos" ? ` em ${filter}` : ""}.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4">
            {filtered.map((p) => {
              const cover = p.images[0];
              return (
                <button
                  key={p.id}
                  onClick={() => setActive(p)}
                  className="group text-left"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                    {cover ? (
                      <img src={cover} alt={p.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">Sem imagem</div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.category}</p>
                  <p className="text-sm font-semibold line-clamp-2">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                    {p.images.length > 1 && <span className="ml-2 text-xs">· {p.images.length} fotos</span>}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <AccessoryModal item={active} onClose={() => setActive(null)} />
      <SiteFooter />
    </div>
  );
}
