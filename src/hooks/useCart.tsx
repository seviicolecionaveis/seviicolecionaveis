import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

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

interface CartCtx {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);
const STORAGE = "sevii_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
    } catch {}
  }, [items]);

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

  return (
    <Ctx.Provider value={{ items, add, remove, setQty, clear, count, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
