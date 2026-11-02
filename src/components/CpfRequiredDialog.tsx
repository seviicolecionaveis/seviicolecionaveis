import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { validCpf } from "@/lib/customer-payment";

const SKIP_PATHS = ["/auth", "/reset-password"];

function mask(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Pede o CPF a qualquer cliente logado que ainda não tenha cadastrado. */
export function CpfRequiredDialog() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [missing, setMissing] = useState(false);
  const [cpf, setCpf] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setMissing(false);
    if (!user || user.email?.endsWith("@whatsapp.seviicolecionaveis.com.br")) return;
    supabase.from("profiles").select("cpf").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (alive && data && !validCpf(data.cpf)) setMissing(true);
    });
    return () => { alive = false; };
  }, [user?.id]);

  if (!missing || SKIP_PATHS.some((p) => pathname.startsWith(p))) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = validCpf(cpf);
    if (!clean) return setErr("Informe um CPF válido.");
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("profiles").update({ cpf: clean }).eq("user_id", user!.id);
    setSaving(false);
    if (error) return setErr(error.message?.includes("CPF") ? error.message : "Não foi possível salvar. Tente novamente.");
    setMissing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-foreground/50 px-4">
      <form onSubmit={save} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-bold">Complete seu cadastro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para continuar usando o site e gerar pagamentos, informe o CPF do titular da conta.
        </p>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide mb-1">CPF</label>
        <input
          required
          autoFocus
          inputMode="numeric"
          value={cpf}
          onChange={(e) => setCpf(mask(e.target.value))}
          placeholder="000.000.000-00"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
        />
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 w-full rounded-md bg-foreground text-background py-2.5 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
        >
          {saving ? "..." : "Salvar CPF"}
        </button>
      </form>
    </div>
  );
}
