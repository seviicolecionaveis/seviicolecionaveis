import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search } from "lucide-react";
import { searchOrdersForMergeFn, mergeCustomerAccountsFn } from "@/lib/admin-customers.functions";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

type Row = Awaited<ReturnType<typeof searchOrdersForMergeFn>>[number];

export function AddOrderToCustomer({ userId, customerName, onDone }: { userId: string; customerName: string; onDone: () => void }) {
  const search = useServerFn(searchOrdersForMergeFn);
  const merge = useServerFn(mergeCustomerAccountsFn);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (q.trim().length < 3) { setMsg({ kind: "err", text: "Digite pelo menos 3 caracteres." }); return; }
    setBusy("search");
    try { setRows(await search({ data: { userId, q } })); }
    catch (e: any) { setMsg({ kind: "err", text: e?.message ?? "Erro na busca." }); }
    finally { setBusy(null); }
  };

  const add = async (r: Row) => {
    const ok = window.confirm(
      `Mesclar a conta "${r.owner_name ?? r.owner_email ?? "sem nome"}" em "${customerName}"?\n\n` +
      `TODOS os pedidos, pilha, pontos e endereços dessa conta passam para este cliente. ` +
      `A outra conta fica marcada como vinculada e perde telefone/WhatsApp/CPF. Não dá para desfazer automaticamente.`,
    );
    if (!ok) return;
    setBusy(r.order_id);
    setMsg(null);
    try {
      const res = await merge({ data: { userId, sourceUserId: r.user_id } });
      setMsg({ kind: "ok", text: `Contas mescladas: ${res.orders_moved} pedido(s) adicionados.` });
      setRows(null); setQ("");
      onDone();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Erro ao mesclar." });
    } finally { setBusy(null); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
        <Plus className="h-3.5 w-3.5" /> Adicionar pedido
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nº do pedido (ex.: 2E938BFD) ou nome do cliente"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy === "search"} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
        </button>
        <button type="button" onClick={() => { setOpen(false); setRows(null); setMsg(null); }} className="rounded-md border border-border px-3 py-2 text-sm">Fechar</button>
      </form>
      <p className="text-xs text-muted-foreground">Inclui pedidos de leilão. Ao adicionar, a conta dona do pedido é mesclada neste cliente.</p>
      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}
      {rows && (rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido encontrado em outras contas.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.order_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs">#{r.order_id.slice(0, 8).toUpperCase()}{r.origin === "auction" ? " · Leilão" : ""}</p>
                <p className="truncate text-xs text-muted-foreground">{r.owner_name ?? "Sem nome"} · {r.owner_email ?? ""}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")} · R$ {(r.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · {ORDER_STATUS_LABELS[r.status] ?? r.status}
                </p>
              </div>
              <button type="button" disabled={!!busy} onClick={() => add(r)} className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {busy === r.order_id ? "Mesclando..." : "Adicionar e mesclar"}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
