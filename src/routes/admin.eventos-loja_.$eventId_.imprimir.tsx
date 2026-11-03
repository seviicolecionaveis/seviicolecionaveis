import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listAllPublicEvents, listEventRegistrations } from "@/lib/public-events.functions";
import {
  buildPrintableList,
  formatEventDate,
  formatTimeRange,
  type EventRegistration,
  type PublicEvent,
} from "@/lib/public-events";
import logoUrl from "@/assets/logo.webp";

export const Route = createFileRoute("/admin/eventos-loja_/$eventId_/imprimir")({
  head: () => ({
    meta: [
      { title: "Lista de presença — Sevii Colecionáveis" },
      { name: "description", content: "Lista de presença para impressão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintPresenceListPage,
});

function PrintPresenceListPage() {
  const { eventId } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [events, regs] = await Promise.all([
        listAllPublicEvents(),
        listEventRegistrations({ data: { eventId } }),
      ]);
      setEvent((events as PublicEvent[]).find((e) => e.id === eventId) ?? null);
      setRegistrations(regs as EventRegistration[]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (authLoading || loading) {
    return <p className="p-8 text-center text-sm text-neutral-500">Carregando lista...</p>;
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="font-semibold">Evento não encontrado.</p>
        <Link to="/admin/eventos-loja" className="mt-2 inline-block text-sm underline">
          Voltar
        </Link>
      </div>
    );
  }

  const participants = buildPrintableList(registrations);
  const generatedAt = new Date().toLocaleString("pt-BR");

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .fixed { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 14mm; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <Link
          to="/admin/eventos-loja/$eventId"
          params={{ eventId }}
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          ← Voltar aos participantes
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] px-6 py-8">
        <header className="flex items-center justify-between border-b-2 border-neutral-900 pb-4">
          <img src={logoUrl} alt="Sevii Colecionáveis" className="h-14 w-auto" />
          <div className="text-right text-xs text-neutral-600">
            <p>Lista gerada em {generatedAt}</p>
            <p className="font-semibold">{participants.length} participante(s) confirmado(s)</p>
          </div>
        </header>

        <div className="mt-4">
          <h1 className="text-xl font-bold">{event.title}</h1>
          <p className="mt-1 text-sm text-neutral-700">
            {formatEventDate(event.event_date)} · {formatTimeRange(event.start_time, event.end_time)}
            {event.location_name ? ` · ${event.location_name}` : ""}
          </p>
          {event.address && <p className="text-xs text-neutral-500">{event.address}</p>}
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-neutral-900 text-left text-xs uppercase tracking-wide">
              <th className="px-2 py-2 w-10">Nº</th>
              <th className="px-2 py-2">Nome completo</th>
              <th className="px-2 py-2 w-40">Telefone</th>
              <th className="px-2 py-2 w-24 text-center">Presença</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center text-neutral-500">
                  Nenhum participante confirmado.
                </td>
              </tr>
            ) : (
              participants.map((p) => (
                <tr key={p.id} className="border-b border-neutral-300">
                  <td className="px-2 py-2.5 text-neutral-500">{p.numero}</td>
                  <td className="px-2 py-2.5 font-medium">{p.full_name}</td>
                  <td className="px-2 py-2.5">{p.phone ?? "—"}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-block h-4 w-4 rounded-sm border-2 border-neutral-700 align-middle" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <footer className="mt-8 text-center text-[10px] text-neutral-400">
          Sevii Colecionáveis · Lista de presença · {event.title}
        </footer>
      </div>
    </div>
  );
}
