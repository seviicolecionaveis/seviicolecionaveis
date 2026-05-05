import { type Card } from "@/data/cards";

const conditionClass: Record<string, string> = {
  Mint: "bg-condition-mint text-white",
  "Near Mint": "bg-condition-near-mint text-white",
  Excellent: "bg-condition-excellent text-foreground",
  Played: "bg-condition-played text-white",
  Poor: "bg-condition-poor text-white",
};

interface Props {
  card: Card;
  onClick: () => void;
}

export function CardItem({ card, onClick }: Props) {
  const out = card.stock === 0;
  return (
    <button
      onClick={onClick}
      className="group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-xl"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
        <img
          src={card.image}
          alt={`${card.name} — ${card.collection} ${card.number}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              `https://placehold.co/400x560/eeeeee/cccccc?text=${encodeURIComponent(card.name)}`;
          }}
        />
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-background/90 backdrop-blur px-2 py-1 text-[10px] font-bold tracking-tight shadow-sm">
            #{card.number}
          </span>
        </div>
        <div className="absolute bottom-3 right-3">
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${conditionClass[card.condition]}`}>
            {card.condition.toUpperCase()}
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
          <h4 className="truncate text-sm font-semibold">{card.name}</h4>
          <p className="truncate text-xs text-muted-foreground uppercase">
            {card.collection} • {card.language}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold">
          R$ {card.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
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
        <span className="text-[10px] text-muted-foreground">{card.rarity}</span>
      </div>
    </button>
  );
}
