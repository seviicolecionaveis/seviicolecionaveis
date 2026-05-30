import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  listCoupons,
  createBroadcastCoupon,
  createGiftVoucher,
  sendGiftVoucherEmail,
} from "@/utils/coupons.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({ meta: [{ title: "Cupons & vale-presentes — Admin" }] }),
  component: AdminCouponsPage,
});

type DiscountKind = "percent" | "amount";

interface CouponRow {
  id: string;
  code: string;
  percent: number | null;
  amount_cents: number | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  user_id: string | null;
  user_email: string | null;
  notes: string | null;
  created_at: string;
}

function toIsoOrNull(date: string): string | null {
  if (!date) return null;
  // datetime-local input: "2026-12-31T23:59"
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fmtDiscount(c: CouponRow) {
  if (c.amount_cents && c.amount_cents > 0)
    return `R$ ${(c.amount_cents / 100).toFixed(2).replace(".", ",")}`;
  if (c.percent && c.percent > 0) return `${c.percent}%`;
  return "—";
}

function AdminCouponsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const fetchCoupons = useServerFn(listCoupons);
  const createBroadcast = useServerFn(createBroadcastCoupon);
  const createVoucher = useServerFn(createGiftVoucher);
  const sendVoucher = useServerFn(sendGiftVoucherEmail);

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Broadcast form
  const [bCode, setBCode] = useState("");
  const [bKind, setBKind] = useState<DiscountKind>("percent");
  const [bPercent, setBPercent] = useState("10");
  const [bAmount, setBAmount] = useState("");
  const [bMaxUses, setBMaxUses] = useState("100");
  const [bExpires, setBExpires] = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bSendEmail, setBSendEmail] = useState(true);

  // Voucher form
  const [vCode, setVCode] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vKind, setVKind] = useState<DiscountKind>("amount");
  const [vPercent, setVPercent] = useState("10");
  const [vAmount, setVAmount] = useState("");
  const [vExpires, setVExpires] = useState("");
  const [vNotes, setVNotes] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(data as CouponRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar cupons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const submitBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createBroadcast({
        data: {
          code: bCode,
          percent: bKind === "percent" ? Number(bPercent) : null,
          amount_cents:
            bKind === "amount" ? Math.round(Number(bAmount.replace(",", ".")) * 100) : null,
          max_uses: Number(bMaxUses),
          expires_at: toIsoOrNull(bExpires),
          message: bMessage.trim() || null,
          send_email: bSendEmail,
        },
      });
      const r: any = res;
      toast.success(
        bSendEmail
          ? `Cupom criado. ${r.queued}/${r.recipients} e-mails enfileirados.`
          : "Cupom criado.",
      );
      setBCode("");
      setBMessage("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cupom.");
    } finally {
      setBusy(false);
    }
  };

  const submitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createVoucher({
        data: {
          code: vCode,
          email: vEmail,
          percent: vKind === "percent" ? Number(vPercent) : null,
          amount_cents:
            vKind === "amount" ? Math.round(Number(vAmount.replace(",", ".")) * 100) : null,
          expires_at: toIsoOrNull(vExpires),
          notes: vNotes.trim() || null,
        },
      });
      toast.success("Vale-presente criado.");
      setVCode("");
      setVEmail("");
      setVAmount("");
      setVNotes("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar vale-presente.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (couponId: string) => {
    if (!confirm("Enviar o e-mail do vale-presente para o cliente agora?")) return;
    try {
      await sendVoucher({ data: { coupon_id: couponId } });
      toast.success("E-mail enfileirado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar.");
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            ← Admin
          </Link>
          <h1 className="text-sm font-bold uppercase tracking-widest">Cupons & vale-presentes</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold mb-1">Cupom de divulgação</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cupom genérico que pode ser usado por qualquer cliente. Opcionalmente envia e-mail
            para todos os usuários cadastrados.
          </p>

          <form onSubmit={submitBroadcast} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código</label>
              <input
                value={bCode}
                onChange={(e) => setBCode(e.target.value.toUpperCase())}
                placeholder="SEVII10"
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9_\-]+"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>

            <div>
              <label className={labelCls}>Tipo de desconto</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={bKind === "percent"}
                    onChange={() => setBKind("percent")}
                  />
                  Percentual
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={bKind === "amount"}
                    onChange={() => setBKind("amount")}
                  />
                  Valor fixo (R$)
                </label>
              </div>
            </div>

            {bKind === "percent" ? (
              <div>
                <label className={labelCls}>Percentual (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bPercent}
                  onChange={(e) => setBPercent(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bAmount}
                  onChange={(e) => setBAmount(e.target.value)}
                  placeholder="22,05"
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Máx. de usos (total)</label>
              <input
                type="number"
                min={1}
                value={bMaxUses}
                onChange={(e) => setBMaxUses(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Validade (opcional)</label>
              <input
                type="datetime-local"
                value={bExpires}
                onChange={(e) => setBExpires(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Mensagem no e-mail (opcional)</label>
              <textarea
                value={bMessage}
                onChange={(e) => setBMessage(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ex.: Pra comemorar o aniversário da Sevii, liberamos um cupom novinho..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="b-send"
                type="checkbox"
                checked={bSendEmail}
                onChange={(e) => setBSendEmail(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              <label htmlFor="b-send" className="text-sm">
                Enviar e-mail automaticamente para todos os usuários cadastrados
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Criando..." : "Criar cupom"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold mb-1">Vale-presente exclusivo</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cupom de uso único vinculado a um cliente específico (por e-mail). Após criar, use o
            botão <strong>Enviar e-mail</strong> na lista abaixo.
          </p>

          <form onSubmit={submitVoucher} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código</label>
              <input
                value={vCode}
                onChange={(e) => setVCode(e.target.value.toUpperCase())}
                placeholder="MARIA50"
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9_\-]+"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>

            <div>
              <label className={labelCls}>E-mail do cliente</label>
              <input
                type="email"
                value={vEmail}
                onChange={(e) => setVEmail(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Tipo de desconto</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={vKind === "amount"}
                    onChange={() => setVKind("amount")}
                  />
                  Valor fixo (R$)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={vKind === "percent"}
                    onChange={() => setVKind("percent")}
                  />
                  Percentual
                </label>
              </div>
            </div>

            {vKind === "percent" ? (
              <div>
                <label className={labelCls}>Percentual (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={vPercent}
                  onChange={(e) => setVPercent(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vAmount}
                  onChange={(e) => setVAmount(e.target.value)}
                  placeholder="50,00"
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Validade (opcional)</label>
              <input
                type="datetime-local"
                value={vExpires}
                onChange={(e) => setVExpires(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Observação interna (opcional)</label>
              <input
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
                maxLength={500}
                placeholder="Ex.: Compensação pedido #ab12cd34"
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Criando..." : "Criar vale-presente"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">Cupons recentes</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cupom criado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Código</th>
                    <th className="text-left p-3">Desconto</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Usos</th>
                    <th className="text-left p-3">Validade</th>
                    <th className="text-left p-3">Criado</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-3 font-mono font-semibold">{c.code}</td>
                      <td className="p-3 tabular-nums">{fmtDiscount(c)}</td>
                      <td className="p-3">
                        {c.user_id ? (
                          <span className="text-xs">
                            🎁 vale-presente
                            <br />
                            <span className="text-muted-foreground">{c.user_email ?? "—"}</span>
                          </span>
                        ) : (
                          <span className="text-xs">📣 divulgação</span>
                        )}
                      </td>
                      <td className="p-3 tabular-nums text-xs">
                        {c.used_count}/{c.max_uses}
                      </td>
                      <td className="p-3 text-xs">
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 text-right">
                        {c.user_id && (
                          <button
                            onClick={() => handleSend(c.id)}
                            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                          >
                            Enviar e-mail
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
