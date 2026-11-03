import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Download,
  MapPin,
  Printer,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  checkinEventRegistration,
  deleteEventRegistration,
  listAllPublicEvents,
  listEventRegistrations,
  undoEventCheckin,
} from "@/lib/public-events.functions";
import {
  eventErrorMessage,
  formatEventDate,
  formatTimeRange,
  registrationsToCsv,
  type EventRegistration,
  type PublicEvent,
} from "@/lib/public-events";

export const Route = createFileRoute("/admin/eventos-loja/$eventId")({
  head: () => ({
    meta: [
      { title: "Participantes do evento — Admin Sevii" },
      { name: "description", content: "Gerencie os participantes confirmados no evento." },
      { property: "og:title", content: "Participantes do evento — Admin Sevii" },
      { property: "og:description", content: "Gerencie os participantes confirmados no evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEventParticipantsPage,
});

type Tab = "participantes" | "entrada";

function AdminEventParticipantsPage() {
  const { eventId } = Route.useParams();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("participantes");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "cancelled">("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [events, regs] = await Promise.all([
        listAllPublicEvents(),
        listEventRegistrations({ data: { eventId } }),
      ]);
      setEvent((events as PublicEvent[]).find((e) => e.id === eventId) ?? null);
      setRegistrations(regs as EventRegistration[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar participantes.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const present = confirmed.filter((r) => r.checked_in_at);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => !q || r.full_name.toLowerCase().includes(q))
      .sort((a, b) =>
        sortAsc
          ? a.full_name.localeCompare(b.full_name, "pt-BR")
          : b.full_name.localeCompare(a.full_name, "pt-BR"),
      );
  }, [registrations, search, statusFilter, sortAsc]);

  const checkinList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return confirmed
      .filter((r) => !q || r.full_name.toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [confirmed, search]);

  const exportCsv = () => {
    const csv = registrationsToCsv(registrations);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes-${event?.slug ?? "evento"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doCheckin = async (r: EventRegistration) => {
    setBusyId(r.id);
    try {
      const result = (await checkinEventRegistration({ data: { registrationId: r.id } })) as any;
      if (result?.status === "already_checked_in") {
        toast.info(`${r.full_name} já havia feito check-in.`);
      } else {
        toast.success(`Check-in de ${r.full_name} registrado.`);
      }
      await load();
    } catch (e: any) {
      toast.error(eventErrorMessage(e?.message ?? "Erro no check-in."));
    } finally {
      setBusyId(null);
    }
  };

  const undoCheckin = async (r: EventRegistration) => {
    setBusyId(r.id);
    try {
      await undoEventCheckin({ data: { registrationId: r.id } });
      toast.success(`Check-in de ${r.full_name} desfeito.`);
      await load();
    } catch (e: any) {
      toast.error(eventErrorMessage(e?.message ?? "Erro ao desfazer check-in."));
    } finally {
      setBusyId(null);
    }
  };

  const removeRegistration = async (r: EventRegistration) => {
    if (!window.confirm(`Remover a inscrição de ${r.full_name}?`)) return;
    setBusyId(r.id);
    try {
      await deleteEventRegistration({ data: { registrationId: r.id } });
      toast.success("Inscrição removida.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover inscrição.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!event) {
    return (
      <div className="p-8">
        <p className="font-semibold">Evento não encontrado.</p>
        <Link to="/admin/eventos-loja" className="mt-2 inline-block text-sm underline">
          Voltar para eventos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/admin/eventos-loja" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
        ← Eventos da loja
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatEventDate(event.event_date)} ·{" "}
              {formatTimeRange(event.start_time, event.end_time)}
            </span>
            {event.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {event.location_name}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <Link
            to="/admin/eventos-loja/$eventId/imprimir"
            params={{ eventId }}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir lista de presença
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold">{confirmed.length}</p>
          <p className="text-xs text-muted-foreground">Confirmados</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold">{cancelled.length}</p>
          <p className="text-xs text-muted-foreground">Cancelamentos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{present.length}</p>
          <p className="text-xs text-muted-foreground">Presentes</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{confirmed.length - present.length}</p>
          <p className="text-xs text-muted-foreground">Ausentes</p>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border">
        {(
          [
            ["participantes", "Participantes"],
            ["entrada", "Controle de entrada"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar participante pelo nome..."
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {tab === "participantes" && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              <option value="all">Todos os status</option>
              <option value="confirmed">Confirmados</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <ArrowUpDown className="h-3 w-3" /> Nome {sortAsc ? "A→Z" : "Z→A"}
            </button>
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {registrations.length} inscrições
            </p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nº</th>
                  <th className="px-3 py-2">Nome completo</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Confirmação</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma inscrição encontrada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{r.full_name}</td>
                      <td className="px-3 py-2">{r.phone ?? "—"}</td>
                      <td className="px-3 py-2">{r.email ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(r.confirmed_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "confirmed" ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                            Confirmado
                          </span>
                        ) : (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">
                            Cancelado
                          </span>
                        )}
                        {r.checked_in_at && (
                          <span className="ml-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                            Presente
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRegistration(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "entrada" && (
        <div className="mt-3 space-y-2">
          {checkinList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum participante confirmado encontrado.
            </p>
          ) : (
            checkinList.map((r) => {
              const checked = !!r.checked_in_at;
              return (
                <div
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                    checked ? "border-emerald-300 bg-emerald-50/60" : "border-border bg-card"
                  }`}
                >
                  <div>
                    <p className="font-semibold">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.phone ?? "sem telefone"}
                      {checked &&
                        ` · check-in às ${new Date(r.checked_in_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  {checked ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Presente
                      </span>
                      <button
                        type="button"
                        onClick={() => undoCheckin(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        <Undo2 className="h-3 w-3" /> Desfazer
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => doCheckin(r)}
                      disabled={busyId === r.id}
                      className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Registrando..." : "Marcar presença"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
