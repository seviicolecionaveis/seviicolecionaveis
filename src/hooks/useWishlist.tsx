import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WishlistCtx {
  ids: Set<string>;
  loading: boolean;
  toggle: (cardKey: string) => Promise<void>;
  has: (cardKey: string) => boolean;
}

const Ctx = createContext<WishlistCtx>({
  ids: new Set(),
  loading: false,
  toggle: async () => {},
  has: () => false,
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let mounted = true;
    setLoading(true);
    supabase
      .from("wishlist")
      .select("card_key")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!mounted) return;
        setIds(new Set((data ?? []).map((r) => r.card_key as string)));
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const toggle = async (cardKey: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    if (ids.has(cardKey)) {
      const next = new Set(ids);
      next.delete(cardKey);
      setIds(next);
      await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", user.id)
        .eq("card_key", cardKey);
    } else {
      const next = new Set(ids);
      next.add(cardKey);
      setIds(next);
      await supabase
        .from("wishlist")
        .insert({ user_id: user.id, card_key: cardKey });
    }
  };

  return (
    <Ctx.Provider value={{ ids, loading, toggle, has: (k) => ids.has(k) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWishlist = () => useContext(Ctx);
