import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { listPublicEvents } from "@/lib/public-events.functions";
import {
  EVENT_DISPLAY_STATUS_LABELS,
  eventDisplayStatus,
  formatEventDate,
  formatTimeRange,
  todayYmd,
  type EventDisplayStatus,
  type PublicEvent,
} from "@/lib/public-events";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Confira os próximos eventos da Sevii Colecionáveis e confirme sua presença pelo site.",
      },
      { property: "og:title", content: "Eventos — Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Próximos eventos da loja: confirme sua presença pelo site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventosPage,
});

type EventWithCount = PublicEvent & { confirmed_count: number };

const STATUS_STYLES: Record<EventDisplayStatus, string> = {
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-amber-100 text-amber-800",
  full: "bg-red-100 text-red-800",
  finished: "bg-secondary text-muted-foreground",
};

function EventCard({ event }: { event: EventWithCount }) {
  const status = eventDisplayStatus(event, event.confirmed_count, todayYmd());
  return (
    <Link
      to="/evento/$slug"
      params={{ slug: event.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md hover:border-foreground/30"
    >
      <div className="relative aspect-[16/9] bg-secondary overflow-hidden">
        {event.cover_image ? (
          <img
            src={event.cover_image}
            alt={event.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
        >
          {EVENT_DISPLAY_STATUS_LABELS[status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-bold leading-snug">{event.title}</h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatEventDate(event.event_date)}
          </p>
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {formatTimeRange(event.start_time, event.end_time)}
          </p>
          {event.location_name && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.location_name}
            </p>
          )}
          {event.capacity != null && (
            <p className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {event.confirmed_count}/{event.capacity} vagas preenchidas
            </p>
          )}
        </div>
        {event.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{event.short_description}</p>
        )}
        <span className="mt-auto inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition group-hover:opacity-90">
          Ver detalhes
        </span>
      </div>
    </Link>
  );
}

function EventosPage() {
  const [events, setEvents] = useState<EventWithCount[] | null>(null);

  useEffect(() => {
    listPublicEvents()
      .then((data) => setEvents(data as EventWithCount[]))
      .catch(() => setEvents([]));
  }, []);

  const today = todayYmd();
  const upcoming = (events ?? []).filter((e) => e.event_date >= today);
  const past = (events ?? []).filter((e) => e.event_date < today);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">Eventos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confira os próximos eventos da Sevii Colecionáveis e confirme sua presença pelo site.
        </p>

        {events === null ? (
          <p className="mt-10 text-sm text-muted-foreground">Carregando eventos...</p>
        ) : events.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum evento publicado no momento. Volte em breve!
            </p>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-bold">Próximos eventos</h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhum evento agendado no momento.
                </p>
              ) : (
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section className="mt-12">
                <h2 className="text-lg font-bold text-muted-foreground">Eventos anteriores</h2>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 opacity-80">
                  {past.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
