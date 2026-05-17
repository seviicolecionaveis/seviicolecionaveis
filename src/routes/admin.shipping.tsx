import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateOrderStatus } from "@/utils/orders.functions";

export const Route = createFileRoute("/admin/shipping")({
  head: () => ({ meta: [{ title: "Expedição — Sevii Admin" }] }),
  component: ShippingPage,
});

function ShippingPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState<Set<string>>(new Set());
  const updateStatus = useServerFn(adminUpdateOrderStatus);

  async function markShipped(orderId: string) {
    const code = (tracking[orderId] ?? "").trim();
    if (!code) {
      toast.error("Informe o código de rastreio dos Correios.");
      return;
    }
    setShipping((s) => new Set(s).add(orderId));
    try {
      await updateStatus({ data: { order_id: orderId, status: "shipped", tracking_code: code } });
      toast.success("Pedido marcado como enviado. E-mail enviado ao cliente.");
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(orderId);
        return n;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar pedido.");
    } finally {
      setShipping((s) => {
        const n = new Set(s);
        n.delete(orderId);
        return n;
      });
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("status", "paid")
        .order("created_at", { ascending: true });
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, [isAdmin]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)),
    );
  };

  const toPrint = useMemo(
    () => (selected.size === 0 ? orders : orders.filter((o) => selected.has(o.id))),
    [orders, selected],
  );

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm">
        Acesso restrito. <Link to="/" className="ml-1 underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-label { page-break-after: always; }
          body { background: white; }
        }
      `}</style>

      <header className="no-print border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 flex-wrap">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            Sevii · Admin · Expedição
          </Link>
          <div className="flex gap-3 text-xs">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              ← Pedidos
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pedidos prontos para envio</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} pedido(s) pagos aguardando despacho.
              {selected.size > 0 && ` ${selected.size} selecionado(s).`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              {selected.size === orders.length && orders.length > 0
                ? "Limpar seleção"
                : "Selecionar todos"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={orders.length === 0}
              className="rounded-md bg-foreground text-background px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
            >
              Imprimir {selected.size > 0 ? `(${selected.size})` : "todas"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido pago aguardando envio.</p>
        ) : (
          <div className="space-y-4">
            {toPrint.map((o) => (
              <div
                key={o.id}
                className="print-label rounded-xl border-2 border-border p-5 bg-card"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    className="no-print mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Pedido
                        </p>
                        <p className="font-mono text-base font-bold">
                          #{o.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Total
                        </p>
                        <p className="font-bold tabular-nums">
                          R$ {(o.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div className="border border-border rounded-md p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Destinatário
                        </p>
                        <p className="font-semibold">{o.recipient_name}</p>
                        <p>
                          {o.street}, {o.number}
                          {o.complement ? ` — ${o.complement}` : ""}
                        </p>
                        <p>{o.neighborhood}</p>
                        <p>
                          {o.city} / {o.state}
                        </p>
                        <p className="font-mono font-semibold">CEP: {o.cep}</p>
                        {o.phone && (
                          <p className="text-xs text-muted-foreground mt-1">Tel: {o.phone}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Itens ({o.order_items?.reduce((s: number, it: any) => s + it.quantity, 0) ?? 0})
                        </p>
                        <ul className="space-y-1 text-xs">
                          {o.order_items?.map((it: any) => (
                            <li key={it.id} className="flex gap-2">
                              <span className="font-bold tabular-nums">{it.quantity}×</span>
                              <span className="flex-1">
                                {it.card_name}
                                {it.card_number ? ` ${it.card_number}` : ""}{" "}
                                <span className="text-muted-foreground">
                                  ({it.finish}, {it.language}, {it.condition})
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                        {o.notes && (
                          <p className="mt-2 text-xs italic text-muted-foreground">
                            Obs: {o.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {o.superfrete_status === "failed" && (
                      <div className="no-print mt-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-800 dark:text-amber-200">
                        ⚠️ Etiqueta Superfrete falhou: {o.superfrete_error ?? "erro desconhecido"}. Compre manualmente no painel Superfrete.
                      </div>
                    )}
                    {o.superfrete_label_url && (
                      <div className="no-print mt-3 flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-2 text-xs">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                          🏷️ Etiqueta Superfrete pronta
                          {o.superfrete_service_name ? ` (${o.superfrete_service_name})` : ""}
                        </span>
                        <a
                          href={o.superfrete_label_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto rounded-md bg-emerald-700 text-white px-3 py-1 font-bold uppercase tracking-wider hover:bg-emerald-800"
                        >
                          Abrir etiqueta
                        </a>
                      </div>
                    )}

                    <div className="no-print mt-4 border-t border-border pt-3 flex flex-wrap items-center gap-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Rastreio Correios
                      </label>
                      <input
                        type="text"
                        placeholder="Ex.: AA123456789BR"
                        value={tracking[o.id] ?? o.tracking_code ?? ""}
                        onChange={(e) =>
                          setTracking((t) => ({ ...t, [o.id]: e.target.value.toUpperCase() }))
                        }
                        disabled={shipping.has(o.id)}
                        className="flex-1 min-w-[180px] rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                      <button
                        onClick={() => markShipped(o.id)}
                        disabled={shipping.has(o.id) || !((tracking[o.id] ?? o.tracking_code ?? "").trim())}
                        className="rounded-md bg-foreground text-background px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
                      >
                        {shipping.has(o.id) ? "Enviando..." : "Marcar como enviado + e-mail"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
