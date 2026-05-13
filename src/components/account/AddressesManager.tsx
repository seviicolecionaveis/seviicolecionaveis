import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, Star, Plus } from "lucide-react";

interface Address {
  id: string;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  label: string | null;
  is_default: boolean;
}

const empty = {
  recipient_name: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  label: "",
};

export function AddressesManager() {
  const { user } = useAuth();
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setList((data ?? []) as Address[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const isFirst = list.length === 0;
    const { error } = await supabase.from("addresses").insert({
      ...form,
      complement: form.complement || null,
      label: form.label || null,
      is_default: isFirst,
      user_id: user.id,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar endereço"); return; }
    toast.success("Endereço adicionado");
    setForm(empty);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este endereço?")) return;
    await supabase.from("addresses").delete().eq("id", id);
    load();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {list.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
      )}

      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold">{a.recipient_name}</p>
                {a.is_default && (
                  <span className="text-[10px] uppercase tracking-wide bg-foreground text-background px-2 py-0.5 rounded-full">
                    Padrão
                  </span>
                )}
                {a.label && <span className="text-xs text-muted-foreground">· {a.label}</span>}
              </div>
              <p className="text-muted-foreground">
                {a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ""}
              </p>
              <p className="text-muted-foreground">
                {a.neighborhood} · {a.city}/{a.state} · CEP {a.cep}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              {!a.is_default && (
                <button
                  onClick={() => setDefault(a.id)}
                  className="p-1.5 rounded-md hover:bg-secondary"
                  title="Definir como padrão"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => remove(a.id)}
                className="p-1.5 rounded-md hover:bg-secondary text-destructive"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          <Plus className="h-4 w-4" /> Adicionar endereço
        </button>
      ) : (
        <form onSubmit={create} className="rounded-xl border border-border p-4 space-y-3 max-w-xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Nome do destinatário" value={form.recipient_name}
              onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Apelido (Casa, Trabalho...)" value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="CEP" value={form.cep}
              onChange={(e) => setForm({ ...form, cep: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="Rua" value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="Número" value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Complemento" value={form.complement}
              onChange={(e) => setForm({ ...form, complement: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="Bairro" value={form.neighborhood}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="Cidade" value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="UF" maxLength={2} value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar endereço"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(empty); }}
              className="rounded-md border border-border px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
