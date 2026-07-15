import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { listMyDecks, createDeck, deleteDeck, type DeckSummary } from "@/lib/decks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ExternalLink, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/deck-builder")({
  head: () => ({
    meta: [
      { title: "Deck Builder — Sevii Colecionáveis" },
      { name: "description", content: "Monte, salve e compartilhe seus decks Pokémon com cartas do estoque da Sevii." },
      { property: "og:title", content: "Deck Builder — Sevii Colecionáveis" },
      { property: "og:description", content: "Monte, salve e compartilhe seus decks Pokémon." },
    ],
  }),
  component: DeckBuilderList,
});

function DeckBuilderList() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listMyDecks);
  const create = useServerFn(createDeck);
  const del = useServerFn(deleteDeck);

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  const reload = async () => {
    setLoading(true);
    try {
      setDecks(await list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await create({ data: { name, description, format } });
      toast.success("Deck criado");
      nav({ to: "/deck-builder/$deckId", params: { deckId: r.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar deck");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Apagar este deck?")) return;
    await del({ data: { id } });
    toast.success("Deck apagado");
    reload();
  };

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Layers className="h-7 w-7" /> Deck Builder
      </h1>
      <p className="text-muted-foreground mt-1">Monte seus decks com cartas do estoque, adicione as faltantes ao carrinho e compartilhe com amigos.</p>

      <UICard className="mt-6">
        <CardHeader>
          <CardTitle>Criar novo deck</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <Input placeholder="Nome do deck (ex: Charizard ex Standard)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Formato (opcional: Standard, Expanded, Casual...)" value={format} onChange={(e) => setFormat(e.target.value)} />
            </div>
            <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Button type="submit" disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Criar deck
            </Button>
          </form>
        </CardContent>
      </UICard>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Meus decks ({decks.length})</h2>
        {loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : decks.length === 0 ? (
          <p className="text-muted-foreground">Você ainda não criou nenhum deck.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {decks.map((d) => (
              <UICard key={d.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {d.card_count} cartas{d.format ? ` · ${d.format}` : ""}
                    {d.is_public && <> · <span className="text-emerald-600">Público</span></>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex items-end justify-between gap-2 pt-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/deck-builder/$deckId" params={{ deckId: d.id }}>Editar</Link>
                  </Button>
                  <div className="flex gap-1">
                    {d.is_public && (
                      <Button asChild size="icon" variant="ghost" title="Ver link público">
                        <Link to="/baralho/$token" params={{ token: d.share_token }}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => onDelete(d.id)} title="Apagar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </UICard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
