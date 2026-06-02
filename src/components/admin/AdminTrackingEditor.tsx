import { useEffect, useState } from "react";
import { toast } from "sonner";

type CarrierKind = "correios" | "latam" | "pickup";
export type TrackingInfo = {
  carrier: CarrierKind | null;
  tracking_code: string | null;
  tracking_url: string | null;
};

function normalizeCarrier(c: any): CarrierKind {
  if (c === "latam") return "latam";
  if (c === "pickup") return "pickup";
  return "correios";
}

const CORREIOS_URL = "https://rastreamento.correios.com.br/app/index.php";

export function AdminTrackingEditor({
  order,
  onSave,
}: {
  order: any;
  onSave: (info: TrackingInfo) => Promise<void> | void;
}) {
  const initialCarrier: CarrierKind = normalizeCarrier(order.carrier);
  const [carrier, setCarrier] = useState<CarrierKind>(initialCarrier);
  const [code, setCode] = useState<string>(order.tracking_code ?? "");
  const [url, setUrl] = useState<string>(
    order.carrier === "latam" ? (order.tracking_url ?? "") : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCarrier(normalizeCarrier(order.carrier));
    setCode(order.tracking_code ?? "");
    setUrl(order.carrier === "latam" ? (order.tracking_url ?? "") : "");
  }, [order.id, order.carrier, order.tracking_code, order.tracking_url]);

  const trimmedCode = code.trim();
  const trimmedUrl = url.trim();
  const finalCode = carrier === "pickup" ? null : (trimmedCode || null);
  const finalUrl =
    carrier === "pickup"
      ? null
      : carrier === "correios"
        ? CORREIOS_URL
        : (trimmedUrl || null);
  const currentCarrier = order.carrier ?? null;
  const currentCode = order.tracking_code ?? null;
  const currentUrl = order.tracking_url ?? null;
  const dirty =
    carrier !== (currentCarrier ?? "correios") ||
    finalCode !== currentCode ||
    finalUrl !== currentUrl;

  const handleSave = async () => {
    if (carrier === "latam" && trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      toast.error("Link inválido. A URL precisa começar com http:// ou https://");
      return;
    }
    setSaving(true);
    try {
      await onSave({ carrier, tracking_code: finalCode, tracking_url: finalUrl });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Rastreio do envio
        </span>
        {order.carrier !== "pickup" && order.tracking_code && order.tracking_url && (
          <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-[11px] underline text-foreground">
            abrir {order.carrier === "latam" ? "Latam" : "Correios"}
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`carrier-${order.id}`} checked={carrier === "correios"} onChange={() => setCarrier("correios")} />
          Correios
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`carrier-${order.id}`} checked={carrier === "latam"} onChange={() => setCarrier("latam")} />
          Latam
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`carrier-${order.id}`} checked={carrier === "pickup"} onChange={() => setCarrier("pickup")} />
          Retirado em mãos
        </label>
        {carrier !== "pickup" && (
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de rastreio"
            className="flex-1 min-w-[160px] rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
          />
        )}
      </div>
      {carrier === "latam" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link de rastreio da Latam (https://...)"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
      )}
      {carrier === "pickup" && (
        <p className="text-[11px] text-muted-foreground">
          Pedido entregue em mãos — nenhum código de rastreio será enviado ao cliente.
        </p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar rastreio"}
        </button>
      </div>
    </div>
  );
}
