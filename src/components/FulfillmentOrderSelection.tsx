import { formatScheduleShort, MODALITY_LABELS, modalityOfOrder } from "@/lib/fulfillment-alerts";
import { groupLabel } from "@/lib/fulfillment-groups";

export function FulfillmentOrderSelection({ orders, selected, onChange, afterPayment = false }: { orders: any[]; selected: string[]; onChange: (ids: string[]) => void; afterPayment?: boolean }) {
  if (!orders.length) return null;
  return <div className="space-y-2 text-sm">
    <p className="font-semibold">{afterPayment ? "Incluir pedidos anteriores nesta escolha?" : `Esta escolha será aplicada a ${selected.length} pedido(s)`}</p>
    {afterPayment && <p className="text-xs text-muted-foreground">Os pedidos marcados só serão alterados depois que o pagamento for confirmado. {selected.length} selecionado(s).</p>}
    <div className="max-h-64 overflow-y-auto divide-y divide-border border border-border rounded-md">
      {orders.map((o) => <label key={o.id} className="flex items-start gap-2 p-3 cursor-pointer">
        <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))} className="mt-1" />
        <span className="min-w-0"><span className="font-mono">#{o.id.slice(0, 8).toUpperCase()}</span> · {new Date(o.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}
          <span className="block text-xs text-muted-foreground">{(o.order_items ?? []).map((it: any) => `${it.quantity}× ${it.card_name}`).join(", ")}</span>
          {o.scheduled_at && <span className="block text-xs text-destructive">Já possui: {MODALITY_LABELS[modalityOfOrder(o)]} {formatScheduleShort(o.scheduled_at)} (será substituída)</span>}
          {o.fulfillment_group_id && <span className="block text-xs text-muted-foreground">Já está no {groupLabel(o, o.service_code)} (será movido)</span>}
        </span>
      </label>)}
    </div>
  </div>;
}