import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGetStackDetail,
  type AdminStackDetail,
} from "@/lib/admin-pilha-detail.functions";
import { serviceOrderMethodLabel } from "@/lib/fulfillment-labels";
import { formatSchedule } from "@/lib/scheduling";
import { ItemFacetFilter } from "@/components/admin/ItemFacetFilter";
import {
  Card,
  Field,
  Thumb,
  StackItemPickedBy,
  StackPickingSummary,
  facetOptions,
  fmtMoney,
} from "@/components/admin/pilha-detail";

export const Route = createFileRoute("/admin/pilha_/pilha/$stackId")({
  head: () => ({ meta: [{ title: "Pilha — Sevii Admin" }] }),
  component: AdminStackDetailPage,
});

const OS_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em preparação",
  dispatched: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const daysBetween = (a: Date, b: Date) =>
  Math.ceil((b.getTime() - a.getTime()) / 86_400_000);

function AdminStackDetailPage() {
  const { stackId } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [stack, setStack] = useState<AdminStackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchDetail = useServerFn(adminGetStackDetail);

  const load = useCallback(async () => {
    try {
      const res = await fetchDetail({ data: { stackId } });
      setStack(res);
      setNotFound(false);
    } catch (e: any) {
      if (e?.message?.includes("não encontrada")) setNotFound(true);
      else toast.error(e?.message ?? "Erro ao carregar pilha.");
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, stackId]);

  useEffect(() => {
    if (!authLoading && !isAdmin) nav({ to: "/" });
  }, [authLoading, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const ch = supabase
      .channel(`admin-stack-${stackId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_stacks", filter: `id=eq.${stackId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "card_stack_items", filter: `stack_id=eq.${stackId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin, stackId, load]);

  const [selFinishes, setSelFinishes] = useState<string[]>([]);
  const [selCollections, setSelCollections] = useState<string[]>([]);
  const [selConditions, setSelConditions] = useState<string[]>([]);
  const [selOrder, setSelOrder] = useState<string>("");

  const items = useMemo(() => stack?.items ?? [], [stack]);
  const options = useMemo(() => facetOptions(items), [items]);
  const hasFilters =
    selFinishes.length > 0 || selCollections.length > 0 || selConditions.length > 0 || selOrder !== "";
  const filteredItems = useMemo(
    () =>
      items.filter(
        (it) =>
          (selFinishes.length === 0 || selFinishes.includes(it.finish ?? "")) &&
          (selCollections.length === 0 || selCollections.includes(it.collection ?? "")) &&
          (selConditions.length === 0 || selConditions.includes(it.condition ?? "")) &&
          (selOrder === "" || it.order_id === selOrder),
      ),
    [items, selFinishes, selCollections, selConditions, selOrder],
  );

  // Histórico derivado: criação, entradas por pedido/leilão, OS geradas.
  const history = useMemo(() => {
    if (!stack) return [] as Array<{ at: string; text: string }>;
    const ev: Array<{ at: string; text: string }> = [
      { at: stack.started_at, text: "Pilha criada (prazo de 30 dias)." },
    ];
    const byOrigin = new Map<string, { at: string; count: number; label: string }>();
    for (const it of stack.items) {
      const key = it.order_id ?? (it.auction_name ? `auction:${it.auction_name}` : `item:${it.id}`);
      const label = it.order_id
        ? `Pedido #${it.order_id.slice(0, 8).toUpperCase()}`
        : it.auction_name
          ? `Leilão ${it.auction_name}`
          : "Item avulso";
      const cur = byOrigin.get(key);
      if (cur) cur.count += it.quantity;
      else byOrigin.set(key, { at: it.created_at, count: it.quantity, label });
    }
    for (const e of byOrigin.values()) {
      ev.push({ at: e.at, text: `${e.count} carta(s) adicionada(s) — ${e.label}.` });
    }
    for (const so of stack.serviceOrders) {
      ev.push({
        at: so.created_at,
        text: `OS #${so.code} criada — ${serviceOrderMethodLabel(so.method)}${
          so.scheduled_at ? ` para ${formatSchedule(so.schedule_kind ?? "pickup", so.scheduled_at)}` : ""
        } (${OS_STATUS_LABEL[so.status] ?? so.status}).`,
      });
    }
    return ev.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [stack]);

  if (authLoading || !isAdmin || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (notFound || !stack) {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Pilha não encontrada.</p>
          <Link to="/admin/pilha" className="mt-3 inline-block text-sm font-semibold underline">
            ← Voltar para a Pilha
          </Link>
        </div>
      </div>
    );
  }

  const days = daysBetween(new Date(), new Date(stack.expires_at));
  const totalCards = items.reduce((a, i) => a + i.quantity, 0);
  const phoneDigits = (stack.customer_phone ?? "").replace(/\D/g, "");
  const waPhone = phoneDigits ? (phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link to="/admin/pilha" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Pilha
          </Link>
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">Sevii · Admin</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground">Pilha {stack.id.slice(0, 8)}</p>
              <h1 className="text-2xl font-bold">{stack.customer_name ?? "Cliente sem nome"}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>Iniciada {new Date(stack.started_at).toLocaleDateString("pt-BR")}</span>
                {stack.customer_email && <span>{stack.customer_email}</span>}
                {waPhone && (
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp ({stack.customer_phone})
                  </a>
                )}
              </div>
            </div>
            <div className={`text-right text-sm font-bold ${days <= 2 ? "text-red-600" : days <= 7 ? "text-orange-600" : ""}`}>
              {days > 0 ? `${days} dia${days === 1 ? "" : "s"} restantes` : "Vencida"}
              <div className="text-xs font-normal text-muted-foreground">
                {totalCards} carta(s) · {items.length} linha(s)
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Cliente">
            <Field label="Nome" value={stack.customer_name} />
            <Field label="E-mail" value={stack.customer_email} />
            <Field label="Telefone" value={stack.customer_phone ?? "—"} />
            <Field label="CPF" value={stack.customer_cpf ?? "—"} />
          </Card>
          <Card title="Prazo">
            <Field label="Início" value={new Date(stack.started_at).toLocaleDateString("pt-BR")} />
            <Field label="Prazo final (30 dias)" value={new Date(stack.expires_at).toLocaleDateString("pt-BR")} />
            <Field label="Dias restantes" value={days > 0 ? `${days}` : "Vencida"} />
            <Field label="Status" value={stack.status === "active" ? "Ativa" : stack.status} />
          </Card>
          <Card title="Ordens de serviço">
            {stack.serviceOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {stack.serviceOrders.map((so) => (
                  <li key={so.id} className="text-xs">
                    <Link
                      to="/admin/pilha/os/$serviceOrderId"
                      params={{ serviceOrderId: so.id }}
                      className="font-mono font-semibold underline"
                    >
                      OS #{so.code}
                    </Link>{" "}
                    — {serviceOrderMethodLabel(so.method)}
                    {so.scheduled_at ? ` · ${formatSchedule(so.schedule_kind ?? "pickup", so.scheduled_at)}` : ""}
                    {" "}· {OS_STATUS_LABEL[so.status] ?? so.status}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Pedidos que compõem a pilha */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Pedidos na pilha ({stack.orders.length})
          </h2>
          {stack.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido — itens de leilão ou avulsos.</p>
          ) : (
            <ul className="space-y-1.5">
              {stack.orders.map((o) => (
                <li key={o.id} className="text-xs flex flex-wrap items-center gap-2">
                  <Link to="/admin/orders/$orderId" params={{ orderId: o.id }} className="font-mono font-semibold underline">
                    #{o.id.slice(0, 8).toUpperCase()}
                  </Link>
                  <span className="text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")} · {o.status}
                    {o.total_cents != null ? ` · ${fmtMoney(o.total_cents)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Itens */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest">
              Cartas da pilha ({filteredItems.length}{hasFilters ? ` de ${items.length}` : ""})
            </h2>
            <StackPickingSummary items={items as any} />
          </div>
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2 bg-secondary/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar itens</span>
            <ItemFacetFilter label="Acabamento" options={options.finish} selected={selFinishes} onChange={setSelFinishes} />
            <ItemFacetFilter label="Coleção" options={options.collection} selected={selCollections} onChange={setSelCollections} />
            <ItemFacetFilter label="Condição" options={options.condition} selected={selConditions} onChange={setSelConditions} />
            {stack.orders.length > 0 && (
              <select
                value={selOrder}
                onChange={(e) => setSelOrder(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="">Todos os pedidos</option>
                {stack.orders.map((o) => (
                  <option key={o.id} value={o.id}>#{o.id.slice(0, 8).toUpperCase()}</option>
                ))}
              </select>
            )}
            {hasFilters && (
              <button
                onClick={() => { setSelFinishes([]); setSelCollections([]); setSelConditions([]); setSelOrder(""); }}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
          {filteredItems.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma carta armazenada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((it) => (
                <li key={it.id} className="flex gap-3 px-5 py-3">
                  <Thumb item={it} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{it.quantity}× {it.card_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[it.collection, it.card_number, it.finish, it.language, it.condition].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {it.auction_name
                        ? <>🔨 Leilão: {it.auction_name}{it.auction_date ? ` · ${new Date(it.auction_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</>
                        : it.order_id
                          ? <>Pedido <Link to="/admin/orders/$orderId" params={{ orderId: it.order_id }} className="font-mono underline">#{it.order_id.slice(0, 8)}</Link></>
                          : null}
                      {it.unit_price_cents > 0 && <> · {fmtMoney(it.unit_price_cents)} un.</>}
                      {it.status !== "stored" && <> · <span className="font-semibold">{it.status}</span></>}
                    </p>
                    <StackItemPickedBy item={it as any} onChanged={load} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Histórico */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Histórico da pilha
          </h2>
          <ul className="space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {new Date(h.at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                </span>{" "}
                — {h.text}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
