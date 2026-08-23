import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Ticket, Trash2 } from "lucide-react";
import {
  adminCreateRaffle,
  adminDeleteRaffle,
  adminExtendWinnerDeadline,
  adminGetRaffle,
  adminListRaffles,
  adminRunDraw,
  adminSetRaffleStatus,
  adminSetWinnerStatus,
  adminUpdateRaffle,
} from "@/lib/raffles.functions";

export const Route = createFileRoute("/admin/sorteios")({
  head: () => ({ meta: [{ title: "Sorteios — Admin" }] }),
  component: AdminRafflesPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  open: "Inscrições abertas",
  closed: "Inscrições encerradas",
  drawn: "Sorteio realizado",
  payment: "Pagamento em andamento",
  finished: "Finalizado",
};

const WINNER_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  expired: "Reserva expirada",
  cancelled: "Cancelado",
};

const PRODUCT_TYPES = [
  { value: "sealed", label: "Produto lacrado" },
  { value: "card", label: "Carta" },
  { value: "accessory", label: "Acessório" },
  { value: "panel", label: "Painel" },
  { value: "videogame", label: "Videogame" },
  { value: "custom", label: "Outro / avulso" },
];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const emptyForm = () => ({
  title: "",
  product_type: "sealed",
  product_id: "",
  product_name: "",
  product_image: "",
  product_price: "0",
  units: "1",
  entry_limit_per_user: "1",
  opens_at: toLocalInput(new Date()),
  closes_at: toLocalInput(new Date(Date.now() + 7 * 86400_000)),
  draw_at: toLocalInput(new Date(Date.now() + 7 * 86400_000 + 3600_000)),
  payment_deadline_hours: "48",
  rules: "",
});

function AdminRafflesPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(adminListRaffles);
  const getDetail = useServerFn(adminGetRaffle);
  const create = useServerFn(adminCreateRaffle);
  const update = useServerFn(adminUpdateRaffle);
  const setStatus = useServerFn(adminSetRaffleStatus);
  const remove = useServerFn(adminDeleteRaffle);
  const runDraw = useServerFn(adminRunDraw);
  const setWinner = useServerFn(adminSetWinnerStatus);
  const extend = useServerFn(adminExtendWinnerDeadline);

  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [drawUnits, setDrawUnits] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const reload = useCallback(async () => {
    const res = await list({});
    setRaffles(res.raffles ?? []);
    setLoading(false);
  }, [list]);

  const loadDetail = useCallback(
    async (id: string) => {
      const d = await getDetail({ data: { raffleId: id } });
      setDetail(d);
    },
    [getDetail],
  );

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  const payload = () => ({
    title: form.title.trim(),
    product_type: form.product_type,
    product_id: form.product_id.trim() || null,
    product_name: form.product_name.trim(),
    product_image: form.product_image.trim() || null,
    product_price_cents: Math.round(Number(form.product_price.replace(",", ".") || 0) * 100),
    units: Number(form.units || 1),
    entry_limit_per_user: Number(form.entry_limit_per_user || 1),
    opens_at: new Date(form.opens_at).toISOString(),
    closes_at: new Date(form.closes_at).toISOString(),
    draw_at: form.draw_at ? new Date(form.draw_at).toISOString() : null,
    payment_deadline_hours: Number(form.payment_deadline_hours || 48),
    rules: form.rules.trim() || null,
  });

  const handleSave = async () => {
    if (!form.title.trim() || !form.product_name.trim()) {
      toast.error("Informe o título e o produto.");
      return;
    }
    if (new Date(form.closes_at) <= new Date(form.opens_at)) {
      toast.error("O encerramento deve ser depois do início.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await update({ data: { raffleId: editingId, input: payload() } });
        toast.success("Sorteio atualizado.");
      } else {
        await create({ data: payload() });
        toast.success("Sorteio criado como rascunho.");
      }
      setForm(emptyForm());
      setEditingId(null);
      await reload();
    } catch (e: any) {
      toast.error(typeof e?.message === "string" ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await reload();
      if (selected) await loadDetail(selected);
    } catch (e: any) {
      toast.error(typeof e?.message === "string" ? e.message : "Falha na operação.");
    }
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      product_type: r.product_type,
      product_id: r.product_id ?? "",
      product_name: r.product_name,
      product_image: r.product_image ?? "",
      product_price: String((r.product_price_cents ?? 0) / 100),
      units: String(r.units),
      entry_limit_per_user: String(r.entry_limit_per_user),
      opens_at: toLocalInput(new Date(r.opens_at)),
      closes_at: toLocalInput(new Date(r.closes_at)),
      draw_at: r.draw_at ? toLocalInput(new Date(r.draw_at)) : "",
      payment_deadline_hours: String(r.payment_deadline_hours),
      rules: r.rules ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
            <Ticket className="h-4 w-4" /> Sorteios
          </h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Pedidos</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-bold">{editingId ? "Editar sorteio (rascunho)" : "Criar sorteio"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sorteio Booster Box XYZ" />
            </div>
            <div>
              <Label>Tipo de produto</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>ID do produto (opcional)</Label>
              <Input value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} placeholder="uuid do produto cadastrado" />
            </div>
            <div>
              <Label>Nome do produto *</Label>
              <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div>
              <Label>Imagem (URL)</Label>
              <Input value={form.product_image} onChange={(e) => setForm({ ...form, product_image: e.target.value })} />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input value={form.product_price} onChange={(e) => setForm({ ...form, product_price: e.target.value })} />
            </div>
            <div>
              <Label>Unidades disponíveis *</Label>
              <Input type="number" min={1} value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
            </div>
            <div>
              <Label>Limite de participação por cliente</Label>
              <Input type="number" min={1} value={form.entry_limit_per_user} onChange={(e) => setForm({ ...form, entry_limit_per_user: e.target.value })} />
            </div>
            <div>
              <Label>Prazo de pagamento (horas)</Label>
              <Input type="number" min={1} value={form.payment_deadline_hours} onChange={(e) => setForm({ ...form, payment_deadline_hours: e.target.value })} />
            </div>
            <div>
              <Label>Início das inscrições *</Label>
              <Input type="datetime-local" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
            </div>
            <div>
              <Label>Encerramento das inscrições *</Label>
              <Input type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
            </div>
            <div>
              <Label>Data prevista do sorteio</Label>
              <Input type="datetime-local" value={form.draw_at} onChange={(e) => setForm({ ...form, draw_at: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Regras</Label>
              <Textarea rows={4} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar sorteio"}</Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>Cancelar</Button>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Sorteios ({raffles.length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : raffles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum sorteio criado.</p>
          ) : (
            <div className="space-y-3">
              {raffles.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.product_name} · {r.units} {r.units === 1 ? "unidade" : "unidades"} · limite {r.entry_limit_per_user}/cliente
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inscrições {fmt(r.opens_at)} → {fmt(r.closes_at)} · sorteio previsto {fmt(r.draw_at)}
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold uppercase tracking-wide">
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>{" "}
                        · {r.stats?.participants ?? 0} participantes ({r.stats?.entries ?? 0} inscrições) · {r.stats?.winners ?? 0} vencedores ativos ·{" "}
                        {r.stats?.paid ?? 0} pagos · {r.stats?.expired ?? 0} expirados/cancelados
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Editar</Button>
                          <Button size="sm" onClick={() => act(() => setStatus({ data: { raffleId: r.id, status: "open" } }), "Inscrições abertas.")}>Abrir inscrições</Button>
                        </>
                      )}
                      {r.status === "open" && (
                        <Button size="sm" onClick={() => act(() => setStatus({ data: { raffleId: r.id, status: "closed" } }), "Inscrições encerradas.")}>Encerrar inscrições</Button>
                      )}
                      {["closed", "drawn", "payment"].includes(r.status) && (
                        <Button size="sm" onClick={() => act(async () => {
                          const res = await runDraw({ data: { raffleId: r.id, units: null } });
                          if (!res.success) throw new Error(res.error);
                        }, "Sorteio realizado.")}>Realizar sorteio</Button>
                      )}
                      {r.status !== "finished" && r.status !== "draft" && (
                        <Button size="sm" variant="outline" onClick={() => act(() => setStatus({ data: { raffleId: r.id, status: "finished" } }), "Sorteio finalizado.")}>Encerrar definitivamente</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setSelected(selected === r.id ? null : r.id)}>
                        {selected === r.id ? "Ocultar" : "Detalhes"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Excluir este sorteio e todas as participações?")) void act(() => remove({ data: { raffleId: r.id } }), "Sorteio excluído.");
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {selected === r.id && detail && (
                    <div className="mt-4 space-y-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Unidades ainda disponíveis: {detail.unitsAvailable}
                      </p>

                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-xs">Sortear apenas N unidades (ex.: não pagas)</Label>
                          <Input className="w-40" type="number" min={1} value={drawUnits} onChange={(e) => setDrawUnits(e.target.value)} placeholder="todas" />
                        </div>
                        <Button size="sm" onClick={() => act(async () => {
                          const res = await runDraw({ data: { raffleId: r.id, units: drawUnits ? Number(drawUnits) : null } });
                          if (!res.success) throw new Error(res.error);
                        }, "Novo sorteio realizado.")}>Novo sorteio das unidades livres</Button>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-bold">Vencedores ({detail.winners.length})</h3>
                        {detail.winners.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum sorteio realizado ainda.</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.winners.map((w: any) => (
                              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
                                <div>
                                  <p className="font-semibold">{w.user?.full_name || w.user?.email || w.user_id}</p>
                                  <p className="text-muted-foreground">
                                    {w.user?.email} · código {w.entry_code} · rodada {w.round} · {WINNER_LABEL[w.status] ?? w.status}
                                    {w.reserved_until ? ` · reserva até ${fmt(w.reserved_until)}` : ""}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {w.status === "pending_payment" && (
                                    <>
                                      <Button size="sm" onClick={() => act(() => setWinner({ data: { winnerId: w.id, status: "paid", notes: null } }), "Marcado como pago.")}>Marcar pago</Button>
                                      <Button size="sm" variant="outline" onClick={() => act(() => extend({ data: { winnerId: w.id, hours: 24 } }), "Prazo estendido em 24h.")}>+24h</Button>
                                      <Button size="sm" variant="outline" onClick={() => act(() => setWinner({ data: { winnerId: w.id, status: "expired", notes: null } }), "Reserva expirada.")}>Expirar</Button>
                                    </>
                                  )}
                                  {w.status !== "pending_payment" && w.status !== "paid" && (
                                    <Button size="sm" variant="outline" onClick={() => act(() => extend({ data: { winnerId: w.id, hours: 48 } }), "Reserva reaberta.")}>Reabrir 48h</Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-bold">Participantes ({detail.entries.length})</h3>
                        <div className="max-h-72 overflow-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-secondary">
                              <tr>
                                <th className="p-2 text-left">Cliente</th>
                                <th className="p-2 text-left">E-mail</th>
                                <th className="p-2 text-left">Código</th>
                                <th className="p-2 text-left">Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.entries.map((e: any) => (
                                <tr key={e.id} className="border-t border-border">
                                  <td className="p-2">{e.user?.full_name || "—"}</td>
                                  <td className="p-2">{e.user?.email || "—"}</td>
                                  <td className="p-2 font-mono">{e.entry_code}</td>
                                  <td className="p-2">{fmt(e.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-bold">Log de ações administrativas</h3>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {detail.logs.map((l: any) => (
                            <li key={l.id}>{fmt(l.created_at)} · {l.action} · {JSON.stringify(l.details)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
