import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getEmailLogs } from "@/utils/emailLogs.functions";
import ManualEmailComposer from "@/components/admin/ManualEmailComposer";

export const Route = createFileRoute("/admin/emails")({
  head: () => ({ meta: [{ title: "Admin · E-mails" }] }),
  component: EmailsAdminPage,
});

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  dlq: "bg-red-100 text-red-800",
  suppressed: "bg-gray-200 text-gray-800",
  bounced: "bg-orange-100 text-orange-800",
  complained: "bg-orange-100 text-orange-800",
};

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7 dias", hours: 168 },
  { label: "30 dias", hours: 720 },
];

function EmailsAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [hours, setHours] = useState(168);
  const [template, setTemplate] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getEmailLogs({
        data: { hours, template: template || undefined, status: status || undefined, limit: 200 },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, hours, template, status]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, hours, template, status]);

  const stats = data?.stats ?? { total: 0, sent: 0, pending: 0, failed: 0, suppressed: 0 };
  const logs = data?.logs ?? [];
  const templates: string[] = data?.templates ?? [];

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            ← Sevii Admin
          </Link>
          <h1 className="text-sm font-semibold">Monitor de e-mails</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <ManualEmailComposer onSent={() => setTimeout(() => load(), 1500)} />




        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${hours === r.hours ? "bg-foreground text-background border-foreground" : "border-border hover:bg-secondary"}`}
            >
              {r.label}
            </button>
          ))}
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="">Todos os templates</option>
            {templates.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="">Todos os status</option>
            <option value="sent">Enviado</option>
            <option value="pending">Pendente</option>
            <option value="failed">Falhou</option>
            <option value="dlq">DLQ</option>
            <option value="suppressed">Suprimido</option>
          </select>
          <button
            onClick={() => load()}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "" },
            { label: "Enviados", value: stats.sent, color: "text-green-700" },
            { label: "Pendentes", value: stats.pending, color: "text-yellow-700" },
            { label: "Falhas", value: stats.failed, color: "text-red-700" },
            { label: "Suprimidos", value: stats.suppressed, color: "text-gray-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Template</th>
                <th className="text-left p-3">Destinatário</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Quando</th>
                <th className="text-left p-3">Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum e-mail no período.</td></tr>
              ) : logs.map((l: any) => (
                <tr key={l.message_id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{l.template_name}</td>
                  <td className="p-3">{l.recipient_email}</td>
                  <td className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[l.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-xs text-red-700 max-w-xs truncate" title={l.error_message ?? ""}>
                    {l.error_message ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Atualiza automaticamente a cada 15 segundos.</p>
      </main>
    </div>
  );
}
