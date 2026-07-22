import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Illustrator {
  id: string;
  name: string;
}

let cache: Illustrator[] | null = null;
let inFlight: Promise<Illustrator[]> | null = null;
const listeners = new Set<(list: Illustrator[]) => void>();

async function load(): Promise<Illustrator[]> {
  const { data, error } = await (supabase as any)
    .from("illustrators")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    console.error("[illustrators] load", error);
    return [];
  }
  return ((data ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

function refresh(): Promise<Illustrator[]> {
  if (!inFlight) {
    inFlight = load()
      .then((l) => {
        cache = l;
        listeners.forEach((cb) => cb(l));
        return l;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function invalidateIllustratorsCache() {
  cache = null;
}

export function useIllustrators() {
  const [list, setList] = useState<Illustrator[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    const cb = (l: Illustrator[]) => {
      if (mounted) {
        setList(l);
        setLoading(false);
      }
    };
    listeners.add(cb);
    if (!cache) {
      refresh().then((l) => {
        if (mounted) {
          setList(l);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
      listeners.delete(cb);
    };
  }, []);

  return {
    illustrators: list,
    loading,
    refresh: async () => {
      invalidateIllustratorsCache();
      const l = await refresh();
      setList(l);
    },
  };
}

/**
 * Insere um novo ilustrador (ou devolve o existente, case-insensitive).
 * Restrito a admins via RLS.
 */
export async function createIllustrator(name: string): Promise<Illustrator | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: existing } = await (supabase as any)
    .from("illustrators")
    .select("id, name")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) {
    return { id: existing.id as string, name: existing.name as string };
  }

  const { data, error } = await (supabase as any)
    .from("illustrators")
    .insert({ name: trimmed })
    .select("id, name")
    .single();
  if (error) {
    console.error("[illustrators] create", error);
    return null;
  }
  invalidateIllustratorsCache();
  await refresh();
  return { id: data.id as string, name: data.name as string };
}
