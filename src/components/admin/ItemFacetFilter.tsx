import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Filtro multi-seleção com busca, usado nos filtros de itens dos pedidos (admin). */
export function ItemFacetFilter({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.toLowerCase().includes(query));
  }, [options, q]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            selected.length
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:bg-secondary"
          }`}
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] tabular-nums">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b border-border p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nenhuma opção.</p>
          ) : (
            visible.map((o) => {
              const active = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      active ? "border-foreground bg-foreground text-background" : "border-border"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o}</span>
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpar seleção
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
