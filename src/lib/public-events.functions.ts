import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugifyEventTitle, type EventRegistration, type PublicEvent } from "./public-events";

// Cliente público (somente leitura) para as páginas públicas de eventos.
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const mapEvent = (r: any): PublicEvent => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  cover_image: r.cover_image ?? null,
  short_description: r.short_description ?? null,
  description: r.description ?? null,
  event_date: r.event_date,
  start_time: String(r.start_time).slice(0, 5),
  end_time: String(r.end_time).slice(0, 5),
  location_name: r.location_name ?? null,
  address: r.address ?? null,
  capacity: r.capacity ?? null,
  registration_status: r.registration_status,
  publication_status: r.publication_status,
  additional_info: r.additional_info ?? null,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

const mapRegistration = (r: any): EventRegistration => ({
  id: r.id,
  event_id: r.event_id,
  user_id: r.user_id,
  full_name: r.full_name,
  email: r.email ?? null,
  phone: r.phone ?? null,
  status: r.status,
  confirmed_at: r.confirmed_at,
  cancelled_at: r.cancelled_at ?? null,
  checked_in_at: r.checked_in_at ?? null,
  checked_in_by: r.checked_in_by ?? null,
  created_at: r.created_at,
});

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Contagem de confirmados por evento via RPC pública (anon não lê inscrições por RLS). */
async function confirmedCounts(client: ReturnType<typeof publicClient>, eventIds: string[]) {
  const counts: Record<string, number> = {};
  await Promise.all(
    eventIds.map(async (id) => {
      const { data, error } = await client.rpc("public_event_confirmed_count", { _event_id: id });
      if (!error && typeof data === "number") counts[id] = data;
    }),
  );
  return counts;
}

/** Lista pública: eventos publicados, mais recentes primeiro. */
export const listPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const { data, error } = await client
    .from("public_events")
    .select("*")
    .eq("publication_status", "published")
    .order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  const events = (data ?? []).map(mapEvent);
  const counts = await confirmedCounts(client, events.map((e) => e.id));
  return events.map((e) => ({ ...e, confirmed_count: counts[e.id] ?? 0 }));
});

/** Detalhe público de um evento pelo slug. */
export const getPublicEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const client = publicClient();
    const { data: row, error } = await client
      .from("public_events")
      .select("*")
      .eq("slug", data.slug)
      .eq("publication_status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const counts = await confirmedCounts(client, [row.id]);
    return { ...mapEvent(row), confirmed_count: counts[row.id] ?? 0 };
  });

/** Inscrição do usuário logado em um evento. */
export const getMyEventRegistration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", data.eventId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? mapRegistration(row) : null;
  });

/** Confirma presença (RPC com trava de vagas e dados da conta). */
export const registerForPublicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("register_for_public_event", { _event_id: data.eventId });
    if (error) throw new Error(error.message);
    return result;
  });

/** Cancela a própria inscrição enquanto as inscrições estiverem abertas. */
export const cancelPublicEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("cancel_public_event_registration", { _event_id: data.eventId });
    if (error) throw new Error(error.message);
    return result;
  });

// ============================== ADMIN ==============================

export const listAllPublicEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("public_events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) throw new Error(error.message);
    const events = (data ?? []).map(mapEvent);
    const ids = events.map((e) => e.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: regs } = await context.supabase
        .from("event_registrations")
        .select("event_id")
        .in("event_id", ids)
        .eq("status", "confirmed");
      for (const r of regs ?? []) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
    }
    return events.map((e) => ({ ...e, confirmed_count: counts[e.id] ?? 0 }));
  });

const EventInput = z.object({
  title: z.string().trim().min(2).max(160),
  cover_image: z.string().trim().url().nullish(),
  short_description: z.string().trim().max(300).nullish(),
  description: z.string().trim().max(5000).nullish(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  location_name: z.string().trim().max(160).nullish(),
  address: z.string().trim().max(300).nullish(),
  capacity: z.number().int().min(1).max(100000).nullish(),
  registration_status: z.enum(["open", "closed"]).default("open"),
  publication_status: z.enum(["draft", "published"]).default("draft"),
  additional_info: z.string().trim().max(2000).nullish(),
});

function validateEventInput(input: z.infer<typeof EventInput>) {
  if (input.end_time <= input.start_time) throw new Error("O horário de término deve ser depois do início.");
}

const clean = (input: z.infer<typeof EventInput>) => ({
  title: input.title,
  cover_image: input.cover_image || null,
  short_description: input.short_description || null,
  description: input.description || null,
  event_date: input.event_date,
  start_time: input.start_time,
  end_time: input.end_time,
  location_name: input.location_name || null,
  address: input.address || null,
  capacity: input.capacity ?? null,
  registration_status: input.registration_status,
  publication_status: input.publication_status,
  additional_info: input.additional_info || null,
});

export const createPublicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EventInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    validateEventInput(data);
    const base = slugifyEventTitle(data.title);
    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const { data: row, error } = await context.supabase
        .from("public_events")
        .insert({ ...clean(data), slug })
        .select("*")
        .single();
      if (!error) return mapEvent(row);
      if (!error.message.includes("public_events_slug_key") && !error.message.includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Não foi possível gerar um link único para este evento.");
  });

export const updatePublicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), data: EventInput }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    validateEventInput(data.data);
    const { data: row, error } = await context.supabase
      .from("public_events")
      .update(clean(data.data))
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapEvent(row);
  });

export const deletePublicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("public_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista completa de participantes (admin). */
export const listEventRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", data.eventId)
      .order("confirmed_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRegistration);
  });

/** Check-in de participante (admin, registra data/hora, impede duplicidade). */
export const checkinEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ registrationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = await context.supabase.rpc("checkin_event_registration", { _registration_id: data.registrationId });
    if (error) throw new Error(error.message);
    return result;
  });

/** Desfaz um check-in feito por engano (admin). */
export const undoEventCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ registrationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = await context.supabase.rpc("undo_event_checkin", { _registration_id: data.registrationId });
    if (error) throw new Error(error.message);
    return result;
  });

/** Remove uma inscrição (admin). */
export const deleteEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ registrationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("event_registrations").delete().eq("id", data.registrationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
