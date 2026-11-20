import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, CalendarCheck, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScheduleSlotPicker } from "@/components/ScheduleSlotPicker";
import { EventSlotPicker, type EventSelection } from "@/components/EventSlotPicker";
import { FulfillmentOrderSelection } from "@/components/FulfillmentOrderSelection";
import { listActiveEvents } from "@/lib/events.functions";
import type { PickupEvent } from "@/lib/events";
import { listFulfillmentCandidates, chooseOrderFulfillment } from "@/lib/fulfillment-groups.functions";
import { MODALITY_LABELS, modalityOfOrder, formatScheduleShort } from "@/lib/fulfillment-alerts";
import { isHandDeliveryArea } from "@/lib/hand-delivery";

export const Route = createFileRoute("/retirada-envio")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Envios e Retirada — Sevii Colecionáveis" },
      { name: "description", content: "Escolha como receber seus pedidos pagos: retirada em mãos, retirada em eventos ou entrega em mãos em Aracaju." },
      { property: "og:title", content: "Envios e Retirada — Sevii Colecionáveis" },
      { property: "og:description", content: "Solicite a modalidade de retirada ou envio dos seus pedidos." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RetiradaEnvioPage,
});

type Kind = "pickup" | "event" | "delivery";

function RetiradaEnvioPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("pickup");
  const [point, setPoint] = useState<"aruana" | "aeroporto">("aruana");
  const [at, setAt] = useState<string | null>(null);
  const [events, setEvents] = useState<PickupEvent[]>([]);
  const [eventSel, setEventSel] = useState<EventSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const list = useServerFn(listFulfillmentCandidates);
  const save = useServerFn(chooseOrderFulfillment);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await list({ data: {} });
      setOrders(rows);
    } catch {
      toast.error("Não foi possível consultar seus pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    listActiveEvents().then(setEvents).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const firstSelected = orders.find((o) => selected.includes(o.id));
  const deliveryAvailable = firstSelected ? isHandDeliveryArea(firstSelected) : true;

  const confirm = async () => {
    if (!at || !selected.length) return;
    setBusy(true);
    try {
      await save({ data: { orderIds: selected, key, kind, at, pickupPoint: point, eventId: eventSel?.eventId ?? null } });
      toast.success("Escolha confirmada nos pedidos selecionados.");
      setSelected([]);
      setAt(null);
      setEventSel(null);
      setKey(crypto.randomUUID());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Envios e Retirada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha como receber seus pedidos pagos: retirada em mãos, retirada em eventos ou entrega em mãos em Aracaju.
        Dúvidas? Consulte a <Link to="/envios" className="underline">política de envios e retirada</Link>.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando seus pedidos…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          Você não tem pedidos pagos aguardando escolha de envio ou retirada no momento.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">1. Selecione os pedidos</h2>
            <p className="text-xs text-muted-foreground">Nenhum pedido é marcado automaticamente. A escolha vale somente para os pedidos que você marcar.</p>
            <FulfillmentOrderSelection orders={orders} selected={selected} onChange={setSelected} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">2. Escolha a modalidade</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => { setKind("pickup"); setAt(null); setEventSel(null); }}
                className={`flex items-start gap-2 rounded-md border p-3 text-left text-sm transition-colors ${kind === "pickup" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span><span className="font-medium">Retirada em mãos</span><span className="block text-xs text-muted-foreground">Aruana ou Aeroporto, seg–sex, 14h–19h</span></span>
              </button>
              <button
                type="button"
                onClick={() => { setKind("event"); setAt(null); }}
                className={`flex items-start gap-2 rounded-md border p-3 text-left text-sm transition-colors ${kind === "event" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
              >
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span><span className="font-medium">Retirada em eventos</span><span className="block text-xs text-muted-foreground">Nos eventos em que a loja estiver presente</span></span>
              </button>
              <button
                type="button"
                disabled={!deliveryAvailable}
                onClick={() => { setKind("delivery"); setAt(null); setEventSel(null); }}
                className={`flex items-start gap-2 rounded-md border p-3 text-left text-sm transition-colors disabled:opacity-50 ${kind === "delivery" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
              >
                <Bike className="mt-0.5 h-4 w-4 shrink-0" />
                <span><span className="font-medium">Entrega em mãos · R$15</span><span className="block text-xs text-muted-foreground">Somente Aracaju, quintas-feiras a partir das 19h</span></span>
              </button>
            </div>
            {kind === "pickup" && (
              <select
                aria-label="Ponto de retirada"
                className="w-full rounded-md border border-border bg-background p-2 text-sm sm:w-auto"
                value={point}
                onChange={(e) => setPoint(e.target.value as typeof point)}
              >
                <option value="aruana">Condomínio Vista de Aruana</option>
                <option value="aeroporto">Condomínio Palm Ville (Aeroporto)</option>
              </select>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">3. Escolha a data e o horário</h2>
            {kind === "event" ? (
              <EventSlotPicker events={events} value={eventSel} onChange={(v) => { setEventSel(v); setAt(v?.iso ?? null); }} />
            ) : (
              <ScheduleSlotPicker kind={kind} value={at} onChange={setAt} />
            )}
          </section>

          {at && selected.length > 0 && (
            <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              {MODALITY_LABELS[modalityOfOrder({ shipping_method: "arrange", schedule_kind: kind })]} — {formatScheduleShort(at)} para {selected.length} pedido(s).
            </p>
          )}

          <Button className="w-full sm:w-auto" disabled={busy || !at || !selected.length || (kind === "event" && !eventSel)} onClick={confirm}>
            {busy ? "Confirmando…" : "Confirmar escolha"}
          </Button>
        </div>
      )}
    </div>
  );
}
