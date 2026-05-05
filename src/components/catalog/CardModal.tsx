import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Card, type Finish } from "@/data/cards";

interface Props {
  card: Card | null;
  onClose: () => void;
}

const finishDot: Record<Finish, string> = {
  Normal: "bg-muted-foreground",
  Foil: "bg-brand-gold",
  "Reverse Foil": "bg-type-psychic",
  Pokebola: "bg-type-fire",
  Promo: "bg-type-electric",
};

export function CardModal({ card, onClose }: Props) {
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
        {card && (
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="bg-secondary p-6 grid place-items-center">
              <img
                src={card.image}
                alt={card.name}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://placehold.co/600x840/eeeeee/999999?text=${encodeURIComponent(card.name)}`;
                }}
              />
            </div>
            <div className="p-8 flex flex-col">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {card.collection} • #{card.number}
              </p>
              <DialogTitle className="mt-2 text-3xl font-bold tracking-tight">
                {card.name}
              </DialogTitle>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Idioma</dt>
                  <dd className="font-medium">{card.language}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Numeração</dt>
                  <dd className="font-medium">{card.number}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <p className="text-xs uppercase text-muted-foreground tracking-wider mb-3">
                  Estoque por acabamento
                </p>
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {card.variants.map((v) => {
                    const out = v.stock === 0;
                    return (
                      <li
                        key={v.finish}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                          out ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${finishDot[v.finish]}`} />
                          <span className="font-medium truncate">{v.finish}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs ${
                              out
                                ? "text-muted-foreground"
                                : v.stock <= 2
                                  ? "text-condition-played"
                                  : "text-condition-mint"
                            }`}
                          >
                            {out ? "Esgotado" : `${v.stock} un.`}
                          </span>
                          <span className="text-sm font-bold tabular-nums">
                            {v.price != null
                              ? `R$ ${v.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : <span className="text-xs text-muted-foreground font-medium">Sob consulta</span>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-auto pt-6">
                <button
                  disabled={card.stock === 0}
                  className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {card.stock === 0 ? "Indisponível" : "Reservar carta"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
