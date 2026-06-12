import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Share2, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";


export type Sealed = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  is_preorder?: boolean;
  release_date?: string | null;
  product_type?: string | null;
  collection?: string | null;
  language?: string | null;
  distribution?: string | null;
  condition?: string | null;
  age_rating?: string | null;
  sku?: string | null;
};

interface Props {
  item: Sealed | null;
  onClose: () => void;
}

export function SealedModal({ item, onClose }: Props) {
  const { add } = useCart();
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [shared, setShared] = useState(false);

  useEffect(() => { setIdx(0); setQty(1); setShared(false); }, [item?.id]);


  if (!item) return null;

  const imgs = item.images.length ? item.images : [""];
  const isPreorder = !!item.is_preorder;
  const releaseDateLabel = item.release_date
    ? new Date(item.release_date + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  const canBuy = isPreorder ? true : item.stock > 0;
  const maxQty = isPreorder ? 99 : item.stock;
  const price = item.price_cents / 100;

  const handleAdd = () => {
    if (!canBuy) return;
    const namePrefix = isPreorder
      ? `[Pré-venda${releaseDateLabel ? ` ${releaseDateLabel}` : ""}] `
      : "";
    add(
      {
        id: `sealed:${item.id}`,
        cardId: `sealed:${item.id}`,
        name: `${namePrefix}${item.title}`,
        image: imgs[0],
        collection: "Selado",
        number: "—",
        finish: "Selado",
        language: "—",
        condition: "NM",
        unitPrice: price,
        maxStock: maxQty,
      },
      qty,
    );
    toast.success(isPreorder ? "Pré-venda adicionada ao carrinho" : "Adicionado ao carrinho");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 hover:bg-secondary" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
              {imgs[idx] && <img src={imgs[idx]} alt={item.title} className="h-full w-full object-cover" />}
              {imgs.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + imgs.length) % imgs.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % imgs.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background"
                    aria-label="Próxima"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {imgs.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === idx ? "border-primary" : "border-transparent opacity-70"}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-start gap-2">
              <h2 className="text-xl font-bold">{item.title}</h2>
              {isPreorder && (
                <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Pré-venda
                </span>
              )}
            </div>
            {isPreorder && releaseDateLabel && (
              <p className="mt-1 text-sm font-semibold text-primary">
                Envio a partir de {releaseDateLabel}
              </p>
            )}
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{item.description}</p>
            )}

            {(() => {
              const specs: Array<[string, string | null | undefined]> = [
                ["SKU", item.sku],
                ["Produto", item.product_type],
                ["Coleção", item.collection],
                ["Idioma", item.language],
                ["Distribuição", item.distribution],
                ["Condição", item.condition],
                ["Faixa etária", item.age_rating],
              ];
              const filled = specs.filter(([, v]) => v && v.trim());
              if (filled.length === 0) return null;
              return (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {filled.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-semibold text-muted-foreground">{k}:</dt>
                      <dd className="text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            <div className="mt-4 text-2xl font-bold">
              R$ {price.toFixed(2).replace(".", ",")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPreorder
                ? "Reserve agora — o envio ocorrerá após o lançamento."
                : item.stock > 0
                  ? `${item.stock} em estoque`
                  : "Esgotado"}
            </p>

            {canBuy && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm">Qtd.</label>
                <div className="inline-flex items-center rounded-md border border-border">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2 py-1 text-sm">−</button>
                  <span className="px-3 text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="px-2 py-1 text-sm">+</button>
                </div>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={!canBuy}
              className="mt-6 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canBuy ? (isPreorder ? "Reservar pré-venda" : "Adicionar ao carrinho") : "Esgotado"}
            </button>

            <button
              type="button"
              onClick={() => {
                const url = typeof window !== "undefined" ? window.location.href : "https://seviicolecionaveis.com.br/selados";
                const text = `Olha esse produto na Sevii Colecionáveis: ${item.title} — R$ ${price.toFixed(2).replace(".", ",")}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
                setShared(true);
                setTimeout(() => setShared(false), 1500);
              }}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              Compartilhar no WhatsApp
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
