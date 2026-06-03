
function PartialCancelDialog({
  item,
  order,
  onClose,
  onDone,
}: {
  item: any;
  order: any;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const cancelledQty = item.cancelled_quantity ?? 0;
  const remaining = (item.quantity ?? 0) - cancelledQty;
  const [qty, setQty] = useState(remaining);
  const [method, setMethod] = useState<"mercadopago" | "coupon" | "manual">(
    order.mercadopago_payment_id ? "mercadopago" : "coupon",
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Preview do valor de reembolso (proporcional ao desconto do pedido)
  const baseCents = (item.unit_price_cents ?? 0) * qty;
  const subtotal = order.subtotal_cents || 1;
  const discount = order.discount_cents ?? 0;
  const ratio = Math.max(0, Math.min(1, 1 - discount / subtotal));
  const refundPreview = Math.round(baseCents * ratio);

  const submit = async () => {
    if (qty < 1 || qty > remaining) {
      toast.error("Quantidade inválida.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminPartialCancelItem({
        data: {
          order_id: order.id,
          order_item_id: item.id,
          quantity: qty,
          refund_method: method,
          notes: notes.trim() || null,
        },
      });
      toast.success(
        `Item cancelado. ${res.refundDetails ?? `Reembolso: ${fmtBRL(res.refundCents ?? 0)}`}`,
        { duration: 6000 },
      );
      await onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-card border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-bold">Cancelar item parcialmente</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.card_name}
            {item.card_number ? ` · ${item.card_number}` : ""}
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Quantidade a cancelar
          </label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="number"
              min={1}
              max={remaining}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(remaining, parseInt(e.target.value) || 1)))}
              className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold"
            />
            <span className="text-xs text-muted-foreground">de {remaining} disponíveis</span>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Forma de reembolso
          </label>
          <div className="mt-1 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="refund"
                checked={method === "mercadopago"}
                disabled={!order.mercadopago_payment_id}
                onChange={() => setMethod("mercadopago")}
                className="mt-0.5"
              />
              <span>
                <strong>Estorno automático no Mercado Pago</strong>
                {!order.mercadopago_payment_id && (
                  <span className="text-xs text-muted-foreground"> — indisponível (pagamento não foi via MP)</span>
                )}
                <span className="block text-xs text-muted-foreground">Cai na conta/cartão do cliente em até 7 dias úteis.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="refund"
                checked={method === "coupon"}
                onChange={() => setMethod("coupon")}
                className="mt-0.5"
              />
              <span>
                <strong>Cupom de desconto</strong>
                <span className="block text-xs text-muted-foreground">Gera cupom único no valor do reembolso (válido 1 ano).</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="refund"
                checked={method === "manual"}
                onChange={() => setMethod("manual")}
                className="mt-0.5"
              />
              <span>
                <strong>Manual (Pix por fora)</strong>
                <span className="block text-xs text-muted-foreground">Apenas registra; você devolve por fora.</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: sem estoque físico"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={2}
          />
        </div>

        <div className="rounded-md bg-secondary/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor a reembolsar:</span>
            <span className="font-bold tabular-nums">{fmtBRL(refundPreview)}</span>
          </div>
          {discount > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Já desconta proporcionalmente {discount > 0 ? "o desconto/Pix" : ""} aplicado no pedido.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Processando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
