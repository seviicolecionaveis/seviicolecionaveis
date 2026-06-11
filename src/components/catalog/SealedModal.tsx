import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
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
};

interface Props {
  item: Sealed | null;
  onClose: () => void;
}

export function SealedModal({ item, onClose }: Props) {
  const { add } = useCart();
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => { setIdx(0); setQty(1); }, [item?.id]);

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
            <h2 className="text-xl font-bold">{item.title}</h2>
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{item.description}</p>
            )}

            <div className="mt-4 text-2xl font-bold">
              R$ {price.toFixed(2).replace(".", ",")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {inStock ? `${item.stock} em estoque` : "Esgotado"}
            </p>

            {inStock && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm">Qtd.</label>
                <div className="inline-flex items-center rounded-md border border-border">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2 py-1 text-sm">−</button>
                  <span className="px-3 text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(item.stock, q + 1))} className="px-2 py-1 text-sm">+</button>
                </div>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={!inStock}
              className="mt-6 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inStock ? "Adicionar ao carrinho" : "Esgotado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
