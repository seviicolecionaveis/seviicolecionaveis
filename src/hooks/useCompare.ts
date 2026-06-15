import { useEffect, useState } from "react";
import type { Card } from "@/data/cards";

const KEY = "sevii_compare_v1";
const MAX = 3;

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
  listeners.forEach((l) => l());
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>(() => read());

  useEffect(() => {
    const listener = () => setIds([...read()]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const has = (id: string) => ids.includes(id);

  const toggle = (card: Card) => {
    const current = read();
    if (current.includes(card.id)) {
      write(current.filter((x) => x !== card.id));
      return { added: false, full: false };
    }
    if (current.length >= MAX) return { added: false, full: true };
    write([...current, card.id]);
    return { added: true, full: false };
  };

  const remove = (id: string) => {
    write(read().filter((x) => x !== id));
  };

  const clear = () => write([]);

  return { ids, count: ids.length, max: MAX, has, toggle, remove, clear };
}
