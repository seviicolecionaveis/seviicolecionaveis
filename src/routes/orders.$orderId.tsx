import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle, Package, Truck, AlertTriangle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { requestOrderCancellation } from "@/utils/orders.functions";
import { toast } from "sonner";

const PURCHASE_TRACKED_KEY = "sevii_ga_purchase_tracked";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({ meta: [{ title: "Pedido — Sevii Colecionáveis" }] }),
  component: OrderDetailPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  cancellation_requested: "Cancelamento em análise",
};

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  paid: CheckCircle2,
  shipped: Truck,
  delivered: Package,
  cancelled: XCircle,
  cancellation_requested: AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-600",
  paid: "text-green-600",
  shipped: "text-purple-600",
  delivered: "text-blue-600",
  cancelled: "text-red-600",
  cancellation_requested: "text-orange-600",
};

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();
      if (!cancelled) {
        setOrder(data);
        setLoading(false);
      }
    };
    load();
    // Poll a few seconds in case webhook ainda não atualizou status
    const interval = setInterval(load, 4000);
    const stop = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [user, orderId]);

  // GA4 purchase — disparado apenas uma vez quando o pedido fica pago
  useEffect(() => {
    if (!order || order.status !== "paid") return;
    try {
      const tracked = JSON.parse(sessionStorage.getItem(PURCHASE_TRACKED_KEY) ?? "[]") as string[];
      if (tracked.includes(order.id)) return;
      trackEvent("purchase", {
        transaction_id: order.id,
        currency: "BRL",
        value: (order.total_cents ?? 0) / 100,
        shipping: (order.shipping_cost_cents ?? 0) / 100,
        coupon: order.coupon_code ?? undefined,
        items: (order.order_items ?? []).map((it: any) => ({
          item_id: it.card_id,
          item_name: it.card_name,
          item_category: it.collection ?? undefined,
          item_variant: `${it.finish ?? ""}/${it.language ?? ""}/${it.condition ?? ""}`,
          price: (it.unit_price_cents ?? 0) / 100,
          quantity: it.quantity,
        })),
      });
      tracked.push(order.id);
      sessionStorage.setItem(PURCHASE_TRACKED_KEY, JSON.stringify(tracked.slice(-20)));
    } catch {
      // ignore storage errors
    }
  }, [order]);

  if (authLoading || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando pedido...</div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Pedido não encontrado</h1>
          <Link to="/orders" className="text-sm underline">Ver meus pedidos</Link>
        </div>
      </div>
    );
  }

  const Icon = STATUS_ICON[order.status] ?? Clock;
  const isPaid = order.status === "paid" || order.status === "shipped" || order.status === "delivered";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
          <Link to="/orders" className="text-xs text-muted-foreground hover:text-foreground">Meus pedidos →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <Icon className={`h-14 w-14 mx-auto ${STATUS_COLOR[order.status] ?? "text-muted-foreground"}`} />
          <h1 className="text-2xl font-bold">
            {isPaid ? "Pagamento confirmado!" : STATUS_LABEL[order.status] ?? order.status}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Pedido #{order.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Itens do pedido
          </h2>
          <ul className="space-y-4">
            {order.order_items?.map((it: any) => (
              <li key={it.id} className="flex gap-4">
                <div className="h-24 w-20 shrink-0 rounded-md overflow-hidden bg-secondary border border-border">
                  {it.card_image ? (
                    <img
                      src={it.card_image}
                      alt={it.card_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">
                      sem imagem
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{it.card_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.finish} · {it.language}
                    {it.condition ? ` · ${it.condition}` : ""}
                  </p>
                  {it.collection && (
                    <p className="text-xs text-muted-foreground truncate">
                      {it.collection}
                      {it.card_number ? ` · ${it.card_number}` : ""}
                    </p>
                  )}
                  <p className="text-sm mt-1">
                    {it.quantity}× <span className="tabular-nums">R$ {(it.unit_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </p>
                </div>
                <div className="text-sm font-semibold tabular-nums shrink-0">
                  R$ {(it.unit_price_cents * it.quantity / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">R$ {(order.subtotal_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          {order.discount_cents > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
              <span className="tabular-nums">- R$ {(order.discount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {order.shipping_method === "fixed" ? "Frete (Mini Envios)" : "Envio a combinar"}
            </span>
            <span className="tabular-nums">R$ {(order.shipping_cost_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">R$ {(order.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 text-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Endereço de entrega
          </h2>
          <p className="font-medium">{order.recipient_name}</p>
          <p className="text-muted-foreground">
            {order.street}, {order.number}{order.complement ? ` - ${order.complement}` : ""}
          </p>
          <p className="text-muted-foreground">{order.neighborhood} · {order.city}/{order.state} · CEP {order.cep}</p>
          {order.phone && <p className="text-muted-foreground mt-1">Tel: {order.phone}</p>}
        </section>

        <div className="flex gap-3 justify-center pt-2">
          <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary">
            Voltar ao catálogo
          </Link>
          <Link to="/orders" className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-semibold hover:bg-foreground/90">
            Meus pedidos
          </Link>
        </div>
      </main>
    </div>
  );
}
