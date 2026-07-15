import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getSharedWishlist, type SharedWishlistCard } from "@/lib/wishlist-share.functions";
import logoUrl from "@/assets/logo.webp";
import { cardSlug } from "@/lib/slug";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/lista-desejos/$token")({
  loader: async ({ params }) => {
    const result = await getSharedWishlist({ data: { token: params.token } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const owner = loaderData?.ownerName ?? "Sevii Colecionáveis";
    const title = `Lista de desejos de ${owner}`;
    return {
      meta: [
        { title },
        { name: "description", content: `Cartas Pokémon que ${owner} está de olho na Sevii Colecionáveis.` },
        { property: "og:title", content: title },
        { property: "og:description", content: "Veja as cartas favoritas compartilhadas." },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">Link inválido ou revogado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link não está mais disponível.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium underline">Ir ao catálogo</Link>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center text-sm text-muted-foreground">
      Erro ao carregar a lista.
    </div>
  ),
  component: SharedWishlistPage,
});

function SharedWishlistPage() {
  const data = Route.useLoaderData() as { ownerName: string | null; cards: SharedWishlistCard[] };
  const { ownerName, cards } = data;
  const title = ownerName ? `Lista de desejos de ${ownerName}` : "Lista de desejos compartilhada";
  const { add, items } = useCart();
  const inStock = cards.filter((c) => c.stock > 0 && c.base_price_cents != null);

  const addAll = () => {
    let added = 0;
    for (const c of inStock) {
      const id = `${c.id}|${c.finish}|${c.language}|${c.condition}`;
      if (items.some((i) => i.id === id)) continue;
      add({
        id,
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
      });
      added += 1;
    }
    if (added > 0) toast.success(`${added} carta(s) adicionadas ao carrinho`);
    else toast.info("Nada novo para adicionar (já no carrinho ou esgotado).");
  };

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          {cards.length} {cards.length === 1 ? "carta" : "cartas"}
        </p>

        {inStock.length > 0 && (
          <button
            type="button"
            onClick={addAll}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:bg-foreground/90"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Adicionar {inStock.length} {inStock.length === 1 ? "carta" : "cartas"} ao meu carrinho
          </button>
        )}

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma carta na lista ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <SharedCard key={c.id} card={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SharedCard({ card }: { card: SharedWishlistCard }) {
  const slug = cardSlug(card.name, card.collection, card.card_number);
  const price = card.base_price_cents != null ? card.base_price_cents / 100 : null;
  const out = card.stock <= 0;
  return (
    <Link
      to="/carta/$slug"
      params={{ slug }}
      className="group block"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg bg-secondary">
        <img
          src={card.image}
          alt={card.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              `https://placehold.co/400x560/eeeeee/999999?text=${encodeURIComponent(card.name)}`;
          }}
        />
        {out && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <span className="text-xs font-bold uppercase tracking-widest text-white">Esgotado</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
        {card.collection} • #{card.card_number}
      </p>
      <p className="text-sm font-semibold truncate">{card.name}</p>
      {price != null && (
        <p className="text-sm font-bold tabular-nums">
          R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      )}
    </Link>
  );
}
