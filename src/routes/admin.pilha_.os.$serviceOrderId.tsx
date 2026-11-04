import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateServiceOrder, adminRestoreItemToStack } from "@/lib/service-orders-admin.functions";
import { adminPartialCancelItem } from "@/utils/orders.functions";
import {
  adminGetServiceOrderDetail,
  adminEditServiceOrder,
  adminConfirmServiceOrderFee,
  type AdminServiceOrderDetail,
} from "@/lib/admin-pilha-detail.functions";
import type { AdminStackItem } from "@/lib/admin-pilha.functions";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/pilha_/os/$serviceOrderId")({
  head: () => ({ meta: [{ title: "Ordem de Serviço — Sevii Admin" }] }),
  component: AdminServiceOrderDetailPage,
});

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em preparação",
  dispatched: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const STATUS_OPTIONS = ["paid", "preparing", "dispatched", "delivered", "cancelled"] as const;

function AdminServiceOrderDetailPage() {
  const { serviceOrderId } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [so, setSo] = useState<AdminServiceOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AdminStackItem | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchDetail = useServerFn(adminGetServiceOrderDetail);
  const update = useServerFn(adminUpdateServiceOrder);
  const confirmFee = useServerFn(adminConfirmServiceOrderFee);

  const load = useCallback(async () => {
    try {
      const res = await fetchDetail({ data: { serviceOrderId } });
      setSo(res);
      setNotFound(false);
    } catch (e: any) {
      if (e?.message?.includes("não encontrada")) setNotFound(true);
      else toast.error(e?.message ?? "Erro ao carregar OS.");
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, serviceOrderId]);

  useEffect(() => {
    if (!authLoading && !isAdmin) nav({ to: "/" });
  }, [authLoading, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const ch = supabase
      .channel(`admin-so-${serviceOrderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders", filter: `id=eq.${serviceOrderId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "card_stack_items", filter: `service_order_id=eq.${serviceOrderId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin, serviceOrderId, load]);

  const [selFinishes, setSelFinishes] = useState<string[]>([]);
  const [selCollections, setSelCollections] = useState<string[]>([]);
  const [selConditions, setSelConditions] = useState<string[]>([]);

  const items = useMemo(() => so?.items ?? [], [so]);
  const options = useMemo(() => facetOptions(items), [items]);
  const hasFilters = selFinishes.length > 0 || selCollections.length > 0 || selConditions.length > 0;
  const filteredItems = useMemo(
    () =>
      hasFilters
        ? items.filter(
            (it) =>
              (selFinishes.length === 0 || selFinishes.includes(it.finish ?? "")) &&
              (selCollections.length === 0 || selCollections.includes(it.collection ?? "")) &&
              (selConditions.length === 0 || selConditions.includes(it.condition ?? "")),
          )
        : items,
    [items, hasFilters, selFinishes, selCollections, selConditions],
  );

  if (authLoading || !isAdmin || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (notFound || !so) {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Ordem de serviço não encontrada.</p>
          <Link to="/admin/pilha" className="mt-3 inline-block text-sm font-semibold underline">
            ← Voltar para a Pilha
          </Link>
        </div>
      </div>
    );
  }

  const phoneDigits = (so.customer_phone ?? so.phone ?? "").replace(/\D/g, "");
  const waPhone = phoneDigits ? (phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : null;
  const scheduledLabel = so.scheduled_at
    ? formatSchedule(so.schedule_kind ?? (so.method === "app" ? "delivery" : "pickup"), so.scheduled_at)
    : null;

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
              <p className="text-xs font-mono text-muted-foreground">OS #{so.code}</p>
              <h1 className="text-2xl font-bold">{so.customer_name ?? so.recipient_name ?? "Cliente"}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{new Date(so.created_at).toLocaleString("pt-BR")}</span>
                <span className="font-semibold text-foreground">{serviceOrderMethodLabel(so.method)}</span>
                {waPhone && (
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp ({so.customer_phone ?? so.phone})
                  </a>
                )}
              </div>
              {so.method === "app" && so.fee_status !== "confirmed" && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Taxa de entrega R$ 15,00 pendente.</strong> Confirme após receber o comprovante do Pix.
                  </span>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Confirmar recebimento da taxa de R$ 15,00?")) return;
                      try {
                        await confirmFee({ data: { serviceOrderId: so.id } });
                        toast.success("Taxa confirmada.");
                        await load();
                      } catch (e: any) {
                        toast.error(e?.message ?? "Falha ao confirmar taxa.");
                      }
                    }}
                    className="rounded-md bg-amber-600 text-white px-3 py-1 text-[11px] font-semibold hover:bg-amber-700"
                  >
                    Confirmar taxa
                  </button>
                </div>
              )}
              {so.method === "app" && so.fee_status === "confirmed" && (
                <p className="mt-3 text-xs font-semibold text-green-700">Taxa de entrega R$ 15,00 confirmada ✓</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                value={so.status}
                onChange={async (e) => {
                  try {
                    await update({ data: { serviceOrderId: so.id, status: e.target.value as any } });
                    toast.success("Status atualizado.");
                    await load();
                  } catch (err: any) {
                    toast.error(err?.message ?? "Falha ao atualizar.");
                  }
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold"
              >
                {so.status === "awaiting_payment" && (
                  <option value="awaiting_payment" disabled>{STATUS_LABEL.awaiting_payment}</option>
                )}
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Cliente">
            <Field label="Nome" value={so.customer_name ?? so.recipient_name} />
            <Field label="E-mail" value={so.customer_email} />
            <Field label="Telefone" value={so.customer_phone ?? so.phone ?? "—"} />
            <Field label="CPF" value={so.customer_cpf ?? "—"} />
          </Card>

          <Card title="Endereço">
            {so.street ? (
              <>
                <p className="text-sm">{so.street}, {so.number}{so.complement ? ` — ${so.complement}` : ""}</p>
                <p className="text-sm">{so.neighborhood}</p>
                <p className="text-sm">{so.city} / {so.state}</p>
                <p className="text-xs text-muted-foreground mt-1">CEP: {so.cep}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem endereço (retirada).</p>
            )}
          </Card>

          <Card title="Pagamento & envio">
            <Field label="Modalidade" value={serviceOrderMethodLabel(so.method)} />
            {scheduledLabel && <Field label="Agendado para" value={scheduledLabel} />}
            {so.event_name && <Field label="Evento" value={so.event_name} />}
            {so.amount_cents > 0 && <Field label="Valor" value={fmtMoney(so.amount_cents)} />}
            {so.payment ? (
              <>
                <Field label="Pagamento" value={so.payment.payment_method ?? so.payment.status} />
                {so.payment.mercadopago_payment_id && (
                  <Field label="ID Mercado Pago" value={so.payment.mercadopago_payment_id} mono />
                )}
                <p className="text-xs mt-1">
                  <Link to="/admin/orders/$orderId" params={{ orderId: so.payment.order_id }} className="underline">
                    Ver pedido do pagamento
                  </Link>
                </p>
              </>
            ) : (
              <Field label="Pagamento" value={so.amount_cents > 0 ? "—" : "Sem cobrança"} />
            )}
            {so.arte_em_cards_code && <Field label="Código Arte em Cards" value={so.arte_em_cards_code} mono />}
            {so.tracking_code && <Field label="Rastreio" value={so.tracking_code} mono />}
          </Card>
        </div>

        {/* Editar envio/retirada + histórico */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Envio / retirada
            </h2>
            {!["delivered", "cancelled"].includes(so.status) && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Editar envio/retirada
              </Button>
            )}
          </div>
          {so.edit_history.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {so.edit_history.map((h, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {new Date(h.at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                  </span>
                  {h.by ? ` · ${h.by}` : ""} — {h.summary}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
          )}
        </div>

        {/* Itens */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest">
              Itens ({filteredItems.length}{hasFilters ? ` de ${items.length}` : ""})
            </h2>
            <StackPickingSummary items={items as any} />
          </div>
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2 bg-secondary/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar itens</span>
            <ItemFacetFilter label="Acabamento" options={options.finish} selected={selFinishes} onChange={setSelFinishes} />
            <ItemFacetFilter label="Coleção" options={options.collection} selected={selCollections} onChange={setSelCollections} />
            <ItemFacetFilter label="Condição" options={options.condition} selected={selConditions} onChange={setSelConditions} />
            {hasFilters && (
              <button
                onClick={() => { setSelFinishes([]); setSelCollections([]); setSelConditions([]); }}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
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
                      ? <>🔨 Leilão: {it.auction_name}</>
                      : it.order_id
                        ? <>Pedido <Link to="/admin/orders/$orderId" params={{ orderId: it.order_id }} className="font-mono underline">#{it.order_id.slice(0, 8)}</Link></>
                        : null}
                    {it.unit_price_cents > 0 && <> · {fmtMoney(it.unit_price_cents)} un.</>}
                  </p>
                  <StackItemPickedBy item={it as any} onChanged={load} />
                  {!["delivered", "cancelled"].includes(so.status) && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => setCancelTarget(it)}
                        className="rounded-md border border-destructive/40 text-destructive bg-background px-2 py-0.5 text-[11px] font-semibold hover:bg-destructive/10"
                      >
                        Cancelar item
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {so.notes && (
            <p className="px-5 py-3 border-t border-border text-xs italic text-muted-foreground whitespace-pre-wrap">
              Obs: {so.notes}
            </p>
          )}
        </div>
      </main>

      {cancelTarget && (
        <CancelItemDialog
          so={so}
          item={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={async () => {
            setCancelTarget(null);
            await load();
          }}
        />
      )}
      {editing && (
        <EditShippingDialog so={so} onClose={() => setEditing(false)} onDone={async () => { setEditing(false); await load(); }} />
      )}
    </div>
  );
}

function CancelItemDialog({
  so,
  item,
  onClose,
  onDone,
}: {
  so: AdminServiceOrderDetail;
  item: AdminStackItem;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const hasOrderOrigin = Boolean(item.order_id && item.order_item_id);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<"customer_choice" | "mercadopago" | "coupon" | "manual">("customer_choice");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelFn = useServerFn(adminPartialCancelItem);
  const restoreFn = useServerFn(adminRestoreItemToStack);

  const refundPreview = Math.round((item.unit_price_cents ?? 0) * qty);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (hasOrderOrigin) {
        await cancelFn({
          data: {
            order_id: item.order_id!,
            order_item_id: item.order_item_id!,
            quantity: qty,
            refund_method: method,
            notes: notes.trim() || null,
            operation_key: crypto.randomUUID(),
            confirmed: true,
          },
        });
        toast.success("Item cancelado e reembolso registrado. Cliente avisado por e-mail.");
      } else {
        await restoreFn({ data: { itemId: item.id } });
        toast.success("Item devolvido à pilha do cliente.");
      }
      await onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cancelar item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar item</DialogTitle>
          <DialogDescription>{item.card_name}{item.card_number ? ` · ${item.card_number}` : ""}</DialogDescription>
        </DialogHeader>
        {hasOrderOrigin ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              Quantidade
              <input
                type="number"
                min={1}
                max={item.quantity}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(item.quantity, parseInt(e.target.value) || 1)))}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">de {item.quantity}</span>
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Forma de reembolso</legend>
              {([
                { v: "customer_choice", l: "Saldo Sevii ou forma original — escolha do cliente" },
                { v: "mercadopago", l: "Estorno automático no Mercado Pago" },
                { v: "coupon", l: "Cupom de desconto (forma anterior)" },
                { v: "manual", l: "Manual (Pix por fora)" },
              ] as const).map((o) => (
                <label key={o.v} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="refund" checked={method === o.v} onChange={() => setMethod(o.v)} className="mt-1" />
                  <span>{o.l}</span>
                </label>
              ))}
            </fieldset>
            <label className="block text-sm font-semibold">
              Motivo do cancelamento
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="border-t border-border pt-3 text-sm flex justify-between">
              <span>Valor a reembolsar</span>
              <strong className="tabular-nums">{fmtMoney(refundPreview)}</strong>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
              <span>Confirmo o cancelamento de {qty} unidade(s) e a solicitação de reembolso, sem devolver ao estoque.</span>
            </label>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este item não veio de um pedido pago (ex.: carta de leilão). Ele será{" "}
            <strong>devolvido à pilha do cliente</strong>, sem reembolso.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={onClose}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={submitting || (hasOrderOrigin && (!confirmed || notes.trim().length < 5))}
            onClick={submit}
          >
            {submitting ? "Processando…" : hasOrderOrigin ? "Confirmar cancelamento" : "Devolver à pilha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditShippingDialog({
  so,
  onClose,
  onDone,
}: {
  so: AdminServiceOrderDetail;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const editFn = useServerFn(adminEditServiceOrder);
  const [method, setMethod] = useState(so.method);
  const [scheduledAt, setScheduledAt] = useState(so.scheduled_at ?? "");
  const [recipientName, setRecipientName] = useState(so.recipient_name ?? "");
  const [phone, setPhone] = useState(so.phone ?? "");
  const [cep, setCep] = useState(so.cep ?? "");
  const [street, setStreet] = useState(so.street ?? "");
  const [number, setNumber] = useState(so.number ?? "");
  const [complement, setComplement] = useState(so.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(so.neighborhood ?? "");
  const [city, setCity] = useState(so.city ?? "");
  const [stateUf, setStateUf] = useState(so.state ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsAddress = method === "correios" || method === "app";
  const needsSchedule = method === "app" || method === "presencial";

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error("Informe o motivo da alteração.");
      return;
    }
    setSubmitting(true);
    try {
      await editFn({
        data: {
          serviceOrderId: so.id,
          method: method as any,
          scheduledAt: needsSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : needsSchedule ? undefined : null,
          address: needsAddress
            ? { recipientName, phone, cep, street, number, complement: complement || null, neighborhood, city, state: stateUf }
            : undefined,
          reason: reason.trim(),
        },
      });
      toast.success("Envio/retirada atualizado. Cliente e loja avisados por e-mail.");
      await onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar envio/retirada — OS #{so.code}</DialogTitle>
          <DialogDescription>A alteração é registrada no histórico e avisada ao cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-semibold">
            Modalidade
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="correios">{serviceOrderMethodLabel("correios")}</option>
              <option value="app">{serviceOrderMethodLabel("app")}</option>
              <option value="presencial">{serviceOrderMethodLabel("presencial")}</option>
              <option value="evento">{serviceOrderMethodLabel("evento")}</option>
              <option value="arte_em_cards">{serviceOrderMethodLabel("arte_em_cards")}</option>
            </select>
          </label>
          {needsSchedule && (
            <label className="block text-xs font-semibold">
              Data e horário {method === "app" ? "(quinta-feira, a partir das 19h)" : "(seg–sex, 14h–19h)"}
              <input
                type="datetime-local"
                value={scheduledAt ? scheduledAt.slice(0, 16) : ""}
                onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          )}
          {needsAddress && (
            <div className="grid sm:grid-cols-2 gap-2">
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Nome completo" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className="border rounded-md px-3 py-2 text-sm" placeholder="UF" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value)} />
            </div>
          )}
          <label className="block text-xs font-semibold">
            Motivo da alteração
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="ex.: cliente pediu para trocar para retirada em mãos"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={onClose}>Voltar</Button>
          <Button disabled={submitting || reason.trim().length < 3} onClick={submit}>
            {submitting ? "Salvando…" : "Salvar alteração"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
