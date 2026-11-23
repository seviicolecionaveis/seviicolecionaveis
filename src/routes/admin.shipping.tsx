import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateOrderStatus } from "@/utils/orders.functions";
import { FulfillmentFilters, ModalityBadge, matchesFulfillmentFilter, DEFAULT_FULFILLMENT_FILTER } from "@/components/admin/FulfillmentFilters";
import { modalityOfOrder } from "@/lib/fulfillment-alerts";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { ORDER_STATUS_LABELS, PAID_ORDER_STATUSES } from "@/lib/order-status";
import { loadShippingPages } from "@/lib/shipping-pagination";

const OPEN_STATUSES = ["paid", "preparing", "separated", "awaiting_pickup", "cards_pending_delivery"];

export const Route = createFileRoute("/admin/shipping")({
  head: () => ({ meta: [
    { title: "Expedição — Sevii Admin" },
    { name: "description", content: "Expedição administrativa de pedidos, envios e retiradas da Sevii Colecionáveis." },
    { property: "og:title", content: "Expedição — Sevii Admin" },
    { property: "og:description", content: "Expedição administrativa de pedidos, envios e retiradas da Sevii Colecionáveis." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ShippingPage,
});

function ShippingPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState<Set<string>>(new Set());
  const updateStatus = useServerFn(adminUpdateOrderStatus);
  const [ff, setFf] = useState(DEFAULT_FULFILLMENT_FILTER);
  const { unreadTargets } = useAdminNotifications(300);
  const [statuses, setStatuses] = useState<string[]>(OPEN_STATUSES);
  const [search, setSearch] = useState("");

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
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "shipped", tracking_code: code } : o)));
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
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
      const list = await loadShippingPages(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .in("status", PAID_ORDER_STATUSES as string[])
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
          .abortSignal(controller.signal);
        if (error) throw error;
        return data ?? [];
      });
      if (controller.signal.aborted) return;
      setOrders(list);
      const codes = Array.from(
        new Set(list.map((o: any) => o.coupon_code).filter(Boolean) as string[]),
      );
      if (codes.length) {
        const { data: cs } = await supabase
          .from("coupons")
          .select("code, percent, amount_cents, user_id")
          .in("code", codes);
        const map: Record<string, any> = {};
        (cs ?? []).forEach((c: any) => { map[c.code.toUpperCase()] = c; });
        setCoupons(map);
      }
      } catch {
        if (!controller.signal.aborted) {
          setOrders([]);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isAdmin]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (!statuses.includes(o.status)) return false;
      if (!matchesFulfillmentFilter(ff, { id: o.id, modality: modalityOfOrder(o), eventId: o.event_id, scheduledAt: o.scheduled_at, feeStatus: o.hand_delivery_fee_status }, unreadTargets)) return false;
      if (q) {
        const hay = [o.id, o.recipient_name, o.email, o.city, o.neighborhood, o.tracking_code, ...(o.order_items ?? []).map((i: any) => i.card_name)]
          .filter(Boolean).join(" ").toLowerCase();
        const digits = [o.cep, o.phone].filter(Boolean).join(" ").replace(/\D/g, "");
        if (!hay.includes(q) && !(qd.length >= 3 && digits.includes(qd))) return false;
      }
      return true;
    });
  }, [orders, statuses, ff, unreadTargets, search]);

  const toggleAll = () => {
    setSelected((prev) =>
      filtered.length > 0 && filtered.every((o) => prev.has(o.id)) ? new Set() : new Set(filtered.map((o) => o.id)),
    );
  };

  const toPrint = useMemo(() => {
    const sel = filtered.filter((o) => selected.has(o.id));
    return sel.length === 0 ? filtered : sel;
  }, [filtered, selected]);

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
              {filtered.length} de {orders.length} pedido(s) pagos.
              {selected.size > 0 && ` ${selected.size} selecionado(s).`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              {filtered.length > 0 && filtered.every((o) => selected.has(o.id))
                ? "Limpar seleção"
                : "Selecionar todos"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={filtered.length === 0}
              className="rounded-md bg-foreground text-background px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
            >
              Imprimir {selected.size > 0 ? `(${selected.size})` : "todas"}
            </button>
          </div>
        </div>

        <div className="no-print mb-6 space-y-3">
          <FulfillmentFilters value={ff} onChange={setFf} count={filtered.length} />
          <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2 text-xs">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nº do pedido, cliente, e-mail, cidade, CEP, telefone ou carta"
              className="flex-1 min-w-[220px] rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              aria-label="Buscar pedidos"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-2">Status</span>
            {PAID_ORDER_STATUSES.map((st) => (
              <label key={st} className="flex items-center gap-1 cursor-pointer rounded border border-border px-2 py-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-foreground"
                  checked={statuses.includes(st)}
                  onChange={(e) => setStatuses((p) => (e.target.checked ? [...p, st] : p.filter((x) => x !== st)))}
                />
                {ORDER_STATUS_LABELS[st] ?? st}
              </label>
            ))}
            <button type="button" onClick={() => { setStatuses(OPEN_STATUSES); setSearch(""); setFf(DEFAULT_FULFILLMENT_FILTER); }} className="underline text-muted-foreground hover:text-foreground">
              Limpar filtros
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">Não foi possível carregar todos os pedidos. Atualize a página para tentar novamente.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado com esses filtros.</p>
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
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ModalityBadge modality={modalityOfOrder(o)} scheduledAt={o.scheduled_at} unread={unreadTargets.has(o.id)} />
                          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                        </div>
                        {o.shipping_method === "arte_em_cards" && (
                          <span className="inline-block mt-1 rounded-md bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Retirada na Arte em Cards
                            {o.arte_em_cards_code ? ` · ${o.arte_em_cards_code}` : ""}
                          </span>
                        )}
                        {o.shipping_method === "pickup" && (
                          <span className="inline-block mt-1 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Retirada em mãos
                          </span>
                        )}
                        {o.shipping_method === "app_delivery" && (
                          <span className="inline-block mt-1 rounded-md bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Entrega por aplicativo
                          </span>
                        )}
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

                    <div className="mt-3 rounded-md border border-border bg-secondary/30 p-3 text-xs grid sm:grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="tabular-nums">R$ {((o.subtotal_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete</span>
                        <span className="tabular-nums">R$ {((o.shipping_cost_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      {o.discount_cents > 0 && (() => {
                        const c = o.coupon_code ? coupons[o.coupon_code.toUpperCase()] : null;
                        const isGift = c && c.amount_cents != null && c.user_id;
                        const isPercent = c && c.percent != null;
                        const label = isGift
                          ? "Vale-presente"
                          : isPercent
                            ? `Cupom (${c.percent}%)`
                            : "Cupom de desconto";
                        return (
                          <div className="flex justify-between text-green-700 sm:col-span-2">
                            <span>
                              {label}
                              {o.coupon_code ? <span className="font-mono ml-1 opacity-80">({o.coupon_code})</span> : null}
                            </span>
                            <span className="tabular-nums">- R$ {(o.discount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between sm:col-span-2 border-t border-border pt-1 mt-1 font-bold">
                        <span>Total pago</span>
                        <span className="tabular-nums">R$ {((o.total_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between sm:col-span-2">
                        <span className="text-muted-foreground">Pagamento</span>
                        <span className="font-medium">
                          {o.payment_method === "pix"
                            ? "Pix"
                            : o.payment_method === "stripe"
                              ? "Cartão (Stripe)"
                              : o.payment_method === "mercadopago_card"
                                ? "Cartão (Mercado Pago)"
                                : o.payment_method ?? "—"}
                        </span>
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
