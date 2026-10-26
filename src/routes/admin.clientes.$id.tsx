import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  getCustomerDetailFn,
  updateCustomerFn,
  upsertAddressFn,
  deleteAddressFn,
  setDefaultAddressFn,
  type CustomerDetail,
} from "@/lib/admin-customers.functions";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { Loader2, Plus, Trash2, Star, Pencil } from "lucide-react";
import { AddOrderToCustomer } from "@/components/admin/AddOrderToCustomer";

export const Route = createFileRoute("/admin/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — Admin" }] }),
  component: AdminClienteDetail,
});

type AddrForm = {
  id?: string;
  label: string;
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

const EMPTY_ADDR: AddrForm = {
  label: "", recipientName: "", cep: "", street: "", number: "",
  complement: "", neighborhood: "", city: "", state: "", isDefault: false,
};

function AdminClienteDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const fetchDetail = useServerFn(getCustomerDetailFn);
  const saveProfile = useServerFn(updateCustomerFn);
  const saveAddress = useServerFn(upsertAddressFn);
  const removeAddress = useServerFn(deleteAddressFn);
  const makeDefault = useServerFn(setDefaultAddressFn);

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({ fullName: "", cpf: "", phone: "", whatsapp: "", birthDate: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [addrOpen, setAddrOpen] = useState(false);
  const [addrForm, setAddrForm] = useState<AddrForm>(EMPTY_ADDR);
  const [addrBusy, setAddrBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await fetchDetail({ data: { userId: id } });
      setDetail(d);
      setForm({
        fullName: d.full_name ?? "",
        cpf: d.cpf ?? "",
        phone: d.phone ?? "",
        whatsapp: d.whatsapp ?? "",
        birthDate: d.birth_date ?? "",
        email: d.email ?? "",
      });
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar cliente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) window.location.href = "/auth";
    if (!authLoading && user && !isAdmin) window.location.href = "/";
  }, [authLoading, user, isAdmin]);

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveProfile({
        data: {
          userId: detail.user_id,
          fullName: form.fullName,
          cpf: form.cpf || null,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          birthDate: form.birthDate || null,
          email: form.email,
        },
      });
      setMsg({ kind: "ok", text: res.changes?.length ? `Alterado: ${res.changes.join(", ")}.` : "Nada mudou." });
      await load();
    } catch (e: any) {
      const text = e?.message ?? (await e?.text?.()) ?? "Erro ao salvar.";
      setMsg({ kind: "err", text: typeof text === "string" ? text : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setAddrBusy(true);
    setMsg(null);
    try {
      await saveAddress({
        data: {
          userId: detail.user_id,
          addressId: addrForm.id,
          label: addrForm.label || null,
          recipientName: addrForm.recipientName,
          cep: addrForm.cep,
          street: addrForm.street,
          number: addrForm.number,
          complement: addrForm.complement || null,
          neighborhood: addrForm.neighborhood,
          city: addrForm.city,
          state: addrForm.state,
          isDefault: addrForm.isDefault,
        },
      });
      setAddrOpen(false);
      setAddrForm(EMPTY_ADDR);
      await load();
    } catch (e: any) {
      const text = e?.message ?? "Erro ao salvar endereço.";
      setMsg({ kind: "err", text });
    } finally {
      setAddrBusy(false);
    }
  };

  const handleDeleteAddress = async (a: any) => {
    if (!confirm(`Excluir o endereço ${a.street}, ${a.number}?`)) return;
    try {
      await removeAddress({ data: { userId: detail!.user_id, addressId: a.id } });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Erro ao excluir endereço." });
    }
  };

  const handleSetDefault = async (a: any) => {
    try {
      await makeDefault({ data: { userId: detail!.user_id, addressId: a.id } });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Erro ao definir padrão." });
    }
  };

  if (authLoading || !isAdmin || loading) {
    return <div className="min-h-[60vh] grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (err || !detail) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-destructive">{err ?? "Cliente não encontrado."}</p>
        <Link to="/admin/clientes" className="text-sm underline mt-4 inline-block">← Voltar para clientes</Link>
      </main>
    );
  }

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; hint?: string }) => (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {opts?.hint && <span className="mt-1 block text-[11px] text-muted-foreground">{opts.hint}</span>}
    </label>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <Link to="/admin/clientes" className="text-xs text-muted-foreground hover:text-foreground">← Clientes</Link>
        <h1 className="text-2xl font-bold mt-1">{detail.full_name ?? "(sem nome)"}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.email ?? "sem e-mail"}
          {detail.email_confirmed ? "" : " · e-mail não confirmado"}
          {detail.last_sign_in_at ? ` · último acesso ${new Date(detail.last_sign_in_at).toLocaleDateString("pt-BR")}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pontos</p>
          <p className="text-lg font-bold">{detail.points_balance}</p>
          {detail.tier && <p className="text-xs text-muted-foreground">Nível {detail.tier}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saldo Sevii</p>
          <p className="text-lg font-bold">R$ {(detail.credit_balance_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pedidos</p>
          <p className="text-lg font-bold">{detail.orders.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cadastro</p>
          <p className="text-sm font-semibold">{detail.signup_at ? new Date(detail.signup_at).toLocaleDateString("pt-BR") : "—"}</p>
          {detail.whatsapp_linked && <p className="text-xs text-muted-foreground">WhatsApp vinculado</p>}
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-4">Dados do cliente</h2>
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Nome completo", "fullName")}
          {field("CPF", "cpf", { hint: "Somente dígitos." })}
          {field("Telefone", "phone")}
          {field("WhatsApp", "whatsapp")}
          {field("Nascimento", "birthDate", { type: "date" })}
          {field("E-mail (login)", "email", { type: "email", hint: "É o e-mail que o cliente usa para entrar no site. Alterar aqui já vale na hora." })}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide">Endereços</h2>
          <button
            type="button"
            onClick={() => { setAddrOpen(true); setAddrForm(EMPTY_ADDR); }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Novo endereço
          </button>
        </div>

        {detail.addresses.length === 0 && !addrOpen && (
          <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
        )}
        <div className="space-y-3">
          {detail.addresses.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {a.recipient_name || "(sem destinatário)"}
                  {a.is_default && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase">Padrão</span>}
                  {a.label && <span className="ml-2 text-muted-foreground font-normal">{a.label}</span>}
                </p>
                <div className="flex gap-2 shrink-0">
                  {!a.is_default && (
                    <button type="button" onClick={() => handleSetDefault(a)} className="text-muted-foreground hover:text-foreground" title="Definir como padrão">
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAddrOpen(true);
                      setAddrForm({
                        id: a.id, label: a.label ?? "", recipientName: a.recipient_name ?? "", cep: a.cep ?? "",
                        street: a.street ?? "", number: a.number ?? "", complement: a.complement ?? "",
                        neighborhood: a.neighborhood ?? "", city: a.city ?? "", state: a.state ?? "",
                        isDefault: a.is_default,
                      });
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDeleteAddress(a)} className="text-muted-foreground hover:text-destructive" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-muted-foreground mt-1">
                {a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ""} · {a.neighborhood} · {a.city}/{a.state} · CEP {a.cep}
              </p>
            </div>
          ))}
        </div>

        {addrOpen && (
          <form onSubmit={handleSaveAddress} className="mt-4 rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {addrForm.id ? "Editar endereço" : "Novo endereço"}
            </p>
            {([
              ["recipientName", "Destinatário"], ["cep", "CEP"], ["street", "Rua"], ["number", "Número"],
              ["complement", "Complemento (opcional)"], ["neighborhood", "Bairro"], ["city", "Cidade"], ["state", "UF"],
            ] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  value={(addrForm as any)[k]}
                  onChange={(e) => setAddrForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="text-xs text-muted-foreground">Apelido (opcional)</span>
              <input
                value={addrForm.label}
                onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={addrForm.isDefault}
                onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Definir como endereço padrão
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={addrBusy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {addrBusy ? "Salvando..." : "Salvar endereço"}
              </button>
              <button type="button" onClick={() => { setAddrOpen(false); setAddrForm(EMPTY_ADDR); }} className="rounded-md border border-border px-4 py-2 text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide">Pedidos</h2>
          <AddOrderToCustomer userId={id} customerName={detail.full_name ?? detail.email ?? "este cliente"} onDone={load} />
        </div>
        {detail.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <div className="divide-y divide-border">
            {detail.orders.map((o) => (
              <Link key={o.id} to="/admin/orders/$orderId" params={{ orderId: o.id }} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-secondary/50 px-2 -mx-2 rounded">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    {o.origin === "auction" ? " · Leilão" : o.origin === "manual" ? " · Manual" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular-nums">R$ {(o.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{ORDER_STATUS_LABELS[o.status] ?? o.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-4">Movimentação de pontos</h2>
        {detail.points_ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação.</p>
        ) : (
          <div className="divide-y divide-border">
            {detail.points_ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{l.description ?? l.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className={`font-semibold tabular-nums shrink-0 ${l.delta >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {l.delta >= 0 ? "+" : ""}{l.delta}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
