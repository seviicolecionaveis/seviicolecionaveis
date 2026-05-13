import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function maskWhatsapp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function PersonalDataForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, whatsapp, birth_date, cpf")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setWhatsapp(data.whatsapp ?? "");
          setBirthDate(data.birth_date ?? "");
          setCpf(data.cpf ?? "");
        }
        setLoading(false);
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        whatsapp: whatsapp || null,
        birth_date: birthDate || null,
        cpf: cpf || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Dados atualizados");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPwdSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada");
      setPwd("");
      setShowPwd(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide mb-1">Nome completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide mb-1">E-mail</label>
          <input
            value={user?.email ?? ""}
            disabled
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1">WhatsApp</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1">Data de nascimento</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide mb-1">CPF</label>
          <input
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-foreground text-background px-5 py-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar dados"}
        </button>
      </form>

      <div className="border-t border-border pt-6 max-w-xl">
        <h3 className="text-sm font-semibold mb-3">Segurança</h3>
        {!showPwd ? (
          <button
            onClick={() => setShowPwd(true)}
            className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary"
          >
            Alterar senha
          </button>
        ) : (
          <form onSubmit={changePassword} className="space-y-3">
            <input
              type="password"
              minLength={6}
              required
              placeholder="Nova senha"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pwdSaving}
                className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {pwdSaving ? "..." : "Salvar nova senha"}
              </button>
              <button
                type="button"
                onClick={() => { setShowPwd(false); setPwd(""); }}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
