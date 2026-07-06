import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { VideogameModal, type Videogame } from "@/components/catalog/VideogameModal";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo.webp";

export const Route = createFileRoute("/videogames")({
  head: () => ({
    meta: [
      { title: "Videogames — Nintendo Switch e mais | Sevii Colecionáveis" },
      { name: "description", content: "Consoles e jogos de videogame à venda na Sevii Colecionáveis. Nintendo Switch novos, seminovos e usados." },
      { property: "og:title", content: "Videogames | Sevii Colecionáveis" },
      { property: "og:description", content: "Consoles e jogos de videogame à venda na Sevii Colecionáveis." },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/videogames" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/videogames" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Videogames",
          url: "https://seviicolecionaveis.com.br/videogames",
          inLanguage: "pt-BR",
          isPartOf: { "@type": "WebSite", name: "Sevii Colecionáveis", url: "https://seviicolecionaveis.com.br" },
        }),
      },
    ],
  }),
  component: VideogamesPage,
});

const CONDITIONS = ["Novo", "Seminovo", "Usado"] as const;

function VideogamesPage() {
  const [items, setItems] = useState<Videogame[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Videogame | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("Todas");
  const [conditionFilter, setConditionFilter] = useState<string>("Todas");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("videogames")
        .select("id, title, description, platform, condition, region, includes_box, price_cents, stock, images")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as Videogame[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.platform && set.add(i.platform));
    return ["Todas", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) =>
      (platformFilter === "Todas" || i.platform === platformFilter) &&
      (conditionFilter === "Todas" || i.condition === conditionFilter),
    ),
    [items, platformFilter, conditionFilter],
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
          <h1 className="text-3xl font-bold sm:text-4xl">Videogames</h1>
          <p className="mt-3 text-muted-foreground">
            Consoles e jogos de videogame — começando pelo Nintendo Switch. Confira os itens disponíveis.
          </p>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plataforma</p>
          <div className="flex flex-wrap gap-2">
            {platforms.map((c) => {
              const activeChip = platformFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setPlatformFilter(c)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeChip ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Condição</p>
          <div className="flex flex-wrap gap-2">
            {["Todas", ...CONDITIONS].map((c) => {
              const activeChip = conditionFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setConditionFilter(c)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeChip ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando videogames...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item disponível com os filtros selecionados.</p>
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
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.platform} · {p.condition}
                  </p>
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

      <VideogameModal item={active} onClose={() => setActive(null)} />
      <SiteFooter />
    </div>
  );
}
