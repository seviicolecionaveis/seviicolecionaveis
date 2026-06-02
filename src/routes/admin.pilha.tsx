import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateServiceOrder } from "@/lib/service-orders-admin.functions";

export const Route = createFileRoute("/admin/pilha")({
  head: () => ({ meta: [{ title: "Pilha de Cartas — Sevii Admin" }] }),
  component: AdminPilhaPage,
});

const METHOD_LABEL: Record<string, string> = {
  correios: "Envio Correios",
  app: "Envio por App",
  arte_em_cards: "Retirada Arte em Cards",
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago — preparar",
  dispatched: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_OPTIONS = ["paid", "dispatched", "delivered", "cancelled"] as const;

function fmtMoney(cents: number) {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

function AdminPilhaPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"orders" | "stacks">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [stacks, setStacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const update = useServerFn(adminUpdateServiceOrder);

  const load = async () => {
    setLoading(true);
    const [{ data: os }, { data: st }] = await Promise.all([
      supabase
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("card_stacks")
        .select("*")
        .eq("status", "active")
        .order("expires_at", { ascending: true }),
    ]);
    const ordersData = os ?? [];
    const stacksData = st ?? [];

    // hidrata itens das OS
    const osIds = ordersData.map((o: any) => o.id);
    const stackIds = stacksData.map((s: any) => s.id);
    const [{ data: osItems }, { data: stackItems }] = await Promise.all([
      osIds.length
        ? supabase.from("card_stack_items").select("*").in("service_order_id", osIds)
        : Promise.resolve({ data: [] as any[] }),
      stackIds.length
        ? supabase.from("card_stack_items").select("*").in("stack_id", stackIds).eq("status", "stored")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const byOs: Record<string, any[]> = {};
    (osItems ?? []).forEach((it: any) => {
      (byOs[it.service_order_id] ??= []).push(it);
    });
    const byStack: Record<string, any[]> = {};
    (stackItems ?? []).forEach((it: any) => {
      (byStack[it.stack_id] ??= []).push(it);
    });

    setOrders(ordersData.map((o: any) => ({ ...o, items: byOs[o.id] ?? [] })));
    setStacks(stacksData.map((s: any) => ({ ...s, items: byStack[s.id] ?? [] })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-service-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "paid").length,
    [orders],
  );

  async function patch(id: string, body: Parameters<typeof adminUpdateServiceOrder>[0]["data"]) {
    try {
      await update({ data: body });
      toast.success("Atualizado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar.");
    }
  }

  if (authLoading) return <div className="min-h-screen grid place-items-center text-sm">Carregando...</div>;
  if (!isAdmin) return <div className="min-h-screen grid place-items-center text-sm">Acesso negado.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            ← Admin · Pilha de Cartas
          </Link>
          <div className="text-xs text-muted-foreground">
            {pendingCount > 0 && (
              <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 font-semibold">
                {pendingCount} OS para preparar
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setTab("orders")}
            className={`px-3 py-1.5 rounded-full font-semibold ${tab === "orders" ? "bg-foreground text-background" : "bg-secondary"}`}
          >
            Ordens de Serviço ({orders.length})
          </button>
          <button
            onClick={() => setTab("stacks")}
            className={`px-3 py-1.5 rounded-full font-semibold ${tab === "stacks" ? "bg-foreground text-background" : "bg-secondary"}`}
          >
            Pilhas Ativas ({stacks.length})
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : tab === "orders" ? (
          orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">OS #{o.code}</p>
                      <p className="text-sm font-semibold">
                        {METHOD_LABEL[o.method] ?? o.method} · {STATUS_LABEL[o.status] ?? o.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")} · {fmtMoney(o.amount_cents)}
                      </p>
                      {o.arte_em_cards_code && (
                        <p className="text-xs text-green-700 font-semibold">Código Arte em Cards usado: {o.arte_em_cards_code}</p>
                      )}
                    </div>
                    <select
                      value={o.status}
                      onChange={(e) => patch(o.id, { serviceOrderId: o.id, status: e.target.value as any })}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>

                  {o.method === "correios" && (o.status === "paid" || o.status === "dispatched") && (
                    <TrackingForm
                      order={o}
                      onSave={(carrier, code, url) => patch(o.id, {
                        serviceOrderId: o.id,
                        status: "dispatched",
                        carrier,
                        trackingCode: code,
                        trackingUrl: url,
                      })}
                    />
                  )}

                  <div className="grid md:grid-cols-2 gap-4 text-sm mt-2">
                    {o.method !== "arte_em_cards" && o.recipient_name && (
                      <div>
                        <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                          {o.method === "app" ? "Contato" : "Endereço"}
                        </p>
                        <p>{o.recipient_name}</p>
                        {o.phone && <p className="text-xs">{o.phone}</p>}
                        {o.method === "correios" && (
                          <>
                            <p>{o.street}, {o.number}{o.complement ? ` — ${o.complement}` : ""}</p>
                            <p>{o.neighborhood} · {o.city}/{o.state}</p>
                            <p>CEP: {o.cep}</p>
                          </>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                        Itens ({o.items.length})
                      </p>
                      <ul className="space-y-0.5">
                        {o.items.map((it: any) => (
                          <li key={it.id} className="text-xs">
                            {it.quantity}× {it.card_name}
                            {it.card_number ? ` ${it.card_number}` : ""}{" "}
                            <span className="text-muted-foreground">({it.finish}, {it.language})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {o.notes && <p className="mt-3 text-xs italic text-muted-foreground">Obs: {o.notes}</p>}
                </div>
              ))}
            </div>
          )
        ) : (
          stacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pilha ativa.</p>
          ) : (
            <div className="space-y-3">
              {stacks.map((s) => {
                const now = new Date();
                const exp = new Date(s.expires_at);
                const days = daysBetween(now, exp);
                const crit = days <= 2;
                const warn = days <= 7;
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-4 bg-card ${crit ? "border-red-400" : warn ? "border-orange-400" : "border-border"}`}
                  >
                    <div className="flex justify-between gap-3 text-sm">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">Pilha {s.id.slice(0, 8)}</p>
                        <p className="font-semibold">Usuário: {s.user_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Iniciada {new Date(s.started_at).toLocaleDateString("pt-BR")} ·
                          Vence {exp.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className={`text-right text-sm font-bold ${crit ? "text-red-600" : warn ? "text-orange-600" : ""}`}>
                        {days > 0 ? `${days} dia${days === 1 ? "" : "s"} restantes` : "Vencida"}
                        <div className="text-xs font-normal text-muted-foreground">{s.items.length} carta(s)</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function TrackingForm({
  order,
  onSave,
}: {
  order: any;
  onSave: (carrier: "correios" | "latam" | "pickup", code: string | null, url: string | null) => void;
}) {
  const [carrier, setCarrier] = useState<"correios" | "latam">(order.carrier === "latam" ? "latam" : "correios");
  const [code, setCode] = useState<string>(order.tracking_code ?? "");
  const [url, setUrl] = useState<string>(order.tracking_url ?? "");

  return (
    <div className="mt-2 rounded-md border border-border p-3 bg-secondary/40 flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Transportadora</span>
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value as any)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="correios">Correios</option>
          <option value="latam">LATAM Cargo</option>
        </select>
      </label>
      <label className="text-xs flex-1 min-w-[160px]">
        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Código de rastreio</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          placeholder="BR123..."
        />
      </label>
      {carrier === "latam" && (
        <label className="text-xs flex-1 min-w-[200px]">
          <span className="block text-[10px] uppercase font-semibold text-muted-foreground">URL rastreio</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            placeholder="https://..."
          />
        </label>
      )}
      <button
        onClick={() =>
          onSave(
            carrier,
            code.trim() || null,
            carrier === "latam" ? (url.trim() || null) : "https://rastreamento.correios.com.br/app/index.php",
          )
        }
        className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold"
      >
        Salvar e despachar
      </button>
    </div>
  );
}
