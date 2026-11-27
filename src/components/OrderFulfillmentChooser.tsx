import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScheduleSlotPicker } from "@/components/ScheduleSlotPicker";
import { EventSlotPicker, type EventSelection } from "@/components/EventSlotPicker";
import { listActiveEvents } from "@/lib/events.functions";
import type { PickupEvent } from "@/lib/events";
import { listFulfillmentCandidates, chooseOrderFulfillment } from "@/lib/fulfillment-groups.functions";
import { FulfillmentOrderSelection } from "./FulfillmentOrderSelection";
import { formatScheduleShort } from "@/lib/fulfillment-alerts";
import { isHandDeliveryArea } from "@/lib/hand-delivery";

export function OrderFulfillmentChooser({ order, onSaved }: { order: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<"pickup" | "delivery" | "event">("pickup");
  const [point, setPoint] = useState<"aruana" | "aeroporto">("aeroporto");
  const [at, setAt] = useState<string | null>(null);
  const [events, setEvents] = useState<PickupEvent[]>([]);
  const [event, setEvent] = useState<EventSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const list = useServerFn(listFulfillmentCandidates);
  const save = useServerFn(chooseOrderFulfillment);
  useEffect(() => {
    if (!open) return;
    setKey(crypto.randomUUID());
    list({ data: { orderId: order.id } }).then((rows) => { setOrders(rows); setSelected(rows.map((o) => o.id)); }).catch(() => toast.error("Não foi possível consultar seus pedidos."));
    listActiveEvents().then(setEvents).catch(() => {});
  }, [open, order.id, list]);
  const upcoming = orders.filter((o) => o.fulfillment_group_id && o.scheduled_at && new Date(o.scheduled_at).getTime() - Date.now() >= 86400000);
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Escolher envio/retirada</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Envio e retirada</DialogTitle></DialogHeader>
      {upcoming.length > 0 && <select aria-label="Incluir neste agendamento" className="border border-border bg-background rounded-md p-2 text-sm" value={existingId ?? ""} onChange={(e) => {
        const o = upcoming.find((x) => x.fulfillment_group_id === e.target.value);
        setExistingId(e.target.value || null);
        if (o) { setKind(o.schedule_kind); setAt(o.scheduled_at); }
      }}><option value="">Novo agendamento</option>{upcoming.filter((o, i, all) => all.findIndex((x) => x.fulfillment_group_id === o.fulfillment_group_id) === i).map((o) => <option key={o.id} value={o.fulfillment_group_id}>Incluir neste agendamento · {formatScheduleShort(o.scheduled_at)}</option>)}</select>}
      <select aria-label="Modalidade" className="border border-border bg-background rounded-md p-2 text-sm" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setAt(null); setExistingId(null); }}>
        <option value="pickup">Retirada em mãos</option><option value="event">Retirada em eventos</option>{isHandDeliveryArea(order) && <option value="delivery">Entrega em mãos · R$15</option>}
      </select>
      {kind === "pickup" && <select aria-label="Ponto de retirada" className="border border-border bg-background rounded-md p-2 text-sm" value={point} onChange={(e) => setPoint(e.target.value as typeof point)}><option value="aeroporto">Aeroporto</option></select>}
      {kind === "event" ? <EventSlotPicker events={events} value={event} onChange={(v) => { setEvent(v); setAt(v?.iso ?? null); }} /> : <ScheduleSlotPicker kind={kind} value={at} onChange={setAt} />}
      <FulfillmentOrderSelection orders={orders} selected={selected} onChange={setSelected} />
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy || !at || !selected.length || (kind === "event" && !event)} onClick={async () => {
        if (!at) return;
        setBusy(true);
        try { await save({ data: { orderIds: selected, key, kind, at, pickupPoint: point, eventId: event?.eventId, existingId } }); toast.success("Escolha confirmada nos pedidos selecionados."); setOpen(false); onSaved(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível confirmar."); } finally { setBusy(false); }
      }}>Confirmar escolha</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}