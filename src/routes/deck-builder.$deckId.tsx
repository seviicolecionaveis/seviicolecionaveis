import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  getDeck,
  updateDeck,
  addCardToDeck,
  setDeckCardQuantity,
  removeDeckCard,
  searchCardsForDeck,
  duplicateDeck,
  bulkImportToDeck,
  type DeckDetail,
  type SearchResult,
} from "@/lib/decks.functions";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Minus, Plus, Trash2, Search, ArrowLeft, Copy, ShoppingCart, Share2, Upload, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const BASIC_ENERGIES = new Set(["grass energy","fire energy","water energy","lightning energy","psychic energy","fighting energy","darkness energy","metal energy","fairy energy","energia básica"]);

export const Route = createFileRoute("/deck-builder/$deckId")({
  head: () => ({
    meta: [
      { title: "Editar deck — Sevii Colecionáveis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeckEditor,
});

function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DeckEditor() {
  const { deckId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const cart = useCart();

  const fetchDeck = useServerFn(getDeck);
  const saveDeck = useServerFn(updateDeck);
  const addCard = useServerFn(addCardToDeck);
  const setQty = useServerFn(setDeckCardQuantity);
  const removeCard = useServerFn(removeDeckCard);
  const search = useServerFn(searchCardsForDeck);
  const dup = useServerFn(duplicateDeck);
  const bulkImport = useServerFn(bulkImportToDeck);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchDeck({ data: { id: deckId } });
      setDeck(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, deckId]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await search({ data: { q } }));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const stats = useMemo(() => {
    if (!deck) return { total: 0, byCategory: {} as Record<string, number>, priceCents: 0, missing: 0, byName: [] as Array<{ name: string; qty: number }>, legalityIssues: [] as string[] };
    let total = 0;
    let priceCents = 0;
    let missing = 0;
    const byCategory: Record<string, number> = {};
    const byNameMap: Record<string, number> = {};
    for (const dc of deck.cards) {
      total += dc.quantity;
      const cat = dc.card?.category ?? "?";
      byCategory[cat] = (byCategory[cat] ?? 0) + dc.quantity;
      if (dc.card?.base_price_cents != null) priceCents += dc.card.base_price_cents * dc.quantity;
      if (!dc.card || dc.card.stock < dc.quantity) missing += Math.max(0, dc.quantity - (dc.card?.stock ?? 0));
      const nm = (dc.card?.name ?? "?").trim();
      byNameMap[nm] = (byNameMap[nm] ?? 0) + dc.quantity;
    }
    const byName = Object.entries(byNameMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    const legalityIssues: string[] = [];
    if (total !== 60) legalityIssues.push(`O deck tem ${total} cartas (esperado: 60).`);
    for (const { name, qty } of byName) {
      if (qty > 4 && !BASIC_ENERGIES.has(name.toLowerCase())) {
        legalityIssues.push(`"${name}" tem ${qty} cópias (máx 4).`);
      }
    }
    return { total, byCategory, priceCents, missing, byName, legalityIssues };
  }, [deck]);

  const onAdd = async (r: SearchResult) => {
    await addCard({ data: { deck_id: deckId, card_id: r.id } });
    setQ("");
    setResults([]);
    load();
  };

  const changeQty = async (deckCardId: string, quantity: number) => {
    await setQty({ data: { deck_id: deckId, deck_card_id: deckCardId, quantity } });
    load();
  };

  const onRemove = async (deckCardId: string) => {
    await removeCard({ data: { deck_card_id: deckCardId } });
    load();
  };

  const onSaveMeta = async (patch: { name?: string; description?: string | null; format?: string | null; is_public?: boolean }) => {
    if (!deck) return;
    setSavingMeta(true);
    try {
      await saveDeck({ data: { id: deck.id, ...patch } });
      setDeck({ ...deck, ...patch } as DeckDetail);
    } finally {
      setSavingMeta(false);
    }
  };

  const shareUrl = deck ? `${typeof window !== "undefined" ? window.location.origin : ""}/baralho/${deck.share_token}` : "";

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const addMissingToCart = () => {
    if (!deck) return;
    let added = 0;
    for (const dc of deck.cards) {
      const c = dc.card;
      if (!c) continue;
      const inCart = cart.items.find((it) => it.cardId === c.id)?.quantity ?? 0;
      const need = dc.quantity - inCart;
      if (need <= 0) continue;
      const canAdd = Math.min(need, c.stock);
      if (canAdd <= 0) continue;
      cart.add(
        {
          id: `${c.id}|${c.finish}|${c.language}|${c.condition}`,
          cardId: c.id,
          name: c.name,
          image: c.image,
          collection: c.collection,
          number: c.card_number,
          finish: c.finish,
          language: c.language,
          condition: c.condition,
          unitPrice: (c.base_price_cents ?? 0) / 100,
          maxStock: c.stock,
        },
        canAdd,
      );
      added += canAdd;
    }
    if (added > 0) toast.success(`${added} carta(s) adicionadas ao carrinho`);
    else toast.info("Nada disponível para adicionar (esgotado ou já no carrinho).");
  };

  const onDuplicate = async () => {
    if (!deck) return;
    try {
      const r = await dup({ data: { id: deck.id } });
      toast.success("Deck duplicado");
      nav({ to: "/deck-builder/$deckId", params: { deckId: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  };

  const exportTxt = () => {
    if (!deck) return;
    const lines = deck.cards
      .filter((dc) => dc.card)
      .map((dc) => `${dc.quantity} ${dc.card!.name} ${dc.card!.collection} ${dc.card!.card_number}`);
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/[^\w-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseImport = (text: string): Array<{ query: string; quantity: number }> => {
    return text
      .split(/\r?\n/)
      .map((raw) => raw.trim())
      .filter((l) => l && !l.startsWith("//") && !/^(pok[eé]mon|trainer|treinador|energy|energia):?$/i.test(l))
      .map((line) => {
        const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
        if (m) return { quantity: parseInt(m[1]!, 10), query: m[2]!.trim() };
        return { quantity: 1, query: line };
      });
  };

  const runImport = async () => {
    if (!deck) return;
    const entries = parseImport(importText);
    if (entries.length === 0) {
      toast.info("Cole ao menos uma linha (ex.: 4 Pikachu SVI 50).");
      return;
    }
    setImporting(true);
    try {
      const r = await bulkImport({ data: { deck_id: deck.id, entries } });
      toast.success(`${r.matched} carta(s) importada(s)${r.unmatched.length ? `. Não encontradas: ${r.unmatched.length}` : ""}`);
      if (r.unmatched.length) console.warn("Não encontradas:", r.unmatched);
      setImportOpen(false);
      setImportText("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setImporting(false);
    }
  };

  if (authLoading || !user) return null;
  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-muted-foreground">Carregando…</div>;
  if (!deck) return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p>Deck não encontrado.</p>
      <Button asChild variant="link"><Link to="/deck-builder">Voltar</Link></Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link to="/deck-builder"><ArrowLeft className="h-4 w-4 mr-1" /> Meus decks</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={addMissingToCart} disabled={deck.cards.length === 0}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Adicionar faltantes ao carrinho
          </Button>
        </div>
      </div>

      <UICard>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            defaultValue={deck.name}
            maxLength={80}
            onBlur={(e) => e.target.value.trim() !== deck.name && onSaveMeta({ name: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Formato"
              defaultValue={deck.format ?? ""}
              onBlur={(e) => (e.target.value || null) !== deck.format && onSaveMeta({ format: e.target.value })}
            />
            <div className="flex items-center gap-3 rounded-md border px-3">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1">Deck público</span>
              <Switch checked={deck.is_public} onCheckedChange={(v) => onSaveMeta({ is_public: v })} disabled={savingMeta} />
            </div>
          </div>
          <Textarea
            placeholder="Descrição (estratégia, notas...)"
            defaultValue={deck.description ?? ""}
            rows={2}
            onBlur={(e) => (e.target.value || null) !== deck.description && onSaveMeta({ description: e.target.value })}
          />
          {deck.is_public && (
            <div className="flex items-center gap-2 text-sm bg-secondary rounded-md p-2">
              <span className="truncate flex-1 font-mono text-xs">{shareUrl}</span>
              <Button size="sm" variant="ghost" onClick={copyShare}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </UICard>

      <UICard>
        <CardHeader>
          <CardTitle>Adicionar cartas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, coleção ou número..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {searching && <p className="text-xs text-muted-foreground mt-2">Buscando…</p>}
          {results.length > 0 && (
            <div className="mt-3 divide-y border rounded-md max-h-96 overflow-auto">
              {results.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2 hover:bg-secondary">
                  <img src={r.image} alt={r.name} className="h-14 w-10 object-cover rounded" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.collection} · #{r.card_number} · {r.finish} · {r.language} · {r.condition}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBRL(r.base_price_cents)} · Estoque: {r.stock}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onAdd(r)} disabled={r.stock <= 0 && false /* allow adding even without stock */}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </UICard>

      <UICard>
        <CardHeader>
          <CardTitle>Cartas do deck ({stats.total})</CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {Object.entries(stats.byCategory).map(([k, v]) => (
              <span key={k}>{k}: {v}</span>
            ))}
            <span>· Total estimado: <strong>{formatBRL(stats.priceCents)}</strong></span>
            {stats.missing > 0 && <span className="text-destructive">· Faltam {stats.missing} em estoque</span>}
          </div>
        </CardHeader>
        <CardContent>
          {deck.cards.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma carta ainda. Use a busca acima.</p>
          ) : (
            <div className="divide-y">
              {deck.cards.map((dc) => (
                <div key={dc.id} className="flex items-center gap-3 py-2">
                  {dc.card?.image && (
                    <img src={dc.card.image} alt={dc.card.name} className="h-14 w-10 object-cover rounded" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{dc.card?.name ?? "(carta removida)"}</div>
                    {dc.card && (
                      <div className="text-xs text-muted-foreground truncate">
                        {dc.card.collection} · #{dc.card.card_number} · {dc.card.finish} · {dc.card.language} · {dc.card.condition}
                      </div>
                    )}
                    {dc.card && dc.card.stock < dc.quantity && (
                      <div className="text-xs text-destructive">Estoque insuficiente: {dc.card.stock} de {dc.quantity}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => changeQty(dc.id, dc.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm">{dc.quantity}</span>
                    <Button size="icon" variant="ghost" onClick={() => changeQty(dc.id, dc.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onRemove(dc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </UICard>
    </div>
  );
}
