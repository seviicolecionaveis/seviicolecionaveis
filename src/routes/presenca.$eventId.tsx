import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { eventTimeRangeLabel, formatYmd, type PickupEvent } from "@/lib/events";

export const Route = createFileRoute("/presenca/$eventId")({
  head: () => ({
    meta: [
      { title: "Confirmar presença no evento — Sevii Colecionáveis" },
      { name: "description", content: "Confirme sua presença no evento da Sevii Colecionáveis com um clique." },
      { property: "og:title", content: "Confirme sua presença — Sevii Colecionáveis" },
      { property: "og:description", content: "Clique e confirme que você estará no nosso evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresencePage,
});

function PresencePage() {
  const { eventId } = Route.useParams();
  const { user, loading } = useAuth();
  const [event, setEvent] = useState<PickupEvent | null | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("events").select("*").eq("id", eventId).maybeSingle()
      .then(({ data }) => setEvent((data as unknown as PickupEvent) ?? null));
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    supabase.from("event_attendances").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setConfirmed(!!data));
  }, [user, eventId]);

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("confirm_event_presence", { _event_id: eventId });
    setBusy(false);
    if (error) return toast.error(error.message);
    setConfirmed(true);
    toast.success("Presença confirmada!");
  };

  const cancel = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("event_attendances").delete().eq("event_id", eventId).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setConfirmed(false);
    toast.success("Presença cancelada.");
  };

  if (event === undefined) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (event === null) return <div className="p-10 text-center">Evento não encontrado ou encerrado.</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Evento Sevii</p>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {formatYmd(event.start_date)}
          {event.end_date !== event.start_date ? ` a ${formatYmd(event.end_date)}` : ""} · {eventTimeRangeLabel(event)}
        </p>
        {event.description && <p className="text-sm">{event.description}</p>}

        {loading ? null : !user ? (
          <Link
            to="/auth"
            search={{ redirect: `/presenca/${eventId}` }}
            className="block w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            Entrar para confirmar presença
          </Link>
        ) : confirmed ? (
          <div className="space-y-2">
            <p className="rounded-md bg-secondary px-4 py-3 font-semibold">✓ Sua presença está confirmada!</p>
            <button type="button" disabled={busy} onClick={cancel} className="text-xs text-muted-foreground underline">
              Não vou mais poder ir
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Confirmando…" : "Estarei presente"}
          </button>
        )}
      </div>
    </div>
  );
}
