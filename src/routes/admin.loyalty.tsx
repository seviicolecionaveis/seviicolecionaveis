import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  adminSearchLoyaltyUsers,
  adminGetUserLoyaltyDetail,
  adminAdjustUserPoints,
  adminGetLoyaltyStats,
} from "@/lib/admin-loyalty.functions";
import { formatPoints, REASON_LABEL, TIERS, multiplierLabel, type LoyaltyReason } from "@/lib/loyalty";

export const Route = createFileRoute("/admin/loyalty")({
  head: () => ({ meta: [{ title: "Pontos / Fidelidade — Admin" }] }),
  component: AdminLoyaltyPage,
});

interface UserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  birth_date: string | null;
  balance: number;
  lifetime_earned: number;
  tier: string;
  multiplier_bp: number;
}

interface Detail extends UserRow {
  whatsapp: string | null;
  history: {
    id: string;
    delta: number;
    reason: string;
    description: string | null;
    order_id: string | null;
    created_at: string;
  }[];
}

interface Stats {
  totalOutstanding: number;
  usersWithPoints: number;
  totalAwarded: number;
  totalRedeemed: number;
  totalExpired: number;
  totalAdjusted: number;
  totalLedgerEntries: number;
}

function tierLabel(key: string) {
  return TIERS.find((t) => t.key === key)?.label ?? key;
}

function AdminLoyaltyPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const searchFn = useServerFn(adminSearchLoyaltyUsers);
  const detailFn = useServerFn(adminGetUserLoyaltyDetail);
  const adjustFn = useServerFn(adminAdjustUserPoints);
  const statsFn = useServerFn(adminGetLoyaltyStats);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustDirection, setAdjustDirection] = useState<"add" | "remove">("add");
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  useEffect(() => {
    if (isAdmin) {
      statsFn().then(setStats).catch(() => {});
    }
  }, [isAdmin, statsFn]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setMsg(null);
    try {
      const data = await searchFn({ data: { query: query.trim() } });
      setResults(data);
      if (data.length === 0) setMsg({ kind: "err", text: "Nenhum usuário encontrado." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message || "Erro ao buscar." });
    } finally {
      setSearching(false);
    }
  };

  const openDetail = async (uid: string) => {
    setLoadingDetail(true);
    setDetail(null);
    setMsg(null);
    setAdjustDelta("");
    setAdjustReason("");
    setAdjustDirection("add");
    try {
      const d = await detailFn({ data: { user_id: uid } });
      setDetail(d as Detail);
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message || "Erro ao carregar detalhes." });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const amount = parseInt(adjustDelta, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg({ kind: "err", text: "Informe uma quantidade válida (inteiro positivo)." });
      return;
    }
    const delta = adjustDirection === "add" ? amount : -amount;
    if (!confirm(`Confirma ${adjustDirection === "add" ? "creditar" : "debitar"} ${formatPoints(amount)} pontos para ${detail.email ?? detail.user_id}?`)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await adjustFn({ data: { user_id: detail.user_id, delta, description: adjustReason } });
      setMsg({ kind: "ok", text: "Ajuste registrado." });
      setAdjustDelta("");
      setAdjustReason("");
      await openDetail(detail.user_id);
      // Refresh row in list
      setResults((curr) =>
        curr.map((r) => (r.user_id === detail.user_id ? { ...r, balance: r.balance + delta } : r)),
      );
      statsFn().then(setStats).catch(() => {});
    } catch (e: any) {
      const text = e?.message || (await e?.text?.()) || "Erro ao ajustar pontos.";
      setMsg({ kind: "err", text: typeof text === "string" ? text : "Erro ao ajustar pontos." });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            Sevii · Admin
          </Link>
          <div className="flex gap-3 text-xs">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              Pedidos
            </Link>
            <Link to="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pontos / Fidelidade</h1>
          <p className="text-sm text-muted-foreground">
            Consulte o saldo de clientes e faça ajustes manuais (suporte, estornos, brindes).
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Pontos em circulação" value={formatPoints(stats.totalOutstanding)} />
            <StatCard label="Clientes com pontos" value={formatPoints(stats.usersWithPoints)} />
            <StatCard label="Total ganho (histórico)" value={formatPoints(stats.totalAwarded)} />
            <StatCard label="Total resgatado" value={formatPoints(stats.totalRedeemed)} />
            <StatCard label="Total expirado" value={formatPoints(stats.totalExpired)} />
            <StatCard
              label="Ajustes manuais (líquido)"
              value={(stats.totalAdjusted >= 0 ? "+" : "") + formatPoints(stats.totalAdjusted)}
            />
            <StatCard label="Entradas no histórico" value={formatPoints(stats.totalLedgerEntries)} />
          </div>
        )}

        <form onSubmit={handleSearch} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide">
            Buscar cliente por e-mail ou nome
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: maria@exemplo.com ou Maria Silva"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {searching ? "..." : "Buscar"}
            </button>
          </div>
          {msg && !detail && (
            <p className={`text-xs ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
              {msg.text}
            </p>
          )}
        </form>

        {results.length > 0 && !detail && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide">
              Resultados ({results.length})
            </div>
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.full_name || "(sem nome)"}{" "}
                      <span className="text-xs text-muted-foreground">{r.email ?? "(sem e-mail)"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: <strong>{formatPoints(r.balance)} pts</strong> · Tier:{" "}
                      <strong>{tierLabel(r.tier)}</strong> ({multiplierLabel(r.multiplier_bp)}) ·
                      Vida toda: {formatPoints(r.lifetime_earned)}
                    </p>
                  </div>
                  <button
                    onClick={() => openDetail(r.user_id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadingDetail && (
          <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
        )}

        {detail && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{detail.full_name || "(sem nome)"}</h2>
                <p className="text-xs text-muted-foreground">{detail.email ?? "(sem e-mail)"}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{detail.user_id}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Voltar à lista
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Saldo atual" value={formatPoints(detail.balance)} />
              <StatCard label="Ganho na vida toda" value={formatPoints(detail.lifetime_earned)} />
              <StatCard
                label="Tier"
                value={`${tierLabel(detail.tier)} (${multiplierLabel(detail.multiplier_bp)})`}
              />
              <StatCard
                label="Aniversário"
                value={detail.birth_date ? new Date(detail.birth_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
              />
            </div>

            <form onSubmit={handleAdjust} className="rounded-lg border border-border bg-background p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Ajuste manual</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={adjustDirection}
                  onChange={(e) => setAdjustDirection(e.target.value as "add" | "remove")}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="add">Creditar (+)</option>
                  <option value="remove">Debitar (−)</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="Quantidade de pontos"
                  className="flex-1 min-w-[160px] rounded-md border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Motivo (ex: brinde, estorno parcial, suporte)"
                maxLength={500}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Aplicando..." : "Aplicar ajuste"}
                </button>
                {msg && (
                  <p className={`text-xs ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
                    {msg.text}
                  </p>
                )}
              </div>
            </form>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2">
                Histórico ({detail.history.length})
              </p>
              {detail.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem movimentações.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 py-2">Data</th>
                        <th className="text-left px-3 py-2">Motivo</th>
                        <th className="text-left px-3 py-2">Descrição</th>
                        <th className="text-right px-3 py-2">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.history.map((h) => (
                        <tr key={h.id}>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {REASON_LABEL[h.reason as LoyaltyReason] ?? h.reason}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {h.description ?? "—"}
                            {h.order_id && (
                              <Link
                                to="/admin/orders/$orderId"
                                params={{ orderId: h.order_id }}
                                className="ml-2 text-foreground underline"
                              >
                                pedido
                              </Link>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono tabular-nums ${
                              h.delta >= 0 ? "text-green-600" : "text-destructive"
                            }`}
                          >
                            {h.delta >= 0 ? "+" : ""}
                            {formatPoints(h.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}
