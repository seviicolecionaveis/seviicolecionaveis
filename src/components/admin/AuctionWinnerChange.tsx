import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { UserRoundPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FinanceCustomerPicker, type FinanceCustomer } from '@/components/admin/FinanceCustomerPicker';
import { previewAuctionWinnerChange, changeAuctionWinner, type WinnerChangePreview } from '@/lib/auction-winner.functions';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AuctionWinnerChange({ items, onChanged }: {
  items: Array<{ id: string; name: string }>; onChanged: () => void;
}) {
  const previewFn = useServerFn(previewAuctionWinnerChange);
  const changeFn = useServerFn(changeAuctionWinner);
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [preview, setPreview] = useState<WinnerChangePreview | null>(null);
  const [customer, setCustomer] = useState<FinanceCustomer | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [operationId, setOperationId] = useState('');
  const [result, setResult] = useState<{ targetOrderId: string; sourceOrderId: string } | null>(null);

  async function load(id: string) {
    setItemId(id); setPreview(null); setCustomer(null); setConfirmed(false); setError('');
    if (!id) return;
    setBusy(true);
    try { setPreview(await previewFn({ data: { itemId: id } })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível conferir o arremate.'); }
    finally { setBusy(false); }
  }

  async function save() {
    const targetUserId = preview?.matchedUserId ?? customer?.user_id;
    if (!preview || !targetUserId || !confirmed || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      const changed = await changeFn({ data: {
        itemId: preview.itemId, sourceOrderId: preview.sourceOrderId,
        candidateBidId: preview.candidateBidId, targetUserId, amountCents: preview.amountCents,
        reason, operationId, confirmed: true,
      } });
      setResult(changed); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a troca.'); }
    finally { setBusy(false); }
  }

  return <>
    <Button variant="outline" size="sm" onClick={() => {
      setOpen(true); setResult(null); setReason(''); setOperationId(crypto.randomUUID());
      void load(items.length === 1 ? items[0]?.id ?? '' : '');
    }}><UserRoundPen className="mr-1.5 h-4 w-4" />Trocar arrematante</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Trocar arrematante</DialogTitle>
          <DialogDescription>{result ? 'Troca concluída.' : 'Confira a carta e o maior lance válido anterior de outro cliente.'}</DialogDescription>
        </DialogHeader>
        {result ? <div className="space-y-4">
          <p>A carta foi transferida. Os demais itens foram preservados.</p>
          <p className="text-sm text-muted-foreground">Reenvie a cobrança atualizada em Pedidos de leilão → Cobrar no WhatsApp.</p>
          <Link to="/admin/orders/$orderId" params={{ orderId: result.targetOrderId }} className="font-semibold text-primary underline">Pedido de destino #{result.targetOrderId.slice(0, 8).toUpperCase()}</Link>
          <div><Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button></div>
        </div> : <div className="space-y-4">
          {items.length > 1 && <label className="block space-y-1 text-sm font-medium">Carta
            <select aria-label="Carta para trocar arrematante" value={itemId} disabled={busy} onChange={e => void load(e.target.value)} className="w-full rounded-md border border-border bg-background p-2 text-foreground">
              <option value="">Selecione a carta</option>{items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>}
          {busy && <p role="status" className="text-sm text-muted-foreground">Conferindo…</p>}
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
          {preview && <>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Carta</dt><dd className="font-semibold break-words">{preview.itemName}</dd></div>
              <div><dt className="text-muted-foreground">Arrematante atual</dt><dd>{preview.sourceName} · #{preview.sourceOrderId.slice(0, 8).toUpperCase()}</dd></div>
              <div><dt className="text-muted-foreground">Maior lance anterior</dt><dd className="font-semibold">{preview.candidateName} · {brl(preview.amountCents)}{preview.quantity > 1 ? ` × ${preview.quantity}` : ''}</dd></div>
            </dl>
            {preview.needsIdentification ? <div className="space-y-2">
              <p className="text-sm text-muted-foreground">O lance usa um código interno do WhatsApp. Selecione a conta confirmada desse arrematante.</p>
              <FinanceCustomerPicker onSelect={c => { setCustomer(c); setConfirmed(false); }} onClear={() => { setCustomer(null); setConfirmed(false); }} />
            </div> : <p className="text-sm">Conta identificada: <strong>{preview.matchedName}</strong></p>}
            <label className="block space-y-1 text-sm font-medium">Motivo da troca
              <textarea aria-label="Motivo da troca" value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} maxLength={500} rows={3} disabled={busy} className="w-full rounded-md border border-border bg-background p-2 text-foreground" />
            </label>
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} disabled={busy} onCheckedChange={v => setConfirmed(v === true)} className="mt-0.5" />
              <span>Confirmo a transferência somente desta carta para <strong>{preview.matchedName ?? customer?.full_name ?? preview.candidateName}</strong> por <strong>{brl(preview.amountCents * preview.quantity)}</strong>.</span>
            </label>
          </>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={busy || !preview || !(preview.matchedUserId ?? customer?.user_id) || !confirmed || reason.trim().length < 3} onClick={() => void save()}>Confirmar troca</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}