import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getMelhorEnvioAuthUrl,
  getMelhorEnvioStatus,
  disconnectMelhorEnvio,
} from "@/utils/melhorenvio.functions";
import {
  getBrevoStatus,
  syncExistingCustomers,
  sendLoyaltyLaunchCampaign,
} from "@/lib/newsletter.functions";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Sevii Admin" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    melhorenvio: typeof s.melhorenvio === "string" ? s.melhorenvio : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const fetchStatus = useServerFn(getMelhorEnvioStatus);
  const fetchAuthUrl = useServerFn(getMelhorEnvioAuthUrl);
  const doDisconnect = useServerFn(disconnectMelhorEnvio);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    reload();
  }, [isAdmin]);

  useEffect(() => {
    if (search.melhorenvio === "connected") {
      toast.success("Melhor Envio conectado!");
      nav({ to: "/admin/integrations", replace: true });
    } else if (search.melhorenvio === "error") {
      toast.error(`Falha ao conectar Melhor Envio: ${search.reason ?? "desconhecida"}`);
      nav({ to: "/admin/integrations", replace: true });
    }
  }, [search.melhorenvio, search.reason]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await fetchAuthUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar conexão.");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar Melhor Envio? Cotações deixarão de incluí-lo.")) return;
    setBusy(true);
    try {
      await doDisconnect();
      toast.success("Desconectado.");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm">
        Acesso restrito. <Link to="/" className="ml-1 underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-4 flex-wrap">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            Sevii · Admin · Integrações
          </Link>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← Pedidos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Integrações</h1>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-bold text-lg">Melhor Envio</h2>
              <p className="text-xs text-muted-foreground">
                Cotação adicional de frete (Correios + transportadoras). Roda em paralelo ao
                Superfrete.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                status?.connected
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              }`}
            >
              {status?.connected ? "Conectado" : "Desconectado"}
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !status?.configured ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-100">
              <p className="font-semibold mb-1">⚠️ Credenciais não configuradas</p>
              <p>
                Os secrets <code>MELHORENVIO_CLIENT_ID</code> e{" "}
                <code>MELHORENVIO_CLIENT_SECRET</code> ainda não foram cadastrados. Peça ao
                desenvolvedor para configurar.
              </p>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                <div>
                  <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    Ambiente
                  </dt>
                  <dd className="font-mono font-semibold">{status?.environment}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    URL base
                  </dt>
                  <dd className="font-mono break-all">{status?.baseUrl}</dd>
                </div>
                {status?.connected && (
                  <>
                    <div>
                      <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                        Token expira em
                      </dt>
                      <dd className="font-mono">
                        {status.expiresAt
                          ? new Date(status.expiresAt).toLocaleString("pt-BR")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                        Scopes
                      </dt>
                      <dd className="font-mono text-[10px] break-all">{status.scope}</dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="flex gap-2">
                {status?.connected ? (
                  <>
                    <button
                      onClick={connect}
                      disabled={busy}
                      className="rounded-md border border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-secondary disabled:opacity-40"
                    >
                      Reconectar
                    </button>
                    <button
                      onClick={disconnect}
                      disabled={busy}
                      className="rounded-md border border-destructive text-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40"
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={connect}
                    disabled={busy}
                    className="rounded-md bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? "Abrindo..." : "Conectar Melhor Envio"}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
