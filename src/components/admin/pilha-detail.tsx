import { useState } from "react";
import { ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type { AdminStackItem } from "@/lib/admin-pilha.functions";
import { adminSetStackItemPicked } from "@/lib/admin-pilha-detail.functions";

export const fmtMoney = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}

export function Thumb({ item }: { item: AdminStackItem }) {
  if (!item.card_image) {
    return (
      <div className="h-16 w-12 rounded-md bg-muted grid place-items-center text-muted-foreground">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={item.card_image}
      alt={item.card_name}
      loading="lazy"
      className="h-16 w-12 object-cover rounded-md border border-border bg-muted"
    />
  );
}

const PICKERS = ["Luca", "Julia"] as const;
type Picker = (typeof PICKERS)[number];

/** Marcação "Separado por" para itens da pilha/OS (card_stack_items). */
export function StackItemPickedBy({
  item,
  onChanged,
}: {
  item: AdminStackItem & { picked_by?: string | null; picked_at?: string | null };
  onChanged: () => void | Promise<void>;
}) {
  const setPickedFn = useServerFn(adminSetStackItemPicked);
  const [saving, setSaving] = useState<Picker | "clear" | null>(null);
  const current: Picker | null = (item.picked_by as Picker) ?? null;

  const setPicked = async (value: Picker | null) => {
    setSaving(value ?? "clear");
    try {
      await setPickedFn({ data: { itemId: item.id, pickedBy: value } });
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao marcar separação.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Separado por:</span>
      {PICKERS.map((p) => {
        const active = current === p;
        const isSaving = saving === p;
        return (
          <button
            key={p}
            type="button"
            disabled={!!saving}
            onClick={() => setPicked(active ? null : p)}
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
              (active
                ? p === "Luca"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-pink-600 text-white border-pink-600"
                : "bg-background hover:bg-secondary border-border text-foreground")
            }
            title={active ? `Desmarcar ${p}` : `Marcar como separado por ${p}`}
          >
            <span
              className={
                "inline-block h-3 w-3 rounded-sm border " +
                (active ? "bg-white/90 border-white/90" : "border-muted-foreground")
              }
            >
              {active && <span className="block text-[10px] leading-3 text-black text-center">✓</span>}
            </span>
            {isSaving ? "..." : p}
          </button>
        );
      })}
      {current && item.picked_at && (
        <span className="text-[10px] text-muted-foreground">
          em {new Date(item.picked_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      )}
    </div>
  );
}

export function StackPickingSummary({
  items,
}: {
  items: Array<{ picked_by?: string | null }>;
}) {
  const total = items.length;
  const lucaPicked = items.filter((it) => it.picked_by === "Luca").length;
  const juliaPicked = items.filter((it) => it.picked_by === "Julia").length;
  const done = lucaPicked + juliaPicked;
  const allDone = done === total && total > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[11px] text-muted-foreground">
        Separado: <span className="font-semibold text-foreground">{done}/{total}</span>
      </span>
      {lucaPicked > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-semibold">
          Luca {lucaPicked}/{total}
        </span>
      )}
      {juliaPicked > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 text-pink-800 px-2 py-0.5 text-[11px] font-semibold">
          Julia {juliaPicked}/{total}
        </span>
      )}
      {allDone && <span className="text-[11px] font-bold text-green-700">Tudo separado ✓</span>}
    </div>
  );
}

/** Opções de filtro (Acabamento, Coleção, Condição) a partir dos itens. */
export function facetOptions(items: AdminStackItem[]) {
  const finish: string[] = [];
  const collection: string[] = [];
  const condition: string[] = [];
  for (const it of items) {
    if (it.finish && !finish.includes(it.finish)) finish.push(it.finish);
    if (it.collection && !collection.includes(it.collection)) collection.push(it.collection);
    if (it.condition && !condition.includes(it.condition)) condition.push(it.condition);
  }
  finish.sort((a, b) => a.localeCompare(b));
  collection.sort((a, b) => a.localeCompare(b));
  condition.sort((a, b) => a.localeCompare(b));
  return { finish, collection, condition };
}
