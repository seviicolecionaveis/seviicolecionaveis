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

        <BrevoSection />
      </main>
    </div>
  );
}

function BrevoSection() {
  const fetchBrevoStatus = useServerFn(getBrevoStatus);
  const doSync = useServerFn(syncExistingCustomers);
  const doSendCampaign = useServerFn(sendLoyaltyLaunchCampaign);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "sync" | "campaign">(null);
  const [senderName, setSenderName] = useState("Sevii Colecionáveis");
  const [senderEmail, setSenderEmail] = useState("seviicolecionaveis@gmail.com");
  const [subject, setSubject] = useState("🎉 Novidade: Programa de Pontos Sevii");

  const reload = async () => {
    try {
      const s = await fetchBrevoStatus();
      setStatus(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar status Brevo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  async function onSync() {
    setBusy("sync");
    try {
      const r = await doSync();
      toast.success(`Sincronizados ${r.synced}/${r.total} clientes (${r.failed} falhas).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }

  async function onSendCampaign() {
    if (
      !confirm(
        "Enviar a campanha de lançamento do Programa de Pontos para as listas Newsletter + Clientes na Brevo?"
      )
    )
      return;
    setBusy("campaign");
    try {
      const r = await doSendCampaign({
        data: { senderName, senderEmail, subject },
      });
      if (r.ok) {
        toast.success("Campanha enviada! 🎉");
      } else {
        toast.error(r.reason ?? "Falha ao enviar.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar campanha.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-lg">Brevo · Newsletter</h2>
          <p className="text-xs text-muted-foreground">
            Captação de inscrições no rodapé, sincronização automática de clientes após
            compra e disparo de campanhas.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            status?.connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {status?.connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !status?.configured ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Conector Brevo não configurado. Vá em <strong>Conectores</strong> e conecte a
          Brevo.
        </div>
      ) : !status?.connected ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold mb-1">Falha ao conectar à Brevo</p>
          <p>{status?.error}</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5">
            <div>
              <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                Conta Brevo
              </dt>
              <dd className="font-mono">{status.accountEmail}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                Listas
              </dt>
              <dd className="font-mono">
                Newsletter #{status.newsletterListId} · Clientes #{status.customersListId}
              </dd>
            </div>
          </dl>

          <div className="space-y-4">
            <div className="rounded-md border border-border p-3">
              <h3 className="text-sm font-bold mb-1">Sincronizar clientes existentes</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Adiciona todos os usuários cadastrados às listas Newsletter + Clientes na
                Brevo. Seguro de rodar várias vezes (idempotente).
              </p>
              <button
                onClick={onSync}
                disabled={busy !== null}
                className="rounded-md bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
              >
                {busy === "sync" ? "Sincronizando..." : "Sincronizar agora"}
              </button>
            </div>

            <div className="rounded-md border border-border p-3 space-y-2">
              <h3 className="text-sm font-bold">Campanha de lançamento — Programa de Pontos</h3>
              <p className="text-xs text-muted-foreground">
                Envia o e-mail oficial para Newsletter + Clientes. O remetente precisa
                estar verificado na Brevo (cheque a caixa do e-mail informado).
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block mb-1 text-muted-foreground">Nome do remetente</span>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  <span className="block mb-1 text-muted-foreground">E-mail do remetente</span>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="block mb-1 text-muted-foreground">Assunto</span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
              <button
                onClick={onSendCampaign}
                disabled={busy !== null}
                className="rounded-md bg-[#20a5c9] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
              >
                {busy === "campaign" ? "Enviando..." : "Enviar campanha agora"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
