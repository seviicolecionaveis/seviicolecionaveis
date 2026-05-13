import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Meus pedidos — Sevii Colecionáveis" }] }),
  component: OrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (authLoading || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Catálogo</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Meus pedidos</h1>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Link
                key={o.id}
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                className="block rounded-xl border border-border p-5 bg-card hover:border-foreground/40 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${STATUS_COLOR[o.status] ?? "bg-secondary"}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {o.order_items?.slice(0, 6).map((it: any) => (
                    <div key={it.id} className="h-16 w-12 shrink-0 rounded overflow-hidden bg-secondary border border-border">
                      {it.card_image ? (
                        <img src={it.card_image} alt={it.card_name} className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                  ))}
                </div>
                <ul className="text-sm space-y-1 mb-3">
                  {o.order_items?.map((it: any) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="truncate">{it.quantity}× {it.card_name} <span className="text-muted-foreground text-xs">({it.finish}, {it.language}{it.condition ? `, ${it.condition}` : ""})</span></span>
                      <span className="tabular-nums shrink-0">R$ {(it.unit_price_cents * it.quantity / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm border-t border-border pt-3">
                  <span className="text-muted-foreground">
                    {o.shipping_method === "fixed" ? `Frete: R$ ${(o.shipping_cost_cents / 100).toFixed(2).replace(".", ",")}` : "Envio a combinar"}
                  </span>
                  <span className="font-bold tabular-nums">
                    Total: R$ {(o.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
