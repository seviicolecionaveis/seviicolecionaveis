import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  listCoupons,
  createBroadcastCoupon,
  createGiftVoucher,
  sendGiftVoucherEmail,
  setCouponActive,
  countBroadcastRecipients,
  previewCouponEmail,
  updateCoupon,
  incrementCouponMaxUses,
  getCouponUsage,
} from "@/utils/coupons.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({ meta: [{ title: "Cupons & vale-presentes — Admin" }] }),
  component: AdminCouponsPage,
});

type DiscountKind = "percent" | "amount";
type StatusFilter = "all" | "active" | "inactive" | "expired" | "exhausted";

interface CouponRow {
  id: string;
  code: string;
  percent: number | null;
  amount_cents: number | null;
  balance_cents: number | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  user_id: string | null;
  user_email: string | null;
  notes: string | null;
  created_at: string;
  last_email_status?: string | null;
  last_email_at?: string | null;
  last_email_error?: string | null;
}

function isWalletVoucher(c: CouponRow): boolean {
  return !!c.user_id && (c.amount_cents ?? 0) > 0 && c.balance_cents != null;
}

function fmtBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function emailStatusBadge(c: CouponRow): { label: string; tone: string; title?: string } | null {
  if (!c.user_id) return null;
  const s = c.last_email_status;
  if (!s) return { label: "não enviado", tone: "muted" };
  const when = c.last_email_at
    ? new Date(c.last_email_at).toLocaleString("pt-BR")
    : "";
  if (s === "sent") return { label: `enviado`, tone: "ok", title: when };
  if (s === "pending") return { label: "na fila", tone: "warn", title: when };
  if (s === "suppressed") return { label: "suprimido", tone: "warn", title: c.last_email_error ?? when };
  if (s === "bounced") return { label: "rejeitado", tone: "bad", title: c.last_email_error ?? when };
  if (s === "dlq" || s === "failed")
    return { label: "falhou", tone: "bad", title: c.last_email_error ?? when };
  return { label: s, tone: "muted", title: when };
}

function toIsoOrNull(date: string): string | null {
  if (!date) return null;
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

function couponStatus(c: CouponRow): {
  label: string;
  tone: "ok" | "muted" | "warn" | "bad";
} {
  if (!c.active) return { label: "inativo", tone: "muted" };
  if (c.expires_at && new Date(c.expires_at) < new Date())
    return { label: "expirado", tone: "bad" };
  if (isWalletVoucher(c)) {
    if ((c.balance_cents ?? 0) <= 0) return { label: "saldo esgotado", tone: "warn" };
    return { label: "ativo", tone: "ok" };
  }
  if (c.used_count >= c.max_uses) return { label: "esgotado", tone: "warn" };
  return { label: "ativo", tone: "ok" };
}

const toneCls: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  bad: "bg-red-500/15 text-red-700 dark:text-red-400",
};

interface PreviewState {
  open: boolean;
  html: string;
  subject: string;
  // For broadcast: confirm step after preview
  confirmBroadcast?: {
    recipients: number | null;
    typed: string;
    submitting: boolean;
  };
}

function AdminCouponsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const fetchCoupons = useServerFn(listCoupons);
  const createBroadcast = useServerFn(createBroadcastCoupon);
  const createVoucher = useServerFn(createGiftVoucher);
  const sendVoucher = useServerFn(sendGiftVoucherEmail);
  const toggleActive = useServerFn(setCouponActive);
  const countRecipients = useServerFn(countBroadcastRecipients);
  const previewEmail = useServerFn(previewCouponEmail);
  const editCoupon = useServerFn(updateCoupon);
  const bumpMaxUses = useServerFn(incrementCouponMaxUses);
  const fetchUsage = useServerFn(getCouponUsage);

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [usage, setUsage] = useState<{
    open: boolean;
    code: string;
    loading: boolean;
    rows: Array<{
      order_id: string;
      number: number | null;
      created_at: string;
      status: string | null;
      subtotal_cents: number | null;
      discount_cents: number | null;
      total_cents: number | null;
      user_email: string | null;
    }>;
  } | null>(null);

  const handleViewUsage = async (c: CouponRow) => {
    setUsage({ open: true, code: c.code, loading: true, rows: [] });
    try {
      const res: any = await fetchUsage({ data: { coupon_id: c.id } });
      setUsage({ open: true, code: c.code, loading: false, rows: res.rows ?? [] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar histórico.");
      setUsage(null);
    }
  };

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

  // --- Filtered list ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coupons.filter((c) => {
      if (q) {
        const hay = `${c.code} ${c.user_email ?? ""} ${c.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all") {
        const s = couponStatus(c);
        if (statusFilter === "active" && s.label !== "ativo") return false;
        if (statusFilter === "inactive" && s.label !== "inativo") return false;
        if (statusFilter === "expired" && s.label !== "expirado") return false;
        if (statusFilter === "exhausted" && s.label !== "esgotado") return false;
      }
      return true;
    });
  }, [coupons, search, statusFilter]);

  // --- Broadcast: open preview + confirmation flow ---
  const openBroadcastPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const percent = bKind === "percent" ? Number(bPercent) : null;
      const amount_cents =
        bKind === "amount"
          ? Math.round(Number(bAmount.replace(",", ".")) * 100)
          : null;
      const expires_at = toIsoOrNull(bExpires);
      const message = bMessage.trim() || null;
      const previewRes = await previewEmail({
        data: {
          kind: "broadcast",
          code: bCode,
          percent,
          amount_cents,
          expires_at,
          message,
        },
      });
      const r: any = previewRes;
      let recipients: number | null = null;
      if (bSendEmail) {
        try {
          const cr: any = await countRecipients();
          recipients = cr.count;
        } catch {
          recipients = null;
        }
      }
      setPreview({
        open: true,
        html: r.html,
        subject: r.subject,
        confirmBroadcast: {
          recipients,
          typed: "",
          submitting: false,
        },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar prévia.");
    } finally {
      setBusy(false);
    }
  };

  const confirmBroadcastSubmit = async () => {
    if (!preview?.confirmBroadcast) return;
    if (bSendEmail && preview.confirmBroadcast.typed !== "ENVIAR") return;
    setPreview({
      ...preview,
      confirmBroadcast: { ...preview.confirmBroadcast, submitting: true },
    });
    try {
      const res = await createBroadcast({
        data: {
          code: bCode,
          percent: bKind === "percent" ? Number(bPercent) : null,
          amount_cents:
            bKind === "amount"
              ? Math.round(Number(bAmount.replace(",", ".")) * 100)
              : null,
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
      setPreview(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cupom.");
      setPreview((p) =>
        p?.confirmBroadcast
          ? { ...p, confirmBroadcast: { ...p.confirmBroadcast, submitting: false } }
          : p,
      );
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
            vKind === "amount"
              ? Math.round(Number(vAmount.replace(",", ".")) * 100)
              : null,
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

  const previewVoucherForm = async () => {
    setBusy(true);
    try {
      const percent = vKind === "percent" ? Number(vPercent) : null;
      const amount_cents =
        vKind === "amount"
          ? Math.round(Number(vAmount.replace(",", ".")) * 100)
          : null;
      const res: any = await previewEmail({
        data: {
          kind: "voucher",
          code: vCode || "PREVIEW",
          percent,
          amount_cents,
          expires_at: toIsoOrNull(vExpires),
          recipient_email: vEmail || null,
        },
      });
      setPreview({ open: true, html: res.html, subject: res.subject });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar prévia.");
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

  const handleToggle = async (c: CouponRow) => {
    const next = !c.active;
    if (
      !confirm(
        next
          ? `Reativar o cupom ${c.code}?`
          : `Desativar o cupom ${c.code}? Ele deixa de funcionar imediatamente.`,
      )
    )
      return;
    try {
      await toggleActive({ data: { coupon_id: c.id, active: next } });
      setCoupons((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: next } : x)),
      );
      toast.success(next ? "Cupom reativado." : "Cupom desativado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Código ${code} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handlePreviewExisting = async (c: CouponRow) => {
    setBusy(true);
    try {
      const isVoucher = !!c.user_id;
      const res: any = await previewEmail({
        data: {
          kind: isVoucher ? "voucher" : "broadcast",
          code: c.code,
          percent: c.percent,
          amount_cents: c.amount_cents,
          expires_at: c.expires_at,
          message: c.notes,
          recipient_email: c.user_email,
        },
      });
      setPreview({ open: true, html: res.html, subject: res.subject });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar prévia.");
    } finally {
      setBusy(false);
    }
  };

  const handleBumpUses = async (c: CouponRow) => {
    const raw = prompt(
      `Quantos usos adicionar a ${c.code}? (atual: ${c.used_count}/${c.max_uses})`,
      "10",
    );
    if (!raw) return;
    const delta = Math.floor(Number(raw));
    if (!Number.isFinite(delta) || delta < 1) {
      toast.error("Informe um número positivo.");
      return;
    }
    try {
      const res: any = await bumpMaxUses({ data: { coupon_id: c.id, delta } });
      toast.success(`Limite aumentado para ${res.max_uses}.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aumentar usos.");
    }
  };

  const handleSaveEdit = async (patch: {
    code: string;
    percent: number | null;
    amount_cents: number | null;
    balance_cents: number | null;
    max_uses: number;
    expires_at: string | null;
    notes: string | null;
    active: boolean;
  }) => {
    if (!editing) return;
    try {
      await editCoupon({ data: { coupon_id: editing.id, ...patch } });
      toast.success("Cupom atualizado.");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
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
  const labelCls =
    "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            ← Admin
          </Link>
          <h1 className="text-sm font-bold uppercase tracking-widest">
            Cupons & vale-presentes
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        {/* ============ Broadcast ============ */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold mb-1">Cupom de divulgação</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cupom genérico que pode ser usado por qualquer cliente. Opcionalmente envia
            e-mail para todos os usuários cadastrados.
          </p>

          <form onSubmit={openBroadcastPreview} className="grid md:grid-cols-2 gap-4">
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
                {busy ? "..." : "Pré-visualizar e criar"}
              </button>
            </div>
          </form>
        </section>

        {/* ============ Voucher ============ */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold mb-1">Vale-presente exclusivo</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cupom de uso único vinculado a um cliente específico (por e-mail). Após criar,
            use o botão <strong>Enviar e-mail</strong> na lista abaixo.
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

            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={previewVoucherForm}
                disabled={busy}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-40"
              >
                Pré-visualizar e-mail
              </button>
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

        {/* ============ List ============ */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold">Cupons recentes</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, e-mail, nota..."
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="all">Todos status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="expired">Expirados</option>
                <option value="exhausted">Esgotados</option>
              </select>
              <span className="text-xs text-muted-foreground">
                {filtered.length}/{coupons.length}
              </span>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {coupons.length === 0
                ? "Nenhum cupom criado ainda."
                : "Nenhum cupom encontrado com esses filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Código</th>
                    <th className="text-left p-3">Desconto</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Usos</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Validade</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const s = couponStatus(c);
                    return (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="p-3 font-mono font-semibold whitespace-nowrap">
                          {c.code}
                          <div className="text-[10px] text-muted-foreground font-sans font-normal">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td className="p-3 tabular-nums">{fmtDiscount(c)}</td>
                        <td className="p-3">
                          {c.user_id ? (
                            <span className="text-xs">
                              🎁 vale-presente
                              <br />
                              <span className="text-muted-foreground">
                                {c.user_email ?? "—"}
                              </span>
                              {(() => {
                                const b = emailStatusBadge(c);
                                if (!b) return null;
                                return (
                                  <span
                                    title={b.title}
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneCls[b.tone]}`}
                                  >
                                    e-mail: {b.label}
                                  </span>
                                );
                              })()}
                            </span>
                          ) : (
                            <span className="text-xs">📣 divulgação</span>
                          )}
                        </td>
                        <td className="p-3 tabular-nums text-xs">
                          {isWalletVoucher(c) ? (
                            <span title="Saldo restante / valor inicial">
                              {fmtBRL(c.balance_cents ?? 0)}
                              <span className="text-muted-foreground">
                                {" "}/ {fmtBRL(c.amount_cents ?? 0)}
                              </span>
                            </span>
                          ) : (
                            <>
                              {c.used_count}/{c.max_uses}
                            </>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneCls[s.tone]}`}
                          >
                            {s.label}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {c.expires_at
                            ? new Date(c.expires_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-wrap gap-1.5 justify-end">
                            <button
                              onClick={() => handleCopy(c.code)}
                              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                              title="Copiar código"
                            >
                              Copiar
                            </button>
                            <button
                              onClick={() => handlePreviewExisting(c)}
                              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                              title="Ver prévia do e-mail"
                            >
                              Prévia
                            </button>
                            <button
                              onClick={() => handleViewUsage(c)}
                              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                              title="Ver pedidos onde foi usado"
                            >
                              Histórico
                            </button>
                            {c.user_id && (
                              <button
                                onClick={() => handleSend(c.id)}
                                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                                title="Enviar/reenviar o e-mail ao cliente"
                              >
                                {c.last_email_status ? "Reenviar e-mail" : "Enviar e-mail"}
                              </button>
                            )}
                            <button
                              onClick={() => setEditing(c)}
                              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                              title="Editar todos os campos"
                            >
                              Editar
                            </button>
                            {!isWalletVoucher(c) && (
                              <button
                                onClick={() => handleBumpUses(c)}
                                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                                title="Aumentar limite de usos"
                              >
                                + usos
                              </button>
                            )}
                            <button
                              onClick={() => handleToggle(c)}
                              className={`rounded-md border border-border px-2 py-1 text-[11px] font-semibold ${
                                c.active
                                  ? "bg-background hover:bg-red-500/10 text-red-700 dark:text-red-400"
                                  : "bg-background hover:bg-secondary"
                              }`}
                            >
                              {c.active ? "Desativar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>


      {/* ============ Preview / Confirm Modal ============ */}
      {preview?.open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() =>
            !preview.confirmBroadcast?.submitting && setPreview(null)
          }
        >
          <div
            className="bg-background rounded-xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Assunto
                </div>
                <div className="font-semibold text-sm">{preview.subject}</div>
              </div>
              <button
                onClick={() => setPreview(null)}
                disabled={preview.confirmBroadcast?.submitting}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-white">
              <iframe
                title="Prévia do e-mail"
                srcDoc={preview.html}
                className="w-full"
                style={{ height: "60vh", border: 0 }}
              />
            </div>

            {preview.confirmBroadcast && (
              <div className="p-4 border-t border-border space-y-3 bg-card">
                <div className="text-sm">
                  {bSendEmail ? (
                    <>
                      Vai criar o cupom <span className="font-mono font-bold">{bCode}</span>{" "}
                      <strong>e enviar este e-mail para</strong>{" "}
                      <span className="font-bold">
                        {preview.confirmBroadcast.recipients ?? "?"} destinatário
                        {preview.confirmBroadcast.recipients === 1 ? "" : "s"}
                      </span>
                      . Para confirmar, digite <code className="px-1 py-0.5 bg-muted rounded">ENVIAR</code> abaixo.
                    </>
                  ) : (
                    <>
                      Vai criar o cupom{" "}
                      <span className="font-mono font-bold">{bCode}</span> sem disparar
                      e-mail.
                    </>
                  )}
                </div>
                {bSendEmail && (
                  <input
                    value={preview.confirmBroadcast.typed}
                    onChange={(e) =>
                      setPreview({
                        ...preview,
                        confirmBroadcast: {
                          ...preview.confirmBroadcast!,
                          typed: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    placeholder="Digite ENVIAR"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPreview(null)}
                    disabled={preview.confirmBroadcast.submitting}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmBroadcastSubmit}
                    disabled={
                      preview.confirmBroadcast.submitting ||
                      (bSendEmail && preview.confirmBroadcast.typed !== "ENVIAR")
                    }
                    className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  >
                    {preview.confirmBroadcast.submitting
                      ? "Enviando..."
                      : bSendEmail
                        ? "Criar e disparar"
                        : "Criar cupom"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <EditCouponModal
          coupon={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  coupon: CouponRow;
  onCancel: () => void;
  onSave: (patch: {
    code: string;
    percent: number | null;
    amount_cents: number | null;
    balance_cents: number | null;
    max_uses: number;
    expires_at: string | null;
    notes: string | null;
    active: boolean;
  }) => void | Promise<void>;
}

function EditCouponModal({ coupon, onCancel, onSave }: EditModalProps) {
  const wallet = isWalletVoucher(coupon);
  const initialKind: DiscountKind = (coupon.amount_cents ?? 0) > 0 ? "amount" : "percent";
  const [code, setCode] = useState(coupon.code);
  const [kind, setKind] = useState<DiscountKind>(initialKind);
  const [percent, setPercent] = useState(coupon.percent ? String(coupon.percent) : "10");
  const [amount, setAmount] = useState(
    coupon.amount_cents ? (coupon.amount_cents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [balance, setBalance] = useState(
    coupon.balance_cents != null
      ? (coupon.balance_cents / 100).toFixed(2).replace(".", ",")
      : "",
  );
  const [maxUses, setMaxUses] = useState(String(coupon.max_uses));
  const [expires, setExpires] = useState(
    coupon.expires_at
      ? new Date(coupon.expires_at).toISOString().slice(0, 16)
      : "",
  );
  const [notes, setNotes] = useState(coupon.notes ?? "");
  const [active, setActive] = useState(coupon.active);
  const [saving, setSaving] = useState(false);

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  const labelCls =
    "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const amount_cents =
        kind === "amount"
          ? Math.round(Number(amount.replace(",", ".")) * 100)
          : null;
      const balance_cents =
        kind === "amount" && balance.trim()
          ? Math.round(Number(balance.replace(",", ".")) * 100)
          : kind === "amount"
            ? amount_cents
            : null;
      const expires_at = expires
        ? (() => {
            const d = new Date(expires);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })()
        : null;
      await onSave({
        code,
        percent: kind === "percent" ? Number(percent) : null,
        amount_cents,
        balance_cents,
        max_uses: Math.max(1, Number(maxUses) || 1),
        expires_at,
        notes: notes.trim() || null,
        active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !saving && onCancel()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-wider">
            Editar cupom {coupon.code}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Código</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9_\-]+"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>

          <div>
            <label className={labelCls}>Tipo</label>
            <div className="flex gap-4 text-sm pt-2">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={kind === "percent"}
                  onChange={() => setKind("percent")}
                />
                Percentual
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={kind === "amount"}
                  onChange={() => setKind("amount")}
                />
                Valor (R$)
              </label>
            </div>
          </div>

          {kind === "percent" ? (
            <div>
              <label className={labelCls}>Percentual (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Valor inicial (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              {wallet || coupon.user_id ? (
                <div>
                  <label className={labelCls}>Saldo atual (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="igual ao valor inicial"
                    className={inputCls}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Vale-presente carteira: cliente usa até o saldo zerar.
                  </p>
                </div>
              ) : null}
            </>
          )}

          {!wallet && (
            <div>
              <label className={labelCls}>Máx. de usos</label>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                required
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Usos atuais: {coupon.used_count}
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Validade</label>
            <input
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="edit-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            <label htmlFor="edit-active" className="text-sm">
              Cupom ativo
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
