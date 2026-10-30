import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SealedModal, type Sealed } from "./SealedModal";
import { PanelModal, type Panel } from "./PanelModal";
import { AccessoryModal, type Accessory } from "./AccessoryModal";
import { parseVariants } from "@/lib/accessory-variants";

interface Props {
  query: string;
}

const PER_GROUP_LIMIT = 12;

/**
 * Resultados de busca em Painéis, Produtos Lacrados e Acessórios.
 * Os dados são carregados uma única vez, na primeira busca, e ficam em cache.
 */
export function SearchOtherProducts({ query }: Props) {
  const q = query.trim().toLowerCase();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [sealed, setSealed] = useState<Sealed[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [activeSealed, setActiveSealed] = useState<Sealed | null>(null);
  const [activeAccessory, setActiveAccessory] = useState<Accessory | null>(null);

  useEffect(() => {
    if (!q || loaded) return;
    let cancelled = false;
    setLoaded(true);
    (async () => {
      const [p, s, a] = await Promise.all([
        supabase
          .from("panels")
          .select("id, title, description, price_cents, stock, images")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("sealed_products")
          .select("id, title, description, price_cents, stock, images, is_preorder, release_date, product_type, collection, language, distribution, condition, age_rating, sku")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("accessories")
          .select("id, title, description, category, price_cents, stock, images, variants")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setPanels((p.data ?? []) as Panel[]);
      setSealed((s.data ?? []) as Sealed[]);
      setAccessories((a.data ?? []) as Accessory[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [q, loaded]);

  const groups = useMemo(() => {
    if (!q) return [];
    const hit = (text: string | null | undefined) => (text ?? "").toLowerCase().includes(q);

    const matchedPanels = panels.filter((p) => hit(p.title) || hit(p.description));
    const matchedSealed = sealed.filter(
      (s) => hit(s.title) || hit(s.description) || hit(s.collection) || hit(s.product_type),
    );
    const matchedAccessories = accessories.filter(
      (a) => hit(a.title) || hit(a.description) || hit(a.category),
    );

    return [
      { key: "panels", label: "Painéis", to: "/imas", items: matchedPanels },
      { key: "sealed", label: "Produtos Lacrados", to: "/produtos-lacrados", items: matchedSealed },
      { key: "accessories", label: "Acessórios", to: "/acessorios", items: matchedAccessories },
    ].filter((g) => g.items.length > 0);
  }, [q, panels, sealed, accessories]);

  if (!q || groups.length === 0) return null;

  return (
    <div className="mb-10 rounded-xl border border-border p-4 sm:p-6">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Também encontramos em outros produtos
      </p>

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider">{g.label}</h3>
              {g.items.length > PER_GROUP_LIMIT && (
                <Link
                  to={g.to}
                  className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
                >
                  Ver todos
                </Link>
              )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-6">
              {g.key === "panels" &&
                (g.items as Panel[]).slice(0, PER_GROUP_LIMIT).map((p) => {
                  const out = (p.stock ?? 0) <= 0;
                  return (
                    <button key={p.id} onClick={() => setActivePanel(p)} className="group text-left">
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                        {p.images[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow">
                          Painel
                        </span>
                        {out && (
                          <div className="absolute inset-0 grid place-items-center bg-foreground/40">
                            <span className="rounded bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">
                              Esgotado
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold line-clamp-2">{p.title}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                      </p>
                    </button>
                  );
                })}
              {g.key === "sealed" &&
                (g.items as Sealed[]).slice(0, PER_GROUP_LIMIT).map((s) => {
                  const out = !s.is_preorder && (s.stock ?? 0) <= 0;
                  return (
                    <button key={s.id} onClick={() => setActiveSealed(s)} className="group text-left">
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                        {s.images[0] ? (
                          <img
                            src={s.images[0]}
                            alt={s.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow">
                          Lacrado
                        </span>
                        {s.is_preorder && (
                          <span className="absolute right-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                            Pré-venda
                          </span>
                        )}
                        {out && (
                          <div className="absolute inset-0 grid place-items-center bg-foreground/40">
                            <span className="rounded bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">
                              Esgotado
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold line-clamp-2">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {(s.price_cents / 100).toFixed(2).replace(".", ",")}
                      </p>
                    </button>
                  );
                })}
              {g.key === "accessories" &&
                (g.items as Accessory[]).slice(0, PER_GROUP_LIMIT).map((a) => {
                  const vs = parseVariants(a.variants);
                  const prices = vs.length
                    ? vs.map((v) => v.price_cents ?? a.price_cents)
                    : [a.price_cents];
                  const minPrice = Math.min(...prices);
                  const out = vs.every((v) => (v.stock ?? 0) <= 0) && (a.stock ?? 0) <= 0;
                  return (
                    <button key={a.id} onClick={() => setActiveAccessory(a)} className="group text-left">
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                        {(vs.find((v) => v.images.length)?.images[0] ?? a.images[0]) ? (
                          <img
                            src={vs.find((v) => v.images.length)?.images[0] ?? a.images[0]}
                            alt={a.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow">
                          Acessório
                        </span>
                        {out && (
                          <div className="absolute inset-0 grid place-items-center bg-foreground/40">
                            <span className="rounded bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">
                              Esgotado
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {a.category}
                      </p>
                      <p className="text-sm font-semibold line-clamp-2">{a.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.max(...prices) !== minPrice && <span className="text-xs">a partir de </span>}
                        R$ {(minPrice / 100).toFixed(2).replace(".", ",")}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <PanelModal panel={activePanel} onClose={() => setActivePanel(null)} />
      <SealedModal item={activeSealed} onClose={() => setActiveSealed(null)} />
      <AccessoryModal item={activeAccessory} onClose={() => setActiveAccessory(null)} />
    </div>
  );
}
