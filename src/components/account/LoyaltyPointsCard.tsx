import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyLoyaltyStatus } from "@/lib/loyalty.functions";
import {
  REASON_LABEL,
  formatPoints,
  POINTS_PER_REAL,
  CENTS_PER_REDEEM_BLOCK,
  POINTS_PER_REDEEM_BLOCK,
  EXPIRATION_MONTHS,
  TIERS,
  tierFromLifetime,
  nextTier,
  multiplierLabel,
  type LoyaltyTier,
} from "@/lib/loyalty";
import { Sparkles, Gift, Cake, ShoppingBag, Minus, Settings, Undo2, Trophy, Clock, Crown, Medal, Award, ArrowRight } from "lucide-react";

const TIER_VISUAL: Record<LoyaltyTier, { icon: typeof Trophy; bg: string; text: string; border: string; badgeBg: string }> = {
  bronze: { icon: Medal,  bg: "from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-orange-900/30", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300/60", badgeBg: "bg-amber-700/10 text-amber-800 dark:text-amber-200" },
  silver: { icon: Award,  bg: "from-slate-100 to-zinc-200 dark:from-slate-800/40 dark:to-zinc-900/40",     text: "text-slate-700 dark:text-slate-200", border: "border-slate-400/60", badgeBg: "bg-slate-500/15 text-slate-800 dark:text-slate-200" },
  gold:   { icon: Crown,  bg: "from-yellow-100 to-amber-200 dark:from-yellow-900/40 dark:to-amber-800/40", text: "text-yellow-800 dark:text-yellow-200", border: "border-yellow-500/60", badgeBg: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200" },
};

export function LoyaltyPointsCard({ onGoToProfile }: { onGoToProfile?: () => void }) {
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
  const lifetime = data?.lifetimeEarned ?? 0;
  const history = data?.history ?? [];
  const reaisEquivalent = (Math.floor(balance / POINTS_PER_REDEEM_BLOCK) * CENTS_PER_REDEEM_BLOCK) / 100;

  const tierKey = (data?.tier as LoyaltyTier) || tierFromLifetime(lifetime).key;
  const tierCfg = TIERS.find((t) => t.key === tierKey) ?? tierFromLifetime(lifetime);
  const visual = TIER_VISUAL[tierKey];
  const TierIcon = visual.icon;
  const next = nextTier(tierKey);
  const progressPct = next ? Math.min(100, Math.round(((lifetime - tierCfg.threshold) / (next.threshold - tierCfg.threshold)) * 100)) : 100;
  const missingToNext = next ? Math.max(0, next.threshold - lifetime) : 0;

  const expDate = data?.nextExpirationAt ? new Date(data.nextExpirationAt) : null;
  const hasBirthDate = !!data?.birthDate;

  return (
    <div className="space-y-4">
      {/* Saldo + Tier */}
      <div className={`rounded-xl border ${visual.border} bg-gradient-to-br ${visual.bg} p-6 shadow-sm`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${visual.text}`}>
              <Sparkles className="h-4 w-4" /> Pontos Sevii
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tabular-nums">{formatPoints(balance)}</span>
              <span className="text-sm text-muted-foreground">pontos</span>
            </div>
            {balance >= POINTS_PER_REDEEM_BLOCK ? (
              <p className={`mt-1 text-sm ${visual.text}`}>
                Vale até <strong>R$ {reaisEquivalent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> no próximo pedido.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Faltam {POINTS_PER_REDEEM_BLOCK - balance} pontos para resgatar (mínimo {POINTS_PER_REDEEM_BLOCK} pts).
              </p>
            )}
          </div>

          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${visual.badgeBg}`}>
            <TierIcon className="h-4 w-4" />
            {tierCfg.label} · {multiplierLabel(tierCfg.multiplierBp)}
          </div>
        </div>

        {/* Progresso para próximo tier */}
        {next ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {formatPoints(lifetime)} / {formatPoints(next.threshold)} pts para <strong>{next.label}</strong>
              </span>
              <span className="text-muted-foreground">{progressPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-foreground/10 overflow-hidden">
              <div className="h-full bg-foreground/70 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Faltam <strong>{formatPoints(missingToNext)}</strong> pontos para virar {next.label} ({multiplierLabel(next.multiplierBp)} pontos por R$).
            </p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Você está no nível máximo. Ganha sempre {multiplierLabel(tierCfg.multiplierBp)} pontos.
          </p>
        )}

        {/* Expiração */}
        {expDate && balance > 0 && (
          <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Primeiros pontos vencem em{" "}
            <strong>
              {expDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </strong>
            .
          </p>
        )}
      </div>

      {/* Incentivo aniversário */}
      {!hasBirthDate && (
        <div className="rounded-xl border border-pink-300/60 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 p-5 flex items-start gap-4">
          <div className="rounded-full bg-pink-100 dark:bg-pink-900/40 p-2.5 shrink-0">
            <Cake className="h-5 w-5 text-pink-600 dark:text-pink-300" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-pink-800 dark:text-pink-200">Cadastre sua data de nascimento</h4>
            <p className="mt-1 text-sm text-pink-700/80 dark:text-pink-300/80">
              No dia do seu aniversário você ganha <strong className="text-pink-800 dark:text-pink-200">100 pontos</strong> de presente! 🎂
            </p>
            {onGoToProfile && (
              <button
                onClick={onGoToProfile}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-700 transition"
              >
                Cadastrar agora <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Como funciona */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Como funciona</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><ShoppingBag className="h-4 w-4 mt-0.5 shrink-0" /> Ganhe <strong className="text-foreground">1 ponto a cada R$ {REAIS_PER_POINT},00</strong> em cada pedido pago (× multiplicador do seu nível).</li>
          <li className="flex gap-2"><Gift className="h-4 w-4 mt-0.5 shrink-0" /> {POINTS_PER_REDEEM_BLOCK} pontos = <strong className="text-foreground">R$ {(CENTS_PER_REDEEM_BLOCK / 100).toFixed(2)}</strong> de desconto.</li>
          <li className="flex gap-2"><Sparkles className="h-4 w-4 mt-0.5 shrink-0" /> Use no checkout em múltiplos de {POINTS_PER_REDEEM_BLOCK}.</li>
          <li className="flex gap-2"><Cake className="h-4 w-4 mt-0.5 shrink-0" /> 100 pontos extras no seu aniversário.</li>
          <li className="flex gap-2"><Clock className="h-4 w-4 mt-0.5 shrink-0" /> Pontos expiram após <strong className="text-foreground">{EXPIRATION_MONTHS} meses</strong>.</li>
        </ul>
      </div>

      {/* Níveis */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy className="h-4 w-4" /> Níveis</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {TIERS.map((t) => {
            const v = TIER_VISUAL[t.key];
            const Icon = v.icon;
            const isCurrent = t.key === tierKey;
            return (
              <div key={t.key} className={`rounded-lg border p-3 ${isCurrent ? `${v.border} bg-gradient-to-br ${v.bg}` : "border-border"}`}>
                <div className="flex items-center gap-2 font-bold">
                  <Icon className="h-4 w-4" /> {t.label}
                  {isCurrent && <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Atual</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  A partir de {formatPoints(t.threshold)} pts acumulados
                </div>
                <div className="mt-1 text-xs font-semibold">
                  Ganha {multiplierLabel(t.multiplierBp)} pontos por R$
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico */}
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
                : h.reason === "expiration" ? Clock
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
