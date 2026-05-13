import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Sevii Colecionáveis" }] }),
  component: AdminPage,
});

const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const isOrdersRoute = location.pathname === "/admin";

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

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    await load();
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!isOrdersRoute) {
    return <Outlet />;
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis · Admin</Link>
          <div className="flex gap-3 text-xs flex-wrap">
            <Link to="/admin/dashboard" className="font-semibold text-foreground hover:underline">Dashboard</Link>
            <Link to="/admin/manage-cards" className="font-semibold text-foreground hover:underline">Gerenciar cartas</Link>
            <Link to="/admin/banners" className="font-semibold text-foreground hover:underline">Banners</Link>
            <Link to="/admin/cards" className="font-semibold text-foreground hover:underline">Preços (Liga Pokémon)</Link>
            <Link to="/admin/users" className="font-semibold text-foreground hover:underline">Administradores</Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">← Catálogo</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">Pedidos ({filtered.length})</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="all">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-5 bg-card">
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
                      {o.order_items?.map((it: any) => (
                        <li key={it.id} className="text-xs">
                          {it.quantity}× {it.card_name} <span className="text-muted-foreground">({it.finish}, {it.language})</span>
                        </li>
                      ))}
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
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
