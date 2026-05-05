import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CARDS, type Card, type Finish, type Language } from "@/data/cards";
import { fetchLigaPrice } from "@/utils/cardPrices.functions";
import { useCardPrices } from "@/hooks/useCardPrices";

export const Route = createFileRoute("/admin/cards")({
  head: () => ({ meta: [{ title: "Preços das cartas — Admin" }] }),
  component: AdminCardsPage,
});

interface PriceRow {
  card_name: string;
  collection: string;
  card_number: string;
  finish: string;
  language: string;
  price_cents: number | null;
  source_url: string | null;
  last_error: string | null;
  updated_at: string;
}

function priceKey(name: string, collection: string, number: string, finish: string, language: string) {
  return `${name}__${collection}__${number}__${finish}__${language}`;
}

function formatBRL(cents: number | null) {
  if (cents == null) return "—";
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function AdminCardsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { refresh: refreshCatalogPrices } = useCardPrices();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState<Map<string, PriceRow>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const loadPrices = async () => {
    const { data } = await supabase.from("card_prices").select("*");
    const map = new Map<string, PriceRow>();
    for (const row of (data ?? []) as PriceRow[]) {
      map.set(
        priceKey(row.card_name, row.collection, row.card_number, row.finish, row.language),
        row,
      );
    }
    setPrices(map);
  };

  useEffect(() => {
    if (isAdmin) loadPrices();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CARDS.slice(0, 50);
    return CARDS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.collection.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q),
    ).slice(0, 100);
  }, [search]);

  const handleFetch = async (
    card: Card,
    finish: Finish,
    language: Language,
  ) => {
    const key = priceKey(card.name, card.collection, card.number, finish, language);
    setLoadingKeys((s) => new Set(s).add(key));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const result = await fetchLigaPrice({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          cardName: card.name,
          collection: card.collection,
          cardNumber: card.number,
          finish,
          language,
        },
      });
      if (result.error) {
        alert(`⚠️ ${card.name} (${finish}, ${language}): ${result.error}`);
      }
      await loadPrices();
      await refreshCatalogPrices();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setLoadingKeys((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii · Admin · Preços</Link>
          <div className="flex gap-3 text-xs">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">Pedidos</Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">← Catálogo</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Atualizar preços do Liga Pokémon</h1>
          <p className="text-xs text-muted-foreground mb-4">
            Busca o menor preço NM no Liga Pokémon e acrescenta 3%. Cada clique consome 1 crédito Firecrawl.
          </p>
          <input
            type="search"
            placeholder="Buscar por nome, número ou coleção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {search ? `${filtered.length} carta(s) encontrada(s)` : `Mostrando primeiras 50 de ${CARDS.length} cartas`}
          </p>
        </div>

        <div className="space-y-2">
          {filtered.map((card) => {
            const isOpen = expanded === card.id;
            return (
              <div key={card.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : card.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition"
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-10 h-14 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{card.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {card.collection} · #{card.number}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {card.variants.length} variante{card.variants.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-3 bg-background/50">
                    <div className="space-y-2">
                      {card.languages.flatMap((lang) =>
                        lang.finishes.map((f) => {
                          const key = priceKey(card.name, card.collection, card.number, f.finish, lang.language);
                          const price = prices.get(key);
                          const loading = loadingKeys.has(key);
                          return (
                            <div
                              key={key}
                              className="flex flex-wrap items-center gap-2 rounded border border-border px-3 py-2 text-xs"
                            >
                              <span className="font-semibold min-w-[110px]">{f.finish}</span>
                              <span className="text-muted-foreground min-w-[80px]">{lang.language}</span>
                              <span className="text-muted-foreground">Estoque: {f.stock}</span>
                              <div className="flex-1" />
                              <span className="tabular-nums font-mono font-semibold">
                                {price?.price_cents != null ? formatBRL(price.price_cents) : (
                                  <span className="text-muted-foreground italic">sem preço</span>
                                )}
                              </span>
                              {price?.updated_at && (
                                <span className="text-muted-foreground text-[10px]">
                                  ({timeAgo(price.updated_at)})
                                </span>
                              )}
                              {price?.last_error && (
                                <span
                                  title={price.last_error}
                                  className="text-destructive text-[10px] cursor-help"
                                >
                                  ⚠️
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleFetch(card, f.finish, lang.language)}
                                disabled={loading}
                                className="rounded bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground hover:opacity-90 disabled:opacity-50"
                              >
                                {loading ? "..." : "🔄 Liga"}
                              </button>
                              {price?.source_url && (
                                <a
                                  href={price.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-muted-foreground underline hover:text-foreground"
                                >
                                  fonte
                                </a>
                              )}
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
