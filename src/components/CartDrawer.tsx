import { ShoppingBag, X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { Link } from "@tanstack/react-router";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const { items, remove, setQty, subtotal } = useCart();

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-background shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Carrinho ({items.length})
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Seu carrinho está vazio.
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3 border-b border-border pb-4">
                  <img
                    src={i.image}
                    alt={i.name}
                    className="h-20 w-14 object-contain rounded bg-secondary"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        `https://placehold.co/80x112/eee/999?text=?`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{i.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {i.collection} • #{i.number}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {i.finish} · {i.language}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 border border-border rounded-full">
                        <button
                          onClick={() => setQty(i.id, i.quantity - 1)}
                          className="grid h-6 w-6 place-items-center hover:bg-secondary rounded-full"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs w-6 text-center tabular-nums">{i.quantity}</span>
                        <button
                          onClick={() => setQty(i.id, i.quantity + 1)}
                          disabled={i.quantity >= i.maxStock}
                          className="grid h-6 w-6 place-items-center hover:bg-secondary rounded-full disabled:opacity-30"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        R$ {(i.unitPrice * i.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(i.id)}
                    className="text-muted-foreground hover:text-foreground self-start"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold tabular-nums">
                R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Frete calculado no checkout.</p>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full text-center rounded-full bg-foreground py-3 text-sm font-semibold text-background hover:bg-foreground/90"
            >
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
