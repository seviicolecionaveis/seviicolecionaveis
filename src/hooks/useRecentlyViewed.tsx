import { useEffect, useState, useCallback } from "react";

const KEY = "sevii-recently-viewed";
const MAX = 12;

function readStore(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeStore(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

const listeners = new Set<(ids: string[]) => void>();

export function trackRecentlyViewed(cardId: string) {
  if (!cardId) return;
  const current = readStore().filter((id) => id !== cardId);
  const next = [cardId, ...current].slice(0, MAX);
  writeStore(next);
  listeners.forEach((l) => l(next));
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => readStore());

  useEffect(() => {
    const l = (next: string[]) => setIds(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
    listeners.forEach((l) => l([]));
  }, []);

  return { ids, clear };
}
