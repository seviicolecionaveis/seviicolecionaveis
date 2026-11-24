import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { findCartShortages, type CartStockRow } from "@/lib/cart-stock";
import { parseAccessoryCartId, parseVariants } from "@/lib/accessory-variants";
import { fetchEventMode } from "@/lib/event-mode";
import { supabase } from "@/integrations/supabase/client";
import { trackCardInterestCart, removeCardInterestCart } from "@/hooks/useCardInterest";
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
    trackCardInterestCart(item.cardId);
  };

  const remove = (id: string) => setItems((p) => {
    const removed = p.find((i) => i.id === id);
    if (removed && !p.some((i) => i.id !== id && i.cardId === removed.cardId)) {
      removeCardInterestCart(removed.cardId);
    }
    return p.filter((i) => i.id !== id);
  });
  const setQty = (id: string, qty: number) =>
    setItems((p) =>
      p.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxStock)) } : i)),
    );
  const clear = () => {
    setItems((prev) => {
      const uniqueCardIds = Array.from(new Set(prev.map((i) => i.cardId)));
      uniqueCardIds.forEach((cid) => removeCardInterestCart(cid));
      return [];
    });
  };

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const validateStock = useCallback(async (): Promise<OutOfStockEntry[]> => {
    if (validatingRef.current) return [];
    validatingRef.current = true;
    try {
      const ids = Array.from(new Set(items.map((i) => i.cardId).filter((id) => UUID_RE.test(id))));
      const rows: CartStockRow[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase.from("cards").select("id, stock, event_reserved").in("id", ids);
        if (error || !data) return [];
        rows.push(...data);
      }
      // Produtos com estoque próprio: painéis, lacrados, videogames e acessórios (com variação)
      const prefixed = (prefix: string) =>
        Array.from(new Set(items.filter((i) => i.cardId.startsWith(prefix)).map((i) => i.cardId.slice(prefix.length))));
      for (const [prefix, table] of [["panel:", "panels"], ["sealed:", "sealed_products"], ["videogame:", "videogames"]] as const) {
        const pIds = prefixed(prefix);
        if (pIds.length === 0) continue;
        const { data, error } = await supabase.from(table).select("id, stock").in("id", pIds);
        if (error || !data) return [];
        rows.push(...data.map((r) => ({ id: prefix + r.id, stock: r.stock })));
      }
      const accItems = items.filter((i) => i.cardId.startsWith("accessory:"));
      if (accItems.length > 0) {
        const accIds = Array.from(new Set(accItems.map((i) => parseAccessoryCartId(i.cardId).accessoryId)));
        const { data, error } = await supabase.from("accessories").select("id, stock, variants").in("id", accIds);
        if (error || !data) return [];
        for (const it of accItems) {
          const { accessoryId, variantId } = parseAccessoryCartId(it.cardId);
          const acc = data.find((a) => a.id === accessoryId);
          if (!acc) continue; // ausente = esgotado
          const stock = variantId ? parseVariants(acc.variants).find((v) => v.id === variantId)?.stock ?? 0 : acc.stock;
          rows.push({ id: it.cardId, stock });
        }
      }
      const checkable = items.filter(
        (i) => UUID_RE.test(i.cardId) || /^(panel|sealed|videogame|accessory):/.test(i.cardId),
      );
      if (checkable.length === 0) return [];
      const offenders: OutOfStockEntry[] = findCartShortages(checkable, rows);
      if (offenders.length > 0) {
        const byId = new Map(offenders.map((o) => [o.item.id, o.available]));
        setItems((prev) =>
          prev.flatMap((i) => {
            if (!byId.has(i.id)) return [i];
            const avail = byId.get(i.id) ?? 0;
            return avail > 0 ? [{ ...i, quantity: avail, maxStock: avail }] : [];
          }),
        );
        setOutOfStock(offenders);
      }
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

  // Revalida ao voltar para a aba, a cada minuto e quando a loja é pausada/liberada
  // (ex.: admins bloqueiam o site para atualizar o estoque).
  const validateRef = useRef(validateStock);
  validateRef.current = validateStock;
  const lastModeRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const check = async () => {
      try {
        const mode = await fetchEventMode();
        const prev = lastModeRef.current;
        lastModeRef.current = mode.enabled;
        if (prev !== null && prev !== mode.enabled) window.dispatchEvent(new CustomEvent("sevii:event-mode", { detail: mode }));
      } catch {}
      void validateRef.current();
    };
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    const t = setInterval(check, 60_000);
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydrated, items.length]);

  const dismissOutOfStock = () => setOutOfStock([]);

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
                    ? "O item abaixo esgotou enquanto estava no seu carrinho. Seu carrinho foi atualizado automaticamente:"
                    : "Os itens abaixo esgotaram enquanto estavam no seu carrinho. Seu carrinho foi atualizado automaticamente:"}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {outOfStock.map((o) => (
                    <li key={o.item.id}>
                      <span className="font-semibold">{o.item.name}</span>{" "}
                      <span className="text-muted-foreground">
                        ({o.item.collection} · #{o.item.number} · {o.item.finish} · {o.item.language} · {o.item.condition})
                      </span>
                      {o.available > 0 && o.available < o.item.quantity && (
                        <span className="text-muted-foreground"> — restam apenas {o.available}, a quantidade foi ajustada</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissOutOfStock}>Entendi</AlertDialogAction>
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
