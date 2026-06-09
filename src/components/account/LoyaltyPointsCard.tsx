import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyLoyaltyStatus } from "@/lib/loyalty.functions";
import { REASON_LABEL, formatPoints, POINTS_PER_REAL, CENTS_PER_REDEEM_BLOCK, POINTS_PER_REDEEM_BLOCK } from "@/lib/loyalty";
import { Sparkles, Gift, Cake, ShoppingBag, Minus, Settings, Undo2 } from "lucide-react";

export function LoyaltyPointsCard() {
  const fetchStatus = useServerFn(getMyLoyaltyStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-status"],
    queryFn: () => fetchStatus(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const balance = data?.balance ?? 0;
  const history = data?.history ?? [];
  const reaisEquivalent = (Math.floor(balance / POINTS_PER_REDEEM_BLOCK) * CENTS_PER_REDEEM_BLOCK) / 100;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-900/30 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
          <Sparkles className="h-4 w-4" /> Pontos Sevii
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tabular-nums">{formatPoints(balance)}</span>
          <span className="text-sm text-muted-foreground">pontos</span>
        </div>
        {balance >= POINTS_PER_REDEEM_BLOCK ? (
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
            Vale até <strong>R$ {reaisEquivalent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> de desconto no próximo pedido.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Faltam {POINTS_PER_REDEEM_BLOCK - balance} pontos para resgatar (mínimo {POINTS_PER_REDEEM_BLOCK} pts).
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Como funciona</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><ShoppingBag className="h-4 w-4 mt-0.5 shrink-0" /> Ganhe <strong className="text-foreground">{POINTS_PER_REAL} pontos por R$ 1,00</strong> em cada pedido pago.</li>
          <li className="flex gap-2"><Gift className="h-4 w-4 mt-0.5 shrink-0" /> {POINTS_PER_REDEEM_BLOCK} pontos = <strong className="text-foreground">R$ {(CENTS_PER_REDEEM_BLOCK / 100).toFixed(2)}</strong> de desconto.</li>
          <li className="flex gap-2"><Sparkles className="h-4 w-4 mt-0.5 shrink-0" /> Use no checkout em múltiplos de {POINTS_PER_REDEEM_BLOCK}.</li>
          <li className="flex gap-2"><Cake className="h-4 w-4 mt-0.5 shrink-0" /> 100 pontos extras no seu aniversário.</li>
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Histórico</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => {
              const Icon = h.reason === "birthday" ? Cake
                : h.reason === "signup" ? Gift
                : h.reason === "order_earned" ? ShoppingBag
                : h.reason === "order_redeemed" ? Minus
                : h.reason === "refund" ? Undo2
                : Settings;
              const positive = h.delta > 0;
              return (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate">{h.description ?? REASON_LABEL[h.reason as keyof typeof REASON_LABEL] ?? h.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <span className={`tabular-nums font-bold shrink-0 ${positive ? "text-green-600" : "text-red-600"}`}>
                    {positive ? "+" : ""}{h.delta}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
