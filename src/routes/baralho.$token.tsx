import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicDeck, type PublicDeck } from "@/lib/decks.functions";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/baralho/$token")({
  loader: async ({ params }) => {
    const deck = await getPublicDeck({ data: { token: params.token } });
    if (!deck) throw notFound();
    return { deck };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.deck?.name ?? "Deck compartilhado";
    return {
      meta: [
        { title: `${name} — Deck Sevii Colecionáveis` },
        { name: "description", content: `Deck Pokémon compartilhado: ${name}` },
        { property: "og:title", content: `${name} — Deck Pokémon` },
        { property: "og:description", content: loaderData?.deck?.description ?? "Deck Pokémon compartilhado na Sevii Colecionáveis." },
        { property: "og:type", content: "article" },
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-10 text-center">
      <p>Não foi possível carregar este deck.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">Deck não encontrado</h1>
      <p className="text-muted-foreground mt-2">Este link foi removido ou o deck está privado.</p>
    </div>
  ),
  component: PublicDeckPage,
});

function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PublicDeckPage() {
  const { deck } = Route.useLoaderData();
  const total = deck.cards.reduce((s, dc) => s + dc.quantity, 0);
  const priceCents = deck.cards.reduce(
    (s, dc) => s + (dc.card?.base_price_cents ?? 0) * dc.quantity,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Layers className="h-4 w-4" /> Deck compartilhado
          {deck.owner_name && <> · por {deck.owner_name}</>}
        </div>
        <h1 className="text-3xl font-bold mt-1">{deck.name}</h1>
        {deck.format && <p className="text-sm text-muted-foreground">Formato: {deck.format}</p>}
        {deck.description && <p className="mt-3 text-sm whitespace-pre-line">{deck.description}</p>}
      </div>

      <UICard>
        <CardHeader>
          <CardTitle>{total} cartas · Total estimado {formatBRL(priceCents)}</CardTitle>
        </CardHeader>
        <CardContent>
          {deck.cards.length === 0 ? (
            <p className="text-muted-foreground text-sm">Deck vazio.</p>
          ) : (
            <div className="divide-y">
              {deck.cards.map((dc) => (
                <div key={dc.id} className="flex items-center gap-3 py-2">
                  {dc.card?.image && (
                    <img src={dc.card.image} alt={dc.card.name} className="h-14 w-10 object-cover rounded" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {dc.quantity}× {dc.card?.name ?? "(carta removida)"}
                    </div>
                    {dc.card && (
                      <div className="text-xs text-muted-foreground truncate">
                        {dc.card.collection} · #{dc.card.card_number} · {dc.card.finish} · {dc.card.language}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{formatBRL(dc.card?.base_price_cents)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </UICard>
    </div>
  );
}
