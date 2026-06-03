import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateServiceOrder } from "@/lib/service-orders-admin.functions";
import {
  adminGetPilhaData,
  type AdminServiceOrder,
  type AdminStack,
  type AdminStackItem,
} from "@/lib/admin-pilha.functions";

export const Route = createFileRoute("/admin/pilha")({
  head: () => ({ meta: [{ title: "Pilha de Cartas — Sevii Admin" }] }),
  component: AdminPilhaPage,
});

const METHOD_LABEL: Record<string, string> = {
  correios: "Envio Correios",
  app: "Envio por App",
  arte_em_cards: "Retirada Arte em Cards",
  presencial: "Retirada Presencial",
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago — preparar",
  dispatched: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-orange-100 text-orange-800",
  dispatched: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

const STATUS_OPTIONS = ["paid", "dispatched", "delivered", "cancelled"] as const;

const fmtMoney = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const daysBetween = (a: Date, b: Date) =>
  Math.ceil((b.getTime() - a.getTime()) / 86_400_000);

function Thumb({ item }: { item: AdminStackItem }) {
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

function ItemRow({ item }: { item: AdminStackItem }) {
  const meta = [item.collection, item.card_number, item.finish, item.language, item.condition]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex gap-3 py-2">
      <Thumb item={item} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {item.quantity}× {item.card_name}
        </p>
        {meta && <p className="text-xs text-muted-foreground truncate">{meta}</p>}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pedido <span className="font-mono">#{item.order_id.slice(0, 8)}</span>
          {item.unit_price_cents > 0 && (
            <> · {fmtMoney(item.unit_price_cents)} un.</>
          )}
        </p>
      </div>
    </li>
  );
}

function AdminPilhaPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"orders" | "stacks">("orders");
  const [data, setData] = useState<{ serviceOrders: AdminServiceOrder[]; stacks: AdminStack[] }>({
    serviceOrders: [],
    stacks: [],
  });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const update = useServerFn(adminUpdateServiceOrder);
  const fetchData = useServerFn(adminGetPilhaData);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchData();
      setData(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-service-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "card_stacks" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin]);

  const pendingCount = useMemo(
    () => data.serviceOrders.filter((o) => o.status === "paid").length,
    [data.serviceOrders],
  );

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function patch(id: string, body: {
    serviceOrderId: string;
    status?: "paid" | "dispatched" | "delivered" | "cancelled";
    carrier?: "correios" | "latam" | "pickup" | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
  }) {
    try {
      await update({ data: body });
      toast.success("Atualizado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar.");
    }
  }

  if (authLoading)
    return <div className="min-h-screen grid place-items-center text-sm">Carregando...</div>;
  if (!isAdmin)
    return <div className="min-h-screen grid place-items-center text-sm">Acesso negado.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            ← Admin · Pilha de Cartas
          </Link>
          {pendingCount > 0 && (
            <span className="rounded-full bg-orange-500 text-white px-3 py-1 text-xs font-semibold">
              {pendingCount} OS para preparar
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setTab("orders")}
            className={`px-3 py-1.5 rounded-full font-semibold ${
              tab === "orders" ? "bg-foreground text-background" : "bg-secondary"
            }`}
          >
            Ordens de Serviço ({data.serviceOrders.length})
          </button>
          <button
            onClick={() => setTab("stacks")}
            className={`px-3 py-1.5 rounded-full font-semibold ${
              tab === "stacks" ? "bg-foreground text-background" : "bg-secondary"
            }`}
          >
            Pilhas Ativas ({data.stacks.length})
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : tab === "orders" ? (
          data.serviceOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>
          ) : (
            <div className="space-y-4">
              {data.serviceOrders.map((o) => {
                const open = expanded.has(o.id);
                const totalCards = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={o.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground font-mono">OS #{o.code}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[o.status] ?? "bg-secondary"}`}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold mt-1">
                            {o.customer_name ?? o.recipient_name ?? "Cliente"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {o.customer_email ?? ""} · {METHOD_LABEL[o.method] ?? o.method}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleString("pt-BR")} · {fmtMoney(o.amount_cents)} · {totalCards} carta(s)
                          </p>
                          {o.arte_em_cards_code && (
                            <p className="text-xs text-green-700 font-semibold mt-1">
                              Código Arte em Cards: {o.arte_em_cards_code}
                            </p>
                          )}
                        </div>
                        <select
                          value={o.status}
                          onChange={(e) =>
                            patch(o.id, { serviceOrderId: o.id, status: e.target.value as any })
                          }
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Thumbnails preview row */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {o.items.slice(0, 8).map((it) => (
                          <div key={it.id} className="relative">
                            <Thumb item={it} />
                            {it.quantity > 1 && (
                              <span className="absolute -top-1 -right-1 bg-foreground text-background text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 grid place-items-center">
                                ×{it.quantity}
                              </span>
                            )}
                          </div>
                        ))}
                        {o.items.length > 8 && (
                          <div className="h-16 w-12 rounded-md bg-secondary grid place-items-center text-xs font-bold">
                            +{o.items.length - 8}
                          </div>
                        )}
                      </div>

                      {o.method === "correios" &&
                        (o.status === "paid" || o.status === "dispatched") && (
                          <TrackingForm
                            order={o}
                            onSave={(carrier, code, url) =>
                              patch(o.id, {
                                serviceOrderId: o.id,
                                status: "dispatched",
                                carrier,
                                trackingCode: code,
                                trackingUrl: url,
                              })
                            }
                          />
                        )}

                      <button
                        onClick={() => toggle(o.id)}
                        className="mt-2 text-xs font-semibold text-foreground/80 hover:underline"
                      >
                        {open ? "Ocultar detalhes" : `Ver todas as ${o.items.length} carta(s) e endereço`}
                      </button>
                    </div>

                    {open && (
                      <div className="border-t border-border bg-secondary/30 px-5 py-4 grid md:grid-cols-2 gap-6">
                        {o.method !== "arte_em_cards" && o.recipient_name && (
                          <div>
                            <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                              {o.method === "app" ? "Contato" : "Endereço"}
                            </p>
                            <p className="text-sm">{o.recipient_name}</p>
                            {o.phone && <p className="text-xs">{o.phone}</p>}
                            {o.method === "correios" && (
                              <>
                                <p className="text-xs">
                                  {o.street}, {o.number}
                                  {o.complement ? ` — ${o.complement}` : ""}
                                </p>
                                <p className="text-xs">
                                  {o.neighborhood} · {o.city}/{o.state}
                                </p>
                                <p className="text-xs">CEP: {o.cep}</p>
                              </>
                            )}
                          </div>
                        )}
                        <div>
                          <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                            Itens ({o.items.length})
                          </p>
                          <ul className="divide-y divide-border">
                            {o.items.map((it) => (
                              <ItemRow key={it.id} item={it} />
                            ))}
                          </ul>
                        </div>
                        {o.notes && (
                          <p className="md:col-span-2 text-xs italic text-muted-foreground">
                            Obs: {o.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : data.stacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pilha ativa.</p>
        ) : (
          <div className="space-y-4">
            {data.stacks.map((s) => {
              const now = new Date();
              const exp = new Date(s.expires_at);
              const days = daysBetween(now, exp);
              const crit = days <= 2;
              const warn = days <= 7;
              const totalCards = s.items.reduce((a, i) => a + i.quantity, 0);
              const open = expanded.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border bg-card overflow-hidden ${
                    crit ? "border-red-400" : warn ? "border-orange-400" : "border-border"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Pilha {s.id.slice(0, 8)}
                        </p>
                        <p className="text-base font-semibold">
                          {s.customer_name ?? "Cliente sem nome"}
                        </p>
                        {s.customer_email && (
                          <p className="text-xs text-muted-foreground">{s.customer_email}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Iniciada {new Date(s.started_at).toLocaleDateString("pt-BR")} · Vence{" "}
                          {exp.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div
                        className={`text-right text-sm font-bold ${
                          crit ? "text-red-600" : warn ? "text-orange-600" : ""
                        }`}
                      >
                        {days > 0 ? `${days} dia${days === 1 ? "" : "s"} restantes` : "Vencida"}
                        <div className="text-xs font-normal text-muted-foreground">
                          {totalCards} carta(s) · {s.items.length} linha(s)
                        </div>
                      </div>
                    </div>

                    {/* Thumbnails preview */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {s.items.slice(0, 10).map((it) => (
                        <div key={it.id} className="relative">
                          <Thumb item={it} />
                          {it.quantity > 1 && (
                            <span className="absolute -top-1 -right-1 bg-foreground text-background text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 grid place-items-center">
                              ×{it.quantity}
                            </span>
                          )}
                        </div>
                      ))}
                      {s.items.length > 10 && (
                        <div className="h-16 w-12 rounded-md bg-secondary grid place-items-center text-xs font-bold">
                          +{s.items.length - 10}
                        </div>
                      )}
                      {s.items.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhuma carta armazenada.</p>
                      )}
                    </div>

                    {s.items.length > 0 && (
                      <button
                        onClick={() => toggle(s.id)}
                        className="mt-3 text-xs font-semibold hover:underline"
                      >
                        {open ? "Ocultar lista" : "Ver lista completa"}
                      </button>
                    )}
                  </div>
                  {open && s.items.length > 0 && (
                    <div className="border-t border-border bg-secondary/30 px-5 py-3">
                      <ul className="divide-y divide-border">
                        {s.items.map((it) => (
                          <ItemRow key={it.id} item={it} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function TrackingForm({
  order,
  onSave,
}: {
  order: AdminServiceOrder;
  onSave: (
    carrier: "correios" | "latam" | "pickup",
    code: string | null,
    url: string | null,
  ) => void;
}) {
  const [carrier, setCarrier] = useState<"correios" | "latam">(
    order.carrier === "latam" ? "latam" : "correios",
  );
  const [code, setCode] = useState<string>(order.tracking_code ?? "");
  const [url, setUrl] = useState<string>(order.tracking_url ?? "");

  return (
    <div className="mt-2 rounded-md border border-border p-3 bg-secondary/40 flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">
          Transportadora
        </span>
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
        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">
          Código de rastreio
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          placeholder="BR123..."
        />
      </label>
      {carrier === "latam" && (
        <label className="text-xs flex-1 min-w-[200px]">
          <span className="block text-[10px] uppercase font-semibold text-muted-foreground">
            URL rastreio
          </span>
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
            carrier === "latam"
              ? url.trim() || null
              : "https://rastreamento.correios.com.br/app/index.php",
          )
        }
        className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold"
      >
        Salvar e despachar
      </button>
    </div>
  );
}
