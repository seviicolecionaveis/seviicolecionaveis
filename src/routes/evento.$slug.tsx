import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock, Info, MapPin, Users } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelPublicEventRegistration,
  getMyEventRegistration,
  getPublicEventBySlug,
  registerForPublicEvent,
} from "@/lib/public-events.functions";
import {
  EVENT_DISPLAY_STATUS_LABELS,
  canCancelRegistration,
  canRegister,
  eventDisplayStatus,
  eventErrorMessage,
  formatEventDate,
  formatTimeRange,
  todayYmd,
  type EventRegistration,
  type PublicEvent,
} from "@/lib/public-events";

export const Route = createFileRoute("/evento/$slug")({
  head: () => ({
    meta: [
      { title: "Evento — Sevii Colecionáveis" },
      { name: "description", content: "Detalhes do evento da Sevii Colecionáveis e confirmação de presença." },
      { property: "og:title", content: "Evento — Sevii Colecionáveis" },
      { property: "og:description", content: "Confirme sua presença no evento da Sevii Colecionáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventoPage,
});

type EventWithCount = PublicEvent & { confirmed_count: number };

function EventoPage() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventWithCount | null | undefined>(undefined);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [busy, setBusy] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      const data = (await getPublicEventBySlug({ data: { slug } })) as EventWithCount | null;
      setEvent(data);
      return data;
    } catch {
      setEvent(null);
      return null;
    }
  }, [slug]);

  const loadRegistration = useCallback(async (eventId: string) => {
    try {
      const reg = (await getMyEventRegistration({ data: { eventId } })) as EventRegistration | null;
      setRegistration(reg && reg.status === "confirmed" ? reg : null);
    } catch {
      setRegistration(null);
    }
  }, []);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (user && event) loadRegistration(event.id);
    if (!user) setRegistration(null);
  }, [user, event, loadRegistration]);

  const confirm = async () => {
    if (!event) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/evento/${slug}` } });
      return;
    }
    setBusy(true);
    try {
      await registerForPublicEvent({ data: { eventId: event.id } });
      await Promise.all([loadEvent(), loadRegistration(event.id)]);
      toast.success("Presença confirmada! Nos vemos no evento.");
    } catch (e: any) {
      toast.error(eventErrorMessage(e?.message ?? "Erro ao confirmar presença."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!event || !user) return;
    setBusy(true);
    try {
      await cancelPublicEventRegistration({ data: { eventId: event.id } });
      await Promise.all([loadEvent(), loadRegistration(event.id)]);
      toast.success("Inscrição cancelada.");
    } catch (e: any) {
      toast.error(eventErrorMessage(e?.message ?? "Erro ao cancelar inscrição."));
    } finally {
      setBusy(false);
    }
  };

  if (event === undefined || authLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando evento...
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Evento não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este evento não existe ou não está mais disponível.
          </p>
          <Link to="/eventos" className="mt-4 inline-block text-sm font-semibold underline">
            Ver todos os eventos
          </Link>
        </div>
      </div>
    );
  }

  const status = eventDisplayStatus(event, event.confirmed_count, todayYmd());
  const confirmed = !!registration;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/eventos" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Todos os eventos
        </Link>

        {event.cover_image && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <img src={event.cover_image} alt={event.title} className="aspect-[21/9] w-full object-cover" />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{event.title}</h1>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                status === "open"
                  ? "bg-emerald-100 text-emerald-800"
                  : status === "closed"
                    ? "bg-amber-100 text-amber-800"
                    : status === "full"
                      ? "bg-red-100 text-red-800"
                      : "bg-secondary text-muted-foreground"
              }`}
            >
              {EVENT_DISPLAY_STATUS_LABELS[status]}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" /> Data
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{formatEventDate(event.event_date)}</p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Horário
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatTimeRange(event.start_time, event.end_time)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4" /> Local
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{event.location_name ?? "A definir"}</p>
            {event.address && <p className="mt-1 text-xs text-muted-foreground">{event.address}</p>}
            {event.capacity != null && (
              <>
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" /> Vagas
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.confirmed_count} de {event.capacity} preenchidas
                </p>
              </>
            )}
          </div>
        </div>

        {event.description && (
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-bold">Sobre o evento</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </section>
        )}

        {event.additional_info && (
          <section className="mt-4 rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Info className="h-4 w-4" /> Informações adicionais
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {event.additional_info}
            </p>
          </section>
        )}

        <div className="sticky bottom-4 mt-8">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            {confirmed ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" /> Presença confirmada
                </p>
                {canCancelRegistration(status) && (
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={busy}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
                  >
                    {busy ? "Cancelando..." : "Cancelar minha inscrição"}
                  </button>
                )}
              </div>
            ) : canRegister(status) ? (
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-3 text-base font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Confirmando..." : user ? "Confirmar presença" : "Entre para confirmar presença"}
              </button>
            ) : (
              <p className="text-center text-sm font-semibold text-muted-foreground">
                {EVENT_DISPLAY_STATUS_LABELS[status]} — não é possível confirmar presença.
              </p>
            )}
            {!user && canRegister(status) && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Você será direcionado para entrar na sua conta e voltará aqui automaticamente.
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
