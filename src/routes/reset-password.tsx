import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Sevii Colecionáveis" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // Supabase processa o token do hash automaticamente e emite PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (password.length < 6) { setErr("Senha deve ter ao menos 6 caracteres"); return; }
    if (password !== confirm) { setErr("As senhas não coincidem"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setInfo("Senha atualizada! Redirecionando...");
    setTimeout(() => nav({ to: "/" }), 1200);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/auth" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Voltar ao login
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Redefinir senha</h1>

        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
        ) : !hasSession ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link em "Esqueci minha senha".
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1">Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1">Confirmar nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
              />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {info && <p className="text-sm text-green-600">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-foreground text-background py-2.5 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
            >
              {loading ? "..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
