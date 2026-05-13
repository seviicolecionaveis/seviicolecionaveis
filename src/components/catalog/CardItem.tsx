import { type Card, type Finish } from "@/data/cards";
import { priceLookupKey, useCardPrices } from "@/hooks/useCardPrices";
import { cardCreatedAt } from "@/hooks/useCardsCatalog";
import { useWishlist } from "@/hooks/useWishlist";
import { Heart } from "lucide-react";

const finishBadge: Record<Finish, string> = {
  Normal: "bg-background/90 text-foreground",
  Foil: "bg-brand-gold text-brand-gold-foreground",
  "Reverse Foil": "bg-type-psychic text-white",
  Pokebola: "bg-type-fire text-white",
  Energia: "bg-type-grass text-white",
  Promo: "bg-type-electric text-foreground",
  "Ímã": "bg-muted text-foreground",
  "Shattered Holo": "bg-type-dragon/15 text-foreground",
  "Illustration Rare": "bg-type-fairy/20 text-foreground",
  "Ultra Rara": "bg-gradient-to-r from-brand-gold to-type-psychic text-white",
  "Black Star Promo": "bg-foreground text-background",
  "Double Rare": "bg-gradient-to-r from-type-fire to-type-psychic text-white",
};

interface Props {
  card: Card;
  onClick: () => void;
}

export function CardItem({ card, onClick }: Props) {
  const { prices, loading } = useCardPrices();
  const { has, toggle } = useWishlist();
  const out = card.stock === 0;
  const isFav = has(card.id);
  const createdAt = cardCreatedAt.get(card.id);
  const isNew = createdAt
    ? Date.now() - new Date(createdAt).getTime() < 14 * 24 * 60 * 60 * 1000
    : false;
  // Per-variant: prefer manual base price (already in card.price as reais), fallback to Liga price
  const variantPrices = card.languages.flatMap((lang) =>
    lang.finishes.map((variant) => {
      if (variant.price != null) return variant.price * 100; // manual base, in cents
      return prices.get(priceLookupKey(card.name, card.collection, card.number, variant.finish, lang.language));
    }),
  ).filter((p): p is number => p != null);
  const displayPrice = variantPrices.length ? Math.min(...variantPrices) / 100 : null;

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-xl"
      >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
        <img
          src={card.image}
          alt={`${card.name} — ${card.collection} ${card.number}`}
          loading="lazy"
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              `https://placehold.co/400x560/eeeeee/999999?text=${encodeURIComponent(card.name)}`;
          }}
        />
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="rounded-full bg-background/90 backdrop-blur px-2 py-1 text-[10px] font-bold tracking-tight shadow-sm">
            #{card.number}
          </span>
          {isNew && (
            <span className="rounded-full bg-brand-gold text-brand-gold-foreground px-2 py-1 text-[10px] font-bold tracking-tight shadow-sm">
              NOVO
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${finishBadge[card.finish]}`}>
            {card.finish.toUpperCase()}
          </span>
        </div>
        {out && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/40">
            <span className="rounded bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">
              Esgotado
            </span>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{card.name}</h3>
          <p className="truncate text-xs text-muted-foreground uppercase">
            {card.collection}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold">
          {displayPrice != null ? (
            `R$ ${displayPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          ) : loading ? (
            <span className="text-muted-foreground font-medium">Carregando...</span>
          ) : (
            <span className="text-muted-foreground font-medium">Preço pendente</span>
          )}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] font-medium ${
            card.stock === 0
              ? "text-muted-foreground"
              : card.stock <= 2
                ? "text-condition-played"
                : "text-condition-mint"
          }`}
        >
          {card.stock === 0 ? "Indisponível" : `${card.stock} em estoque`}
        </span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span className="text-[10px] text-muted-foreground">
          {card.languages.length === 1
            ? card.languages[0].language
            : `${card.languages.length} idiomas`}
        </span>
        {card.variants.length > 1 && (
          <>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-[10px] text-muted-foreground">
              {card.variants.length} versões
            </span>
          </>
        )}
      </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle(card.id);
        }}
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-background/90 backdrop-blur shadow-sm hover:bg-background transition"
      >
        <Heart
          className={`h-4 w-4 ${isFav ? "fill-brand-gold text-brand-gold" : "text-foreground"}`}
        />
      </button>
    </div>
  );
}
