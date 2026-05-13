import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Card, type Condition, type Finish, type FinishVariant, type LanguageVariant, CONDITION_LABEL } from "@/data/cards";
import { useCart } from "@/hooks/useCart";
import { useCardPrices, priceLookupKey } from "@/hooks/useCardPrices";
import { useWishlist } from "@/hooks/useWishlist";
import { trackCardView } from "@/hooks/useCardStats";
import { cardSlug } from "@/lib/slug";
import { Plus, Check, Heart, Share2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";

// Para cartas Pokémon, o acabamento "Ímã" é um produto interno disponível
// automaticamente: R$10 se a carta possui Foil, senão R$9 se possui Normal.
const MAGNET_VIRTUAL_STOCK = 99;
function buildLanguagesWithMagnet(card: Card): LanguageVariant[] {
  if (card.category !== "Pokémon") return card.languages;
  return card.languages.map((lang) => {
    if (lang.finishes.some((f) => f.finish === "Ímã")) return lang;
    const hasFoil = lang.finishes.some((f) => f.finish === "Foil");
    const hasNormal = lang.finishes.some((f) => f.finish === "Normal");
    const price = hasFoil ? 10 : hasNormal ? 9 : null;
    if (price == null) return lang;
    const magnet: FinishVariant = {
      finish: "Ímã",
      condition: "NM",
      stock: MAGNET_VIRTUAL_STOCK,
      price,
    };
    return {
      ...lang,
      finishes: [...lang.finishes, magnet],
      stock: lang.stock + MAGNET_VIRTUAL_STOCK,
    };
  });
}

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
  "Ímã": "bg-muted-foreground",
  "Shattered Holo": "bg-type-dragon",
  "Illustration Rare": "bg-type-fairy",
  "Ultra Rara": "bg-brand-gold",
};

export function CardModal({ card, onClose }: Props) {
  const { add } = useCart();
  const { prices, loading: pricesLoading } = useCardPrices();
  const { has, toggle } = useWishlist();
  const [added, setAdded] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (card) {
      trackCardView(card.id);
      setZoomed(false);
      setShareCopied(false);
    }
  }, [card]);

  const handleShare = async () => {
    if (!card) return;
    const url = `${window.location.origin}/carta/${cardSlug(card.name, card.collection, card.number)}`;
    const text = `${card.name} (${card.collection} #${card.number}) — Sevii Colecionáveis`;
    if (navigator.share) {
      try {
        await navigator.share({ title: card.name, text, url });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
    }
  };

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
            <div className="relative bg-secondary p-6 grid place-items-center">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="cursor-zoom-in"
                aria-label={zoomed ? "Reduzir imagem" : "Ampliar imagem"}
              >
                <img
                  src={card.image}
                  alt={card.name}
                  className={`w-auto object-contain rounded-lg shadow-2xl transition-transform duration-300 ${
                    zoomed ? "max-h-[140vh] scale-[1.6] cursor-zoom-out" : "max-h-[70vh]"
                  }`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://placehold.co/600x840/eeeeee/999999?text=${encodeURIComponent(card.name)}`;
                  }}
                />
              </button>
              <div className="absolute top-3 left-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-background/90 backdrop-blur shadow-sm hover:bg-background"
                  aria-label={zoomed ? "Reduzir" : "Ampliar"}
                >
                  {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="p-8 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {card.collection} • #{card.number}
                  </p>
                  <DialogTitle className="mt-2 text-3xl font-bold tracking-tight">
                    {card.name}
                  </DialogTitle>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(card.id)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary transition"
                    aria-label={has(card.id) ? "Remover dos favoritos" : "Favoritar"}
                  >
                    <Heart
                      className={`h-4 w-4 ${has(card.id) ? "fill-brand-gold text-brand-gold" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary transition"
                    aria-label="Compartilhar"
                    title={shareCopied ? "Link copiado!" : "Compartilhar"}
                  >
                    {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {card.languages.length}{" "}
                {card.languages.length === 1 ? "idioma" : "idiomas"} •{" "}
                {card.variants.length}{" "}
                {card.variants.length === 1 ? "versão" : "versões"}
              </p>

              <div className="mt-6 space-y-5">
                {buildLanguagesWithMagnet(card).map((lang) => {
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
