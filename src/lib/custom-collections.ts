import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CUSTOM_COLLECTIONS_KEY = "custom_collections";

function parseList(value: unknown): string[] {
  const v = (value ?? {}) as Record<string, unknown>;
  const list = Array.isArray(v.list) ? v.list : [];
  return list.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
}

export async function fetchCustomCollections(): Promise<string[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CUSTOM_COLLECTIONS_KEY)
    .maybeSingle();
  return parseList((data as { value?: unknown } | null)?.value);
}

/** Adiciona uma coleção à lista salva (admin). Retorna a lista atualizada. */
export async function addCustomCollection(name: string): Promise<string[]> {
  const clean = name.trim();
  if (!clean) throw new Error("Informe o nome da coleção.");
  const current = await fetchCustomCollections();
  if (current.some((c) => c.toLowerCase() === clean.toLowerCase())) return current;
  const next = [...current, clean].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: CUSTOM_COLLECTIONS_KEY, value: { list: next } }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return next;
}

export function useCustomCollections() {
  const [customCollections, setCustomCollections] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetchCustomCollections()
      .then((l) => { if (active) setCustomCollections(l); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const addCollection = useCallback(async (name: string) => {
    const next = await addCustomCollection(name);
    setCustomCollections(next);
    return next;
  }, []);

  return { customCollections, addCollection };
}
