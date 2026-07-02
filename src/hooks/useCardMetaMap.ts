import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CardMeta {
  category: string | null;
  pokemonType: string | null;
  trainerSubcategory: string | null;
}

export function useCardMetaMap(cardIds: string[]): Map<string, CardMeta> {
  const [map, setMap] = useState<Map<string, CardMeta>>(new Map());
  const key = Array.from(new Set(cardIds.filter((id) => UUID_RE.test(id)))).sort().join(",");

  useEffect(() => {
    if (!key) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    const ids = key.split(",");
    (async () => {
      const { data } = await supabase
        .from("cards")
        .select("id, category, pokemon_type, trainer_subcategory")
        .in("id", ids);
      if (cancelled) return;
      const m = new Map<string, CardMeta>();
      (data ?? []).forEach((r: any) => {
        m.set(r.id, {
          category: r.category ?? null,
          pokemonType: r.pokemon_type ?? null,
          trainerSubcategory: r.trainer_subcategory ?? null,
        });
      });
      setMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}
