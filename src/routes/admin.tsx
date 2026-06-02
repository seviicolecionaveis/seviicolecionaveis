import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  approveOrderCancellation,
  rejectOrderCancellation,
  adminCancelOrder,
  adminUpdateOrderStatus,
} from "@/utils/orders.functions";
import { toast } from "sonner";
import { AdminCancellationBell } from "@/components/AdminCancellationBell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Sevii Colecionáveis" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
  component: AdminPage,
});

const STATUSES = ["pending", "paid", "preparing", "shipped", "awaiting_pickup", "delivered", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pedido recebido",
  paid: "Pago",
  preparing: "Em preparação",
  shipped: "Enviado",
  awaiting_pickup: "Aguardando retirada na Arte em Cards",
  delivered: "Entregue",
  cancelled: "Cancelado",
  cancellation_requested: "Cancelamento solicitado",
};

function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const search = Route.useSearch();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ALL_STATUSES = [...STATUSES, "cancellation_requested"] as const;
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (typeof window === "undefined") return [...ALL_STATUSES];
    const raw = localStorage.getItem("admin-orders-filter-v2");
    if (!raw) return [...ALL_STATUSES];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [...ALL_STATUSES];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin-orders-filter-v2", JSON.stringify(selectedStatuses));
    }
  }, [selectedStatuses]);

  const toggleStatus = (s: string) => {
    setSelectedStatuses((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
  };
  const isOrdersRoute = location.pathname === "/admin";
  const focusId = search.focus;
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin && isOrdersRoute) load();
  }, [isAdmin, isOrdersRoute]);

  useEffect(() => {
    if (!isAdmin || !isOrdersRoute) return;
    const channel = supabase
      .channel("admin-orders-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, isOrdersRoute]);

  useEffect(() => {
    if (!focusId || orders.length === 0) return;
    const target = orders.find((o) => o.id === focusId);
    if (!target) return;
    setSelectedStatuses((curr: string[]) => (curr.includes(target.status) ? curr : [...curr, target.status]));
  }, [focusId, orders]);

  useEffect(() => {
    if (!focusId || loading) return;
    const t = setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(t);
  }, [focusId, loading, orders]);

  const CORREIOS_URL = "https://rastreamento.correios.com.br/app/index.php";

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminUpdateOrderStatus({
        data: { order_id: id, status: status as any },
      });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar status.");
    }
  };

  const saveTracking = async (
    id: string,
    info: { carrier: "correios" | "latam" | "pickup" | null; tracking_code: string | null; tracking_url: string | null },
  ) => {
    try {
      await adminUpdateOrderStatus({
        data: { order_id: id, status: "shipped", ...info },
      });
      toast.success("Rastreio salvo.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar rastreio.");
    }
  };

  const handleApproveCancel = async (id: string) => {
    if (!confirm("Aprovar o cancelamento deste pedido? O estoque será devolvido se o pedido já estava pago.")) return;
    try {
      await approveOrderCancellation({ data: { order_id: id } });
      toast.success("Cancelamento aprovado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aprovar cancelamento.");
    }
  };

  const handleRejectCancel = async (id: string) => {
    if (!confirm("Recusar o cancelamento? O pedido voltará ao status anterior.")) return;
    try {
      await rejectOrderCancellation({ data: { order_id: id } });
      toast.success("Cancelamento recusado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao recusar cancelamento.");
    }
  };

  const handleAdminCancel = async (id: string) => {
    if (!confirm("Cancelar este pedido? Esta ação não pode ser desfeita.")) return;
    try {
      await adminCancelOrder({ data: { order_id: id } });
      toast.success("Pedido cancelado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar pedido.");
    }
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!isOrdersRoute) {
    return <Outlet />;
  }

  const filtered = orders.filter((o) => selectedStatuses.includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis · Admin</Link>
          <div className="flex items-center gap-3">
            <AdminCancellationBell />
          <div className="flex gap-3 text-xs flex-wrap">
            <Link to="/admin/dashboard" className="font-semibold text-foreground hover:underline">Dashboard</Link>
           <Link to="/admin/manage-cards" className="font-semibold text-foreground hover:underline">Gerenciar cartas</Link>
           <Link to="/admin/panels" className="font-semibold text-foreground hover:underline">Painéis</Link>
           <Link to="/admin/sealed" className="font-semibold text-foreground hover:underline">Selados</Link>
           <Link to="/admin/accessories" className="font-semibold text-foreground hover:underline">Acessórios</Link>
            <Link to="/admin/banners" className="font-semibold text-foreground hover:underline">Banners</Link>
            
            <Link to="/admin/shipping" className="font-semibold text-foreground hover:underline">Expedição</Link>
            <Link to="/admin/integrations" className="font-semibold text-foreground hover:underline">Integrações</Link>
            <Link to="/admin/users" className="font-semibold text-foreground hover:underline">Administradores</Link>
            <Link to="/admin/emails" className="font-semibold text-foreground hover:underline">E-mails</Link>
            <Link to="/admin/coupons" className="font-semibold text-foreground hover:underline">Cupons</Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">← Catálogo</Link>
          </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">Pedidos ({filtered.length})</h1>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar por status</p>
              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={() => setSelectedStatuses([...ALL_STATUSES])}
                  className="text-foreground hover:underline font-semibold"
                >
                  Todos
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setSelectedStatuses([])}
                  className="text-foreground hover:underline font-semibold"
                >
                  Nenhum
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {ALL_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s)}
                    onChange={() => toggleStatus(s)}
                    className="h-4 w-4 rounded border-border accent-foreground"
                  />
                  {STATUS_LABEL[s]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((o) => (
              <div
                key={o.id}
                ref={o.id === focusId ? focusRef : undefined}
                className={`rounded-xl border p-5 bg-card transition ${o.id === focusId ? "border-orange-500 ring-2 ring-orange-300" : "border-border"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">#{o.id.slice(0, 8)}</p>
                    <p className="text-sm font-semibold">{o.recipient_name}</p>
                    <p className="text-xs text-muted-foreground">{o.email} · {o.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>

                {(o.status === "shipped" || o.status === "delivered") && (
                  <TrackingEditor
                    order={o}
                    correiosUrl={CORREIOS_URL}
                    onSave={(info) => saveTracking(o.id, info)}
                  />
                )}

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">Endereço</p>
                    <p>{o.street}, {o.number}{o.complement ? ` — ${o.complement}` : ""}</p>
                    <p>{o.neighborhood} · {o.city}/{o.state}</p>
                    <p>CEP: {o.cep}</p>
                    {o.cpf && <p className="text-xs text-muted-foreground">CPF: {o.cpf}</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">Itens</p>
                    <ul className="space-y-0.5">
                      {o.order_items?.map((it: any) => {
                        const lineTotal = (it.unit_price_cents ?? 0) * (it.quantity ?? 0);
                        return (
                          <li key={it.id} className="text-xs flex justify-between gap-2">
                            <span>
                              {it.quantity}× {it.card_name}{it.card_number ? ` ${it.card_number}` : ""} <span className="text-muted-foreground">({it.finish}, {it.language})</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground shrink-0">
                              R$ {(it.unit_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              {it.quantity > 1 && (
                                <> · <span className="font-semibold text-foreground">R$ {(lineTotal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {o.notes && (
                  <p className="mt-3 text-xs italic text-muted-foreground">Obs: {o.notes}</p>
                )}

                <div className="mt-3 pt-3 border-t border-border flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {o.shipping_method === "fixed" ? `Frete: R$ ${(o.shipping_cost_cents / 100).toFixed(2).replace(".", ",")}` : "Envio a combinar"}
                  </span>
                  <span className="font-bold tabular-nums">
                    Total: R$ {(o.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {o.status === "cancellation_requested" && (
                  <div className="mt-3 pt-3 border-t border-orange-300 bg-orange-50 -mx-5 -mb-5 px-5 py-3 rounded-b-xl flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-orange-900">
                      <strong>Cliente solicitou cancelamento.</strong> Status anterior: {STATUS_LABEL[o.pre_cancel_status] ?? o.pre_cancel_status ?? "—"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectCancel(o.id)}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleApproveCancel(o.id)}
                        className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700"
                      >
                        Aprovar cancelamento
                      </button>
                    </div>
                  </div>
                )}

                {o.status !== "cancelled" && o.status !== "cancellation_requested" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleAdminCancel(o.id)}
                      className="text-xs text-destructive hover:underline font-semibold"
                    >
                      Cancelar pedido
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

type CarrierKind = "correios" | "latam" | "pickup";
type TrackingInfo = {
  carrier: CarrierKind | null;
  tracking_code: string | null;
  tracking_url: string | null;
};

function normalizeCarrier(c: any): CarrierKind {
  if (c === "latam") return "latam";
  if (c === "pickup") return "pickup";
  return "correios";
}

function TrackingEditor({
  order,
  correiosUrl,
  onSave,
}: {
  order: any;
  correiosUrl: string;
  onSave: (info: TrackingInfo) => Promise<void> | void;
}) {
  const initialCarrier: CarrierKind = normalizeCarrier(order.carrier);
  const [carrier, setCarrier] = useState<CarrierKind>(initialCarrier);
  const [code, setCode] = useState<string>(order.tracking_code ?? "");
  const [url, setUrl] = useState<string>(
    order.carrier === "latam" ? (order.tracking_url ?? "") : "",
  );
  const [saving, setSaving] = useState(false);

  // Resync when order changes (e.g. after reload)
  useEffect(() => {
    setCarrier(normalizeCarrier(order.carrier));
    setCode(order.tracking_code ?? "");
    setUrl(order.carrier === "latam" ? (order.tracking_url ?? "") : "");
  }, [order.id, order.carrier, order.tracking_code, order.tracking_url]);

  const trimmedCode = code.trim();
  const trimmedUrl = url.trim();
  const finalCode = carrier === "pickup" ? null : (trimmedCode || null);
  const finalUrl =
    carrier === "pickup"
      ? null
      : carrier === "correios"
        ? correiosUrl
        : (trimmedUrl || null);
  const currentCarrier = order.carrier ?? null;
  const currentCode = order.tracking_code ?? null;
  const currentUrl = order.tracking_url ?? null;
  const dirty =
    carrier !== (currentCarrier ?? "correios") ||
    finalCode !== currentCode ||
    finalUrl !== currentUrl;

  const handleSave = async () => {
    if (carrier === "latam" && trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      toast.error("Link inválido. A URL precisa começar com http:// ou https://");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        carrier,
        tracking_code: finalCode,
        tracking_url: finalUrl,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Rastreio do envio
        </span>
        {order.carrier !== "pickup" && order.tracking_code && order.tracking_url && (
          <a
            href={order.tracking_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] underline text-foreground"
          >
            abrir {order.carrier === "latam" ? "Latam" : "Correios"}
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`carrier-${order.id}`}
            checked={carrier === "correios"}
            onChange={() => setCarrier("correios")}
          />
          Correios
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`carrier-${order.id}`}
            checked={carrier === "latam"}
            onChange={() => setCarrier("latam")}
          />
          Latam
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`carrier-${order.id}`}
            checked={carrier === "pickup"}
            onChange={() => setCarrier("pickup")}
          />
          Retirado em mãos
        </label>
        {carrier !== "pickup" && (
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de rastreio"
            className="flex-1 min-w-[160px] rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
          />
        )}
      </div>
      {carrier === "latam" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link de rastreio da Latam (https://...)"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
      )}
      {carrier === "pickup" && (
        <p className="text-[11px] text-muted-foreground">
          Pedido entregue em mãos — nenhum código de rastreio será enviado ao cliente.
        </p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar rastreio"}
        </button>
      </div>
    </div>
  );
}
