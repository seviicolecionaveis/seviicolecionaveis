import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

export async function assertAdmin(userId: string) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Response("Erro ao verificar permissão", { status: 500 });
  if (!data) throw new Response("Acesso negado", { status: 403 });
}

async function log(raffleId: string | null, adminId: string, action: string, details: unknown = {}) {
  await db.from("raffle_admin_logs").insert({
    raffle_id: raffleId,
    admin_id: adminId,
    action,
    details: details ?? {},
  });
}

export interface RaffleInput {
  title: string;
  product_type: string;
  product_id: string | null;
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
}

export async function expireReservations() {
  const { data } = await db.rpc("raffle_expire_reservations");
  return (data as number | null) ?? 0;
}

export async function listRaffles(adminId: string) {
  await assertAdmin(adminId);
  await expireReservations();
  const { data: raffles, error } = await db
    .from("raffles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Response(error.message, { status: 500 });

  const ids = (raffles ?? []).map((r: any) => r.id);
  const counts: Record<string, { entries: number; participants: number; winners: number; paid: number; expired: number }> = {};
  for (const id of ids) counts[id] = { entries: 0, participants: 0, winners: 0, paid: 0, expired: 0 };

  if (ids.length) {
    const { data: entries } = await db.from("raffle_entries").select("raffle_id, user_id").in("raffle_id", ids);
    const seen: Record<string, Set<string>> = {};
    for (const e of entries ?? []) {
      const c = counts[e.raffle_id];
      if (!c) continue;
      c.entries += 1;
      (seen[e.raffle_id] ??= new Set()).add(e.user_id);
    }
    for (const id of ids) counts[id]!.participants = seen[id]?.size ?? 0;

    const { data: winners } = await db.from("raffle_winners").select("raffle_id, status").in("raffle_id", ids);
    for (const w of winners ?? []) {
      const c = counts[w.raffle_id];
      if (!c) continue;
      if (w.status === "expired" || w.status === "cancelled") c.expired += 1;
      else {
        c.winners += 1;
        if (w.status === "paid") c.paid += 1;
      }
    }
  }

  return { raffles: (raffles ?? []).map((r: any) => ({ ...r, stats: counts[r.id] })) };
}

async function usersInfo(userIds: string[]) {
  const unique = Array.from(new Set(userIds));
  const map: Record<string, { email: string | null; full_name: string | null; phone: string | null }> = {};
  if (!unique.length) return map;
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, full_name, whatsapp, phone")
    .in("user_id", unique);
  for (const p of profiles ?? []) {
    map[p.user_id] = { email: null, full_name: p.full_name ?? null, phone: p.whatsapp ?? p.phone ?? null };
  }
  for (const id of unique) {
    map[id] ??= { email: null, full_name: null, phone: null };
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      map[id]!.email = data?.user?.email ?? null;
    } catch {
      /* ignore */
    }
  }
  return map;
}

export async function getRaffleDetail(adminId: string, raffleId: string) {
  await assertAdmin(adminId);
  await expireReservations();
  const { data: raffle } = await db.from("raffles").select("*").eq("id", raffleId).maybeSingle();
  if (!raffle) throw new Response("Sorteio não encontrado", { status: 404 });

  const { data: entries } = await db
    .from("raffle_entries")
    .select("id, user_id, entry_code, created_at")
    .eq("raffle_id", raffleId)
    .order("created_at", { ascending: true });
  const { data: winners } = await db
    .from("raffle_winners")
    .select("id, user_id, entry_id, round, status, reserved_until, order_id, notes, created_at")
    .eq("raffle_id", raffleId)
    .order("round", { ascending: true });
  const { data: logs } = await db
    .from("raffle_admin_logs")
    .select("id, admin_id, action, details, created_at")
    .eq("raffle_id", raffleId)
    .order("created_at", { ascending: false })
    .limit(100);

  const info = await usersInfo([
    ...(entries ?? []).map((e: any) => e.user_id),
    ...(winners ?? []).map((w: any) => w.user_id),
  ]);
  const codeByEntry: Record<string, string> = {};
  for (const e of entries ?? []) codeByEntry[e.id] = e.entry_code;

  const activeWinners = (winners ?? []).filter((w: any) => w.status === "pending_payment" || w.status === "paid").length;

  return {
    raffle,
    unitsAvailable: Math.max(raffle.units - activeWinners, 0),
    entries: (entries ?? []).map((e: any) => ({ ...e, user: info[e.user_id] ?? null })),
    winners: (winners ?? []).map((w: any) => ({
      ...w,
      entry_code: codeByEntry[w.entry_id] ?? null,
      user: info[w.user_id] ?? null,
    })),
    logs: logs ?? [],
  };
}

export async function createRaffle(adminId: string, input: RaffleInput) {
  await assertAdmin(adminId);
  const { data, error } = await db
    .from("raffles")
    .insert({ ...input, created_by: adminId, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Response(error.message, { status: 400 });
  await log(data.id, adminId, "create", { title: input.title, units: input.units });
  return { id: data.id as string };
}

export async function updateRaffle(adminId: string, raffleId: string, input: Partial<RaffleInput>) {
  await assertAdmin(adminId);
  const { data: current } = await db.from("raffles").select("status").eq("id", raffleId).maybeSingle();
  if (!current) throw new Response("Sorteio não encontrado", { status: 404 });
  if (current.status !== "draft") {
    throw new Response("Só é possível editar as configurações enquanto o sorteio está em rascunho.", { status: 400 });
  }
  const { error } = await db.from("raffles").update(input).eq("id", raffleId);
  if (error) throw new Response(error.message, { status: 400 });
  await log(raffleId, adminId, "update", input);
  return { success: true };
}

const ALLOWED_STATUS = ["draft", "open", "closed", "drawn", "payment", "finished"] as const;

export async function setRaffleStatus(adminId: string, raffleId: string, status: string) {
  await assertAdmin(adminId);
  if (!ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number])) {
    throw new Response("Status inválido", { status: 400 });
  }
  const { error } = await db.from("raffles").update({ status }).eq("id", raffleId);
  if (error) throw new Response(error.message, { status: 400 });
  await log(raffleId, adminId, "status", { status });
  return { success: true };
}

export async function deleteRaffle(adminId: string, raffleId: string) {
  await assertAdmin(adminId);
  const { error } = await db.from("raffles").delete().eq("id", raffleId);
  if (error) throw new Response(error.message, { status: 400 });
  await log(null, adminId, "delete", { raffle_id: raffleId });
  return { success: true };
}

export async function setWinnerStatus(
  adminId: string,
  winnerId: string,
  status: "paid" | "expired" | "cancelled" | "pending_payment",
  notes: string | null,
) {
  await assertAdmin(adminId);
  const { data: winner } = await db.from("raffle_winners").select("id, raffle_id").eq("id", winnerId).maybeSingle();
  if (!winner) throw new Response("Vencedor não encontrado", { status: 404 });
  const patch: Record<string, unknown> = { status, notes };
  if (status !== "pending_payment") patch.reserved_until = null;
  const { error } = await db.from("raffle_winners").update(patch).eq("id", winnerId);
  if (error) throw new Response(error.message, { status: 400 });
  await log(winner.raffle_id, adminId, "winner_status", { winner_id: winnerId, status });
  return { success: true };
}

export async function extendWinnerDeadline(adminId: string, winnerId: string, hours: number) {
  await assertAdmin(adminId);
  const { data: winner } = await db
    .from("raffle_winners")
    .select("id, raffle_id, reserved_until, status")
    .eq("id", winnerId)
    .maybeSingle();
  if (!winner) throw new Response("Vencedor não encontrado", { status: 404 });
  const base = winner.reserved_until && new Date(winner.reserved_until) > new Date()
    ? new Date(winner.reserved_until)
    : new Date();
  const next = new Date(base.getTime() + hours * 3600_000).toISOString();
  const { error } = await db
    .from("raffle_winners")
    .update({ reserved_until: next, status: "pending_payment" })
    .eq("id", winnerId);
  if (error) throw new Response(error.message, { status: 400 });
  await log(winner.raffle_id, adminId, "extend_deadline", { winner_id: winnerId, hours, reserved_until: next });
  return { success: true, reserved_until: next };
}
