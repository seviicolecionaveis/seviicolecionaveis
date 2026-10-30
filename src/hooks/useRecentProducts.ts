import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Sealed } from "@/components/catalog/SealedModal";
import type { Panel } from "@/components/catalog/PanelModal";
import type { Accessory } from "@/components/catalog/AccessoryModal";
import { parseVariants } from "@/lib/accessory-variants";

export type SealedWithCreated = Sealed & { created_at: string };
export type PanelWithCreated = Panel & { created_at: string };
export type AccessoryWithCreated = Accessory & { created_at: string };

export type OtherProductEntry =
  | { kind: "panel"; t: number; panel: PanelWithCreated }
  | { kind: "sealed"; t: number; sealed: SealedWithCreated }
  | { kind: "accessory"; t: number; accessory: AccessoryWithCreated };

interface Raw {
  panels: PanelWithCreated[];
  sealed: SealedWithCreated[];
  accessories: AccessoryWithCreated[];
}

let cache: Raw | null = null;
let inFlight: Promise<Raw> | null = null;

async function loadRaw(): Promise<Raw> {
  const [p, s, a, additions] = await Promise.all([
    supabase
      .from("panels")
      .select("id, title, description, price_cents, stock, images, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("sealed_products")
      .select("id, title, description, price_cents, stock, images, is_preorder, release_date, product_type, collection, language, distribution, condition, age_rating, sku, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("accessories")
      .select("id, title, description, category, price_cents, stock, images, variants, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase.rpc("catalog_last_product_additions"),
  ]);

  const lastAdded = new Map<string, string>();
  for (const r of (additions.data ?? []) as { product_table: string; product_id: string; last_added_at: string }[]) {
    if (!r.last_added_at) continue;
    const key = `${r.product_table}:${r.product_id}`;
    const cur = lastAdded.get(key);
    if (!cur || r.last_added_at > cur) lastAdded.set(key, r.last_added_at);
  }

  return {
    panels: (p.data ?? []) as PanelWithCreated[],
    sealed: (s.data ?? []) as SealedWithCreated[],
    accessories: (a.data ?? []) as AccessoryWithCreated[],
  };
}

/**
 * Painéis, produtos lacrados e acessórios adicionados ou reabastecidos recentemente.
 * A data de atividade é a criação do cadastro ou a última reposição de estoque (delta > 0).
 */
export function useRecentProducts(windowDays: number) {
  const [raw, setRaw] = useState<Raw | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    if (cache) {
      setRaw(cache);
      setLoading(false);
      return;
    }
    if (!inFlight) {
      inFlight = loadRaw()
        .then((r) => {
          cache = r;
          return r;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    inFlight
      .then((r) => {
        if (mounted) {
          setRaw(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const entries = useMemo<OtherProductEntry[]>(() => {
    if (!raw) return [];
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const out: OtherProductEntry[] = [];

    const activity = (created: string, key: string) => {
      const added = lastAddedRaw.get(key);
      const t1 = created ? new Date(created).getTime() : 0;
      const t2 = added ? new Date(added).getTime() : 0;
      return Math.max(t1, t2);
    };
    const lastAddedRaw = collectLastAdded(raw);

    for (const panel of raw.panels) {
      if (panel.stock <= 0) continue;
      const t = activity(panel.created_at, `panels:${panel.id}`);
      if (t && t >= cutoff) out.push({ kind: "panel", t, panel });
    }
    for (const sealed of raw.sealed) {
      if (!(sealed.stock > 0 || sealed.is_preorder)) continue;
      const t = activity(sealed.created_at, `sealed_products:${sealed.id}`);
      if (t && t >= cutoff) out.push({ kind: "sealed", t, sealed });
    }
    for (const accessory of raw.accessories) {
      const vs = parseVariants(accessory.variants);
      const inStock = (accessory.stock ?? 0) > 0 || vs.some((v) => (v.stock ?? 0) > 0);
      if (!inStock) continue;
      const t = activity(accessory.created_at, `accessories:${accessory.id}`);
      if (t && t >= cutoff) out.push({ kind: "accessory", t, accessory });
    }

    out.sort((a, b) => b.t - a.t);
    return out;
  }, [raw, windowDays]);

  return { entries, loading };
}
