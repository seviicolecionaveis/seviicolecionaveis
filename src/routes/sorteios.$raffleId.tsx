import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Ticket, Trophy } from "lucide-react";
import { joinRaffle } from "@/lib/raffles.functions";
import { RAFFLE_STATUS_LABEL } from "./sorteios.index";

export const Route = createFileRoute("/sorteios/$raffleId")({
  head: () => ({
    meta: [
      { title: "Sorteio — Sevii Colecionáveis" },
      { name: "description", content: "Participe do sorteio de produtos com estoque limitado da Sevii Colecionáveis." },
      { property: "og:title", content: "Sorteio — Sevii Colecionáveis" },
      { property: "og:description", content: "Participe do sorteio de produtos com estoque limitado da Sevii Colecionáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RaffleDetail,
});

interface Raffle {
  id: string;
  title: string;
  product_name: string;
  product_image: string | null;
  product_price_cents: number;
  units: number;
  entry_limit_per_user: number;
  opens_at: string;
  closes_at: string;
  draw_at: string | null;
  payment_deadline_hours: number;
  rules: string | null;
  status: string;
}

interface Entry { id: string; entry_code: string; created_at: string }
interface Winner { id: string; status: string; reserved_until: string | null }

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function RaffleDetail() {
  const { raffleId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const join = useServerFn(joinRaffle);
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("raffles").select("*").eq("id", raffleId).maybeSingle();
    setRaffle(data ?? null);
    if (user) {
      const [{ data: e }, { data: w }] = await Promise.all([
        (supabase as any).from("raffle_entries").select("id, entry_code, created_at").eq("raffle_id", raffleId),
        (supabase as any)
          .from("raffle_winners")
          .select("id, status, reserved_until")
          .eq("raffle_id", raffleId)
          .maybeSingle(),
      ]);
      setEntries(e ?? []);
      setWinner(w ?? null);
    } else {
      setEntries([]);
      setWinner(null);
    }
    setLoading(false);
  }, [raffleId, user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const handleJoin = async () => {
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    setJoining(true);
    try {
      const res = await join({ data: { raffleId } });
      if (!res.success) toast.error(res.error);
      else {
        toast.success(`Participação confirmada! Código ${res.entryCode}`);
        await load();
      }
    } catch {
      toast.error("Não foi possível registrar sua participação.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!raffle || raffle.status === "draft") {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Sorteio não encontrado.</p>
          <Link to="/sorteios" className="text-sm font-semibold underline">Ver sorteios</Link>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const isOpen =
    raffle.status === "open" && now >= new Date(raffle.opens_at).getTime() && now <= new Date(raffle.closes_at).getTime();
  const canJoin = isOpen && !winner && entries.length < raffle.entry_limit_per_user;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/sorteios" className="text-xs text-muted-foreground hover:text-foreground">← Todos os sorteios</Link>

        <div className="mt-4 grid gap-6 sm:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-secondary">
            {raffle.product_image ? (
              <img src={raffle.product_image} alt={raffle.product_name} className="w-full object-cover" />
            ) : (
              <div className="aspect-[3/4] grid place-items-center text-muted-foreground"><Ticket className="h-8 w-8" /></div>
            )}
          </div>

          <div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
              {RAFFLE_STATUS_LABEL[raffle.status] ?? raffle.status}
            </span>
            <h1 className="mt-2 text-2xl font-bold">{raffle.title}</h1>
            <p className="text-sm text-muted-foreground">{raffle.product_name}</p>
            {raffle.product_price_cents > 0 && (
              <p className="mt-2 text-lg font-bold tabular-nums">
                R$ {(raffle.product_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}

            <dl className="mt-4 space-y-1 text-sm">
              <div><dt className="inline font-semibold">Unidades sorteadas: </dt><dd className="inline">{raffle.units}</dd></div>
              <div><dt className="inline font-semibold">Inscrições: </dt><dd className="inline">{fmt(raffle.opens_at)} até {fmt(raffle.closes_at)}</dd></div>
              <div><dt className="inline font-semibold">Sorteio previsto: </dt><dd className="inline">{fmt(raffle.draw_at)}</dd></div>
              <div><dt className="inline font-semibold">Limite por cliente: </dt><dd className="inline">{raffle.entry_limit_per_user}</dd></div>
              <div><dt className="inline font-semibold">Prazo para pagar se for contemplado: </dt><dd className="inline">{raffle.payment_deadline_hours}h</dd></div>
            </dl>

            <div className="mt-5">
              {winner ? (
                <div className={`rounded-xl border p-4 ${winner.status === "expired" || winner.status === "cancelled" ? "border-border bg-secondary" : "border-green-500 bg-green-50"}`}>
                  <p className="flex items-center gap-2 font-bold text-green-900">
                    <Trophy className="h-4 w-4" />
                    {winner.status === "paid"
                      ? "Você foi contemplado e o pagamento está confirmado!"
                      : winner.status === "pending_payment"
                        ? "Parabéns! Você foi contemplado neste sorteio."
                        : "Sua reserva expirou."}
                  </p>
                  {winner.status === "pending_payment" && (
                    <p className="mt-1 text-sm text-green-900">
                      Sua unidade está reservada até <strong>{fmt(winner.reserved_until)}</strong>. Finalize a compra
                      dentro do prazo para garantir o produto — entre em contato pelo WhatsApp para concluir o pagamento.
                    </p>
                  )}
                </div>
              ) : entries.length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Você está participando!</p>
                  <ul className="mt-1 text-sm text-muted-foreground">
                    {entries.map((e) => (
                      <li key={e.id}>Código {e.entry_code} · {fmt(e.created_at)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canJoin && (
                <Button className="mt-3 w-full sm:w-auto" onClick={handleJoin} disabled={joining}>
                  {joining ? "Registrando..." : user ? "Participar do sorteio" : "Entrar para participar"}
                </Button>
              )}
              {!isOpen && !winner && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {raffle.status === "open" ? "As inscrições ainda não começaram." : "As inscrições estão encerradas."}
                </p>
              )}
            </div>
          </div>
        </div>

        {raffle.rules && (
          <section className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide">Regras do sorteio</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{raffle.rules}</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
