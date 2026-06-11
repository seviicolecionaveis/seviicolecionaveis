import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SealedModal, type Sealed } from "@/components/catalog/SealedModal";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/selados")({
  head: () => ({
    meta: [
      { title: "Produtos Selados Pokémon | Sevii Colecionáveis" },
      { name: "description", content: "Booster boxes, ETBs e produtos selados Pokémon disponíveis na Sevii Colecionáveis." },
      { property: "og:title", content: "Produtos Selados Pokémon | Sevii Colecionáveis" },
      { property: "og:description", content: "Booster boxes, ETBs e produtos selados Pokémon disponíveis na Sevii Colecionáveis." },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/selados" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://seviicolecionaveis.com.br/selados" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Produtos Selados Pokémon",
          url: "https://seviicolecionaveis.com.br/selados",
          inLanguage: "pt-BR",
        }),
      },
    ],
  }),
  component: SeladosPage,
});

function SeladosPage() {
  const [items, setItems] = useState<Sealed[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Sealed | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sealed_products")
        .select("id, title, description, price_cents, stock, images, is_preorder, release_date")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as Sealed[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          <h1 className="text-3xl font-bold sm:text-4xl">Produtos Selados</h1>
          <p className="mt-3 text-muted-foreground">
            Booster boxes, ETBs e outros produtos lacrados de Pokémon TCG.
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando produtos selados...
            </div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto selado disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4">
            {items.map((p) => {
              const cover = p.images[0];
              return (
                <button
                  key={p.id}
                  onClick={() => setActive(p)}
                  className="group text-left"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                    {cover ? (
                      <img src={cover} alt={p.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">Sem imagem</div>
                    )}
                    {p.is_preorder && (
                      <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                        Pré-venda
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold line-clamp-2">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                    {p.images.length > 1 && <span className="ml-2 text-xs">· {p.images.length} fotos</span>}
                  </p>
                  {p.is_preorder && p.release_date && (
                    <p className="text-[11px] text-primary font-semibold">
                      Envio a partir de {new Date(p.release_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <SealedModal item={active} onClose={() => setActive(null)} />
      <SiteFooter />
    </div>
  );
}
