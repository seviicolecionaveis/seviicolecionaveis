import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { listAdmins, grantAdmin, revokeAdmin } from "@/utils/admins.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Administradores — Admin" }] }),
  component: AdminUsersPage,
});

interface AdminRow {
  user_id: string;
  email: string | null;
  created_at: string;
}

function AdminUsersPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const fetchAdmins = useServerFn(listAdmins);
  const grant = useServerFn(grantAdmin);
  const revoke = useServerFn(revokeAdmin);

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdmins();
      setAdmins(data as AdminRow[]);
    } catch (e: any) {
      setMsg({ kind: "err", text: "Falha ao carregar administradores." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await grant({ data: { email: email.trim() } });
      setMsg({ kind: "ok", text: `${email} agora é admin.` });
      setEmail("");
      await load();
    } catch (e: any) {
      const text = e?.message || (await e?.text?.()) || "Erro ao conceder admin.";
      setMsg({ kind: "err", text: typeof text === "string" ? text : "Erro ao conceder admin." });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (uid: string, mail: string | null) => {
    if (!confirm(`Remover acesso admin de ${mail ?? uid}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await revoke({ data: { user_id: uid } });
      setMsg({ kind: "ok", text: "Acesso removido." });
      await load();
    } catch (e: any) {
      const text = e?.message || "Erro ao remover admin.";
      setMsg({ kind: "err", text });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">Sevii · Admin</Link>
          <div className="flex gap-3 text-xs">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">Pedidos</Link>
            <Link to="/admin/manage-cards" className="text-muted-foreground hover:text-foreground">Gerenciar cartas</Link>
            <Link to="/admin/cards" className="text-muted-foreground hover:text-foreground">Preços</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Administradores</h1>
          <p className="text-sm text-muted-foreground">
            Conceda ou remova permissões de admin. O usuário precisa ter feito login pelo menos uma vez.
          </p>
        </div>

        <form onSubmit={handleGrant} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide">E-mail do novo admin</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "..." : "Tornar admin"}
            </button>
          </div>
          {msg && (
            <p className={`text-xs ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>
          )}
        </form>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide">
            Admins atuais ({admins.length})
          </div>
          {loading ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Carregando...</p>
          ) : admins.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum admin.</p>
          ) : (
            <ul className="divide-y divide-border">
              {admins.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.email ?? "(e-mail indisponível)"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{a.user_id}</p>
                  </div>
                  {user?.id !== a.user_id && (
                    <button
                      onClick={() => handleRevoke(a.user_id, a.email)}
                      disabled={busy}
                      className="rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
