import { useEffect, useMemo, useRef, useState } from "react";
import { useIllustrators, createIllustrator } from "@/lib/illustrators";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function IllustratorCombobox({ value, onChange, placeholder = "Buscar ilustrador..." }: Props) {
  const { illustrators } = useIllustrators();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = illustrators.find((i) => i.id === value) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const sorted = [...illustrators].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (!q) return sorted.slice(0, 200);
    return sorted.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 200);
  }, [illustrators, q]);

  const exactMatch = q ? illustrators.some((i) => i.name.trim().toLowerCase() === q) : false;

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const created = await createIllustrator(name);
    setCreating(false);
    if (created) {
      onChange(created.id);
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded border border-border bg-background px-3 py-2 text-left text-sm hover:bg-secondary/40"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.name : "— Nenhum —"}
        </span>
        <span className="text-xs text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-md border border-border bg-popover shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full border-b border-border bg-background px-3 py-2 text-sm focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                — Remover seleção —
              </button>
            )}
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-secondary ${
                  value === i.id ? "bg-secondary/60 font-semibold" : ""
                }`}
              >
                {i.name}
              </button>
            ))}
            {filtered.length === 0 && !q && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Digite para buscar.</p>
            )}
            {q && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full border-t border-border px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {creating ? "Criando..." : `+ Criar "${query.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
