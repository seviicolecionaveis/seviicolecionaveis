import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  approveOrderCancellation,
  rejectOrderCancellation,
  adminCancelOrder,
  adminUpdateOrderStatus,
  adminPartialCancelItem,
} from "@/utils/orders.functions";
import { toast } from "sonner";
import { ArrowLeft, ImageOff, X } from "lucide-react";
import { AdminTrackingEditor, type TrackingInfo } from "@/components/admin/AdminTrackingEditor";

export const Route = createFileRoute("/admin/orders/$orderId")({
  head: () => ({ meta: [{ title: "Pedido — Sevii Admin" }] }),
  component: AdminOrderDetailPage,
});

const STATUSES = [
  "pending",
  "paid",
  "preparing",
  "shipped",
  "awaiting_pickup",
  "delivered",
  "cancelled",
] as const;

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

const SHIPPING_METHOD_LABEL: Record<string, string> = {
  fixed: "Frete fixo",
  superfrete: "SuperFrete",
  arte_em_cards: "Retirada na Arte em Cards",
  card_stack: "Pilha de Cartas",
  presencial: "Retirada presencial",
  combinar: "Envio a combinar",
  delivery_app: "Aplicativo de entrega",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  mercadopago_card: "Cartão de crédito (Mercado Pago)",
  mercadopago_pix: "Pix (Mercado Pago)",
  stripe: "Cartão de crédito",
};

const fmtBRL = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function AdminOrderDetailPage() {
  const { orderId } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelItem, setCancelItem] = useState<any | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) nav({ to: "/" });
  }, [authLoading, isAdmin, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    setOrder(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel(`admin-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, orderId]);

  const updateStatus = async (status: string) => {
    try {
      await adminUpdateOrderStatus({ data: { order_id: orderId, status: status as any } });
      toast.success("Status atualizado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar status.");
    }
  };

  const saveTracking = async (info: TrackingInfo) => {
    try {
      await adminUpdateOrderStatus({ data: { order_id: orderId, status: "shipped", ...info } });
      toast.success("Rastreio salvo.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar rastreio.");
    }
  };

  const handleApproveCancel = async () => {
    if (!confirm("Aprovar o cancelamento deste pedido? O estoque será devolvido se o pedido já estava pago.")) return;
    try {
      await approveOrderCancellation({ data: { order_id: orderId } });
      toast.success("Cancelamento aprovado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aprovar cancelamento.");
    }
  };

  const handleRejectCancel = async () => {
    if (!confirm("Recusar o cancelamento? O pedido voltará ao status anterior.")) return;
    try {
      await rejectOrderCancellation({ data: { order_id: orderId } });
      toast.success("Cancelamento recusado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao recusar cancelamento.");
    }
  };

  const handleAdminCancel = async () => {
    if (!confirm("Cancelar este pedido? Esta ação não pode ser desfeita.")) return;
    try {
      await adminCancelOrder({ data: { order_id: orderId } });
      toast.success("Pedido cancelado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar pedido.");
    }
  };

  if (authLoading || !isAdmin || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>
          <Link to="/admin" className="mt-3 inline-block text-sm font-semibold underline">← Voltar para pedidos</Link>
        </div>
      </div>
    );
  }

  const items: any[] = order.order_items ?? [];
  const subtotalCents = order.subtotal_cents ?? 0;
  const shippingCents = order.shipping_cost_cents ?? 0;
  const discountCents = order.discount_cents ?? 0;
  const totalCents = order.total_cents ?? 0;
  const isPix = order.payment_method === "pix" || order.payment_method === "mercadopago_pix";
  const paymentLabel = PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method ?? "—";
  const shippingLabel = SHIPPING_METHOD_LABEL[order.shipping_method] ?? order.shipping_method ?? "—";

  const discountReasons: string[] = [];
  if (order.coupon_code) discountReasons.push(`cupom ${order.coupon_code}`);
  if (isPix && discountCents > 0) discountReasons.push("desconto Pix (5%)");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para pedidos
          </Link>
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii · Admin</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
              <h1 className="text-2xl font-bold">{order.recipient_name}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                value={order.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                {order.status === "cancellation_requested" && (
                  <option value="cancellation_requested" disabled>{STATUS_LABEL.cancellation_requested}</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Solicitação de cancelamento */}
        {order.status === "cancellation_requested" && (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-orange-900">
              <strong>Cliente solicitou cancelamento.</strong> Status anterior:{" "}
              {STATUS_LABEL[order.pre_cancel_status] ?? order.pre_cancel_status ?? "—"}
            </p>
            <div className="flex gap-2">
              <button onClick={handleRejectCancel} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                Recusar
              </button>
              <button onClick={handleApproveCancel} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700">
                Aprovar cancelamento
              </button>
            </div>
          </div>
        )}

        {/* Rastreio */}
        {(order.status === "shipped" || order.status === "delivered" || order.status === "preparing") && (
          <AdminTrackingEditor order={order} onSave={saveTracking} />
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {/* Cliente */}
          <Card title="Cliente">
            <Field label="Nome" value={order.recipient_name} />
            <Field label="E-mail" value={order.email} />
            <Field label="Telefone" value={order.phone || "—"} />
            <Field label="CPF" value={order.cpf || "—"} />
          </Card>

          {/* Endereço */}
          <Card title="Endereço de entrega">
            <p className="text-sm">{order.street}, {order.number}{order.complement ? ` — ${order.complement}` : ""}</p>
            <p className="text-sm">{order.neighborhood}</p>
            <p className="text-sm">{order.city} / {order.state}</p>
            <p className="text-xs text-muted-foreground mt-1">CEP: {order.cep}</p>
          </Card>

          {/* Pagamento e envio */}
          <Card title="Pagamento & envio">
            <Field label="Pagamento" value={paymentLabel} />
            <Field label="Método de envio" value={shippingLabel} />
            {order.tracking_code && <Field label="Rastreio" value={order.tracking_code} mono />}
            {order.arte_em_cards_code && <Field label="Código Arte em Cards" value={order.arte_em_cards_code} mono />}
            {order.mercadopago_payment_id && (
              <Field label="ID Mercado Pago" value={order.mercadopago_payment_id} mono />
            )}
          </Card>
        </div>

        {/* Itens */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <h2 className="px-5 py-3 text-xs font-bold uppercase tracking-widest border-b border-border">
            Itens vendidos ({items.length})
          </h2>
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const cancelledQty = it.cancelled_quantity ?? 0;
              const activeQty = (it.quantity ?? 0) - cancelledQty;
              const lineTotal = (it.unit_price_cents ?? 0) * (it.quantity ?? 0);
              const refundCents = it.refund_cents ?? 0;
              const canCancel =
                activeQty > 0 &&
                ["paid", "preparing", "shipped", "awaiting_pickup", "delivered"].includes(order.status);
              return (
                <li key={it.id} className="flex items-start gap-4 p-4">
                  <div className="h-24 w-[68px] shrink-0 rounded-md overflow-hidden bg-secondary border border-border grid place-items-center">
                    {it.card_image ? (
                      <img src={it.card_image} alt={it.card_name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {it.card_name}
                      {it.card_number && <span className="text-muted-foreground font-normal"> · {it.card_number}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[it.collection, it.finish, it.language, it.condition].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs mt-2">
                      <span className="text-muted-foreground">Qtd:</span>{" "}
                      <span className="font-semibold">{it.quantity}</span>{" "}
                      <span className="text-muted-foreground">×</span>{" "}
                      <span className="font-semibold tabular-nums">{fmtBRL(it.unit_price_cents)}</span>
                    </p>
                    {cancelledQty > 0 && (
                      <p className="text-xs mt-1 text-orange-700 font-semibold">
                        {cancelledQty}× cancelado{refundCents > 0 ? ` · reembolso ${fmtBRL(refundCents)}` : ""}
                        {it.refund_method ? ` (${it.refund_method === "mercadopago" ? "estorno MP" : it.refund_method === "coupon" ? "cupom" : "manual"})` : ""}
                        {it.refund_coupon_code ? ` · ${it.refund_coupon_code}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subtotal</p>
                      <p className="text-base font-bold tabular-nums">{fmtBRL(lineTotal)}</p>
                    </div>
                    {canCancel && (
                      <button
                        onClick={() => setCancelItem(it)}
                        className="text-[11px] text-destructive hover:underline font-semibold inline-flex items-center gap-1"
                        title="Cancelar este item (sem estoque, etc.)"
                      >
                        <X className="h-3 w-3" /> Cancelar item
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>


        {/* Totais */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3">Resumo financeiro</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal dos itens" value={fmtBRL(subtotalCents)} />
            <Row
              label={`Frete${order.shipping_method ? ` (${shippingLabel})` : ""}`}
              value={shippingCents > 0 ? fmtBRL(shippingCents) : (order.shipping_method === "combinar" || order.shipping_method === "delivery_app" ? "a combinar" : "grátis")}
            />
            {discountCents > 0 && (
              <Row
                label={`Desconto${discountReasons.length ? ` (${discountReasons.join(" + ")})` : ""}`}
                value={`− ${fmtBRL(discountCents)}`}
                tone="discount"
              />
            )}
            <div className="border-t border-border pt-2 mt-2">
              <Row label="Total pago" value={fmtBRL(totalCents)} tone="total" />
            </div>
            {(order.refunded_cents ?? 0) > 0 && (
              <Row
                label="Reembolsado ao cliente"
                value={`− ${fmtBRL(order.refunded_cents)}`}
                tone="discount"
              />
            )}
          </dl>
        </div>


        {/* Observações */}
        {order.notes && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-2">Observações do cliente</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground italic">{order.notes}</p>
          </div>
        )}

        {/* Ação de cancelar */}
        {order.status !== "cancelled" && order.status !== "cancellation_requested" && (
          <div className="flex justify-end">
            <button
              onClick={handleAdminCancel}
              className="text-xs text-destructive hover:underline font-semibold"
            >
              Cancelar pedido
            </button>
          </div>
        )}
      </main>

      {cancelItem && (
        <PartialCancelDialog
          item={cancelItem}
          order={order}
          onClose={() => setCancelItem(null)}
          onDone={async () => {
            setCancelItem(null);
            await load();
          }}
        />
      )}
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "discount" | "total" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={tone === "total" ? "font-bold text-base" : "text-muted-foreground"}>{label}</dt>
      <dd
        className={
          tone === "total"
            ? "font-bold text-base tabular-nums"
            : tone === "discount"
              ? "text-green-700 font-semibold tabular-nums"
              : "tabular-nums font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}
