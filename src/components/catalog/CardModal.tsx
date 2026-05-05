import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Card, TYPE_LABELS } from "@/data/cards";

interface Props {
  card: Card | null;
  onClose: () => void;
}

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
                    `https://placehold.co/600x840/eeeeee/cccccc?text=${encodeURIComponent(card.name)}`;
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
              <p className="mt-1 text-sm text-muted-foreground">{card.rarity}</p>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Tipo</dt>
                  <dd className="font-medium">{TYPE_LABELS[card.type]}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Condição</dt>
                  <dd className="font-medium">{card.condition}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Idioma</dt>
                  <dd className="font-medium">{card.language}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wider">Estoque</dt>
                  <dd className="font-medium">{card.stock} unidade(s)</dd>
                </div>
              </dl>

              <div className="mt-auto pt-8">
                <p className="text-xs uppercase text-muted-foreground tracking-wider">Preço</p>
                <p className="text-4xl font-bold">
                  R$ {card.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <button
                  disabled={card.stock === 0}
                  className="mt-4 w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
