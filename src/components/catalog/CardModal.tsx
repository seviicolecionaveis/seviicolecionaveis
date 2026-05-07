import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Card, type Condition, type Finish, CONDITION_LABEL } from "@/data/cards";
import { useCart } from "@/hooks/useCart";
import { useCardPrices, priceLookupKey } from "@/hooks/useCardPrices";
import { Plus, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  card: Card | null;
  onClose: () => void;
}

const finishDot: Record<Finish, string> = {
  Normal: "bg-muted-foreground",
  Foil: "bg-brand-gold",
  "Reverse Foil": "bg-type-psychic",
  Pokebola: "bg-type-fire",
  Energia: "bg-type-grass",
  Promo: "bg-type-electric",
};

export function CardModal({ card, onClose }: Props) {
  const { add } = useCart();
  const { prices, loading: pricesLoading } = useCardPrices();
  const [added, setAdded] = useState<string | null>(null);

  const resolvePrice = (finish: Finish, language: string): number | null => {
    if (!card) return null;
    const key = priceLookupKey(card.name, card.collection, card.number, finish, language);
    const fromDb = prices.get(key);
    return fromDb != null ? fromDb / 100 : null;
  };
  const handleAdd = (lang: string, v: { finish: Finish; condition: Condition; price: number | null; stock: number }) => {
    if (!card || v.price == null || v.stock === 0) return;
    const id = `${card.id}|${v.finish}|${lang}|${v.condition}`;
    add({
      id,
      cardId: card.id,
      name: card.name,
      image: card.image,
      collection: card.collection,
      number: card.number,
      finish: v.finish,
      language: lang,
      condition: v.condition,
      unitPrice: v.price,
      maxStock: v.stock,
    });
    setAdded(id);
    setTimeout(() => setAdded((cur) => (cur === id ? null : cur)), 1500);
  };
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background max-h-[90vh] overflow-y-auto">
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

              <p className="mt-2 text-xs text-muted-foreground">
                {card.languages.length}{" "}
                {card.languages.length === 1 ? "idioma" : "idiomas"} •{" "}
                {card.variants.length}{" "}
                {card.variants.length === 1 ? "versão" : "versões"}
              </p>

              <div className="mt-6 space-y-5">
                {card.languages.map((lang) => {
                  const langOut = lang.stock === 0;
                  return (
                    <div key={lang.language}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                          {lang.language}
                        </p>
                        <span
                          className={`text-[10px] uppercase tracking-wider ${
                            langOut ? "text-muted-foreground" : "text-foreground/70"
                          }`}
                        >
                          {langOut ? "Esgotado" : `${lang.stock} un. no total`}
                        </span>
                      </div>
                      <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                        {lang.finishes.map((v) => {
                          const out = v.stock === 0;
                          const ligaPrice = resolvePrice(v.finish, lang.language);
                          const effectivePrice = v.price ?? ligaPrice;
                          const effectiveVariant = { ...v, price: effectivePrice };
                          const id = `${card.id}|${v.finish}|${lang.language}|${v.condition}`;
                          const isAdded = added === id;
                          return (
                            <li
                              key={`${v.finish}-${v.condition}`}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                                out ? "opacity-50" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-2 w-2 rounded-full ${finishDot[v.finish]}`} />
                                <span className="font-medium truncate">{v.finish}</span>
                                <span
                                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                                  title={CONDITION_LABEL[v.condition]}
                                >
                                  {v.condition}
                                </span>
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
                                <span className="min-w-[94px] text-right text-sm font-bold tabular-nums">
                                  {effectivePrice != null ? (
                                    `R$ ${effectivePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                  ) : pricesLoading ? (
                                    <span className="text-xs text-muted-foreground font-medium">Carregando...</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground font-medium">Preço pendente</span>
                                  )}
                                </span>
                                {!out && effectivePrice != null && (
                                  <button
                                    onClick={() => handleAdd(lang.language, effectiveVariant)}
                                    className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition"
                                    aria-label="Adicionar ao carrinho"
                                  >
                                    {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
