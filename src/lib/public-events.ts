// Regras puras do módulo público de Eventos (sem acesso a banco ou browser).

export interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  cover_image: string | null;
  short_description: string | null;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location_name: string | null;
  address: string | null;
  capacity: number | null;
  registration_status: "open" | "closed";
  publication_status: "draft" | "published";
  additional_info: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: "confirmed" | "cancelled";
  confirmed_at: string;
  cancelled_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
}

export type EventDisplayStatus = "open" | "closed" | "full" | "finished";

export const EVENT_DISPLAY_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  open: "Inscrições abertas",
  closed: "Inscrições encerradas",
  full: "Esgotado",
  finished: "Evento encerrado",
};

/** Status exibido ao cliente, considerando data, status admin e lotação. */
export function eventDisplayStatus(
  event: Pick<PublicEvent, "event_date" | "registration_status" | "capacity">,
  confirmedCount: number,
  todayYmd: string,
): EventDisplayStatus {
  if (event.event_date < todayYmd) return "finished";
  if (event.registration_status !== "open") return "closed";
  if (event.capacity != null && confirmedCount >= event.capacity) return "full";
  return "open";
}

/** Cliente pode confirmar presença apenas com inscrições abertas e vagas. */
export function canRegister(status: EventDisplayStatus): boolean {
  return status === "open";
}

/** Cliente pode cancelar enquanto as inscrições estiverem abertas (mesmo esgotado). */
export function canCancelRegistration(status: EventDisplayStatus): boolean {
  return status === "open" || status === "full";
}

export function slugifyEventTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evento";
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11-15" → "15 de novembro de 2026" */
export function formatEventDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** "14:30" + "18:00" → "14h30 às 18h" */
export function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":");
    return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
  };
  return `${fmt(start)} às ${fmt(end)}`;
}

/** Data de hoje em YYYY-MM-DD no fuso de Fortaleza (America/Fortaleza, UTC-3). */
export function todayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface PrintableParticipant {
  full_name: string;
  phone: string | null;
}

/** Lista de presença: apenas confirmados, ordem alfabética (pt-BR), numerados. */
export function buildPrintableList<T extends PrintableParticipant>(
  registrations: T[],
): (T & { numero: number })[] {
  return registrations
    .filter((r) => (r as { status?: string }).status === undefined || (r as { status?: string }).status === "confirmed")
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
    .map((r, i) => ({ ...r, numero: i + 1 }));
}

function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV (separador ";", compatível com Excel pt-BR) da lista de participantes. */
export function registrationsToCsv(
  registrations: EventRegistration[],
): string {
  const header = "Nº;Nome completo;Telefone;E-mail;Data da confirmação;Status;Check-in";
  const rows = buildPrintableList(
    registrations.map((r) => ({ ...r })),
  ).map((r) =>
    [
      String(r.numero),
      csvCell(r.full_name),
      csvCell(r.phone),
      csvCell(r.email),
      new Date(r.confirmed_at).toLocaleString("pt-BR"),
      r.status === "confirmed" ? "Confirmado" : "Cancelado",
      r.checked_in_at ? new Date(r.checked_in_at).toLocaleString("pt-BR") : "",
    ].join(";"),
  );
  return "﻿" + [header, ...rows].join("\r\n");
}

/** Mensagem amigável para os códigos de erro das RPCs de evento. */
export function eventErrorMessage(raw: string): string {
  if (raw.includes("event_full")) return "As vagas deste evento se esgotaram.";
  if (raw.includes("registrations_closed")) return "As inscrições deste evento estão encerradas.";
  if (raw.includes("event_finished")) return "Este evento já aconteceu.";
  if (raw.includes("event_not_available") || raw.includes("event_not_found")) return "Evento não encontrado ou indisponível.";
  if (raw.includes("registration_not_found")) return "Inscrição não encontrada.";
  if (raw.includes("registration_not_confirmed")) return "Esta inscrição não está confirmada.";
  if (raw.includes("not_authenticated")) return "Entre na sua conta para continuar.";
  if (raw.includes("forbidden")) return "Você não tem permissão para esta ação.";
  return raw;
}
