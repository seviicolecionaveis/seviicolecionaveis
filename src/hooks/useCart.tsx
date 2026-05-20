import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface CartItem {
  id: string; // unique key: cardId|finish|language|condition
  cardId: string;
  name: string;
  image: string;
  collection: string;
  number: string;
  finish: string;
  language: string;
  condition: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

interface OutOfStockEntry {
  item: CartItem;
  available: number; // current stock available (0 = esgotado)
}

interface CartCtx {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  validateStock: () => Promise<OutOfStockEntry[]>;
}

const Ctx = createContext<CartCtx | null>(null);
const STORAGE = "sevii_cart_v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [outOfStock, setOutOfStock] = useState<OutOfStockEntry[]>([]);
  const validatingRef = useRef(false);

  // Hydrate from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist only after hydration to avoid wiping storage with the initial [] state
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add: CartCtx["add"] = (item, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, existing.maxStock);
        return prev.map((p) => (p.id === item.id ? { ...p, quantity: newQty } : p));
      }
      return [...prev, { ...item, quantity: Math.min(qty, item.maxStock) }];
    });
    trackEvent("add_to_cart", {
      currency: "BRL",
      value: item.unitPrice * qty,
      items: [{
        item_id: item.id,
        item_name: item.name,
        item_category: item.collection,
        item_variant: `${item.finish}/${item.language}/${item.condition}`,
        price: item.unitPrice,
        quantity: qty,
      }],
    });
  };

  const remove = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const setQty = (id: string, qty: number) =>
    setItems((p) =>
      p.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxStock)) } : i)),
    );
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const validateStock = useCallback(async (): Promise<OutOfStockEntry[]> => {
    if (validatingRef.current) return [];
    validatingRef.current = true;
    try {
      const ids = Array.from(new Set(items.map((i) => i.cardId).filter((id) => UUID_RE.test(id))));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("cards")
        .select("id, stock")
        .in("id", ids);
      if (error || !data) return [];
      const stockById = new Map(data.map((c) => [c.id, c.stock ?? 0]));
      const offenders: OutOfStockEntry[] = [];
      for (const it of items) {
        if (!UUID_RE.test(it.cardId)) continue;
        const available = stockById.get(it.cardId) ?? 0;
        if (available < it.quantity) {
          offenders.push({ item: it, available });
        }
      }
      if (offenders.length > 0) setOutOfStock(offenders);
      return offenders;
    } finally {
      validatingRef.current = false;
    }
  }, [items]);

  // Validate stock after hydration and whenever items change (debounced)
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const t = setTimeout(() => {
      validateStock();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.length]);

  const dismissOutOfStock = () => {
    const idsToRemove = new Set(outOfStock.map((o) => o.item.id));
    setItems((prev) => prev.filter((i) => !idsToRemove.has(i.id)));
    setOutOfStock([]);
  };

  return (
    <Ctx.Provider value={{ items, add, remove, setQty, clear, count, subtotal, validateStock }}>
      {children}
      <AlertDialog open={outOfStock.length > 0}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {outOfStock.length === 1 ? "Item esgotado" : "Itens esgotados"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {outOfStock.length === 1
                    ? "O item abaixo foi esgotado enquanto estava no seu carrinho e será removido:"
                    : "Os itens abaixo foram esgotados enquanto estavam no seu carrinho e serão removidos:"}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {outOfStock.map((o) => (
                    <li key={o.item.id}>
                      <span className="font-semibold">{o.item.name}</span>{" "}
                      <span className="text-muted-foreground">
                        ({o.item.collection} · #{o.item.number} · {o.item.finish} · {o.item.language} · {o.item.condition})
                      </span>
                      {o.available > 0 && o.available < o.item.quantity && (
                        <span className="text-muted-foreground"> — restam apenas {o.available}, você tinha {o.item.quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissOutOfStock}>Entendi, remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
