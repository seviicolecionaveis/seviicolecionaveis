import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RaffleInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  product_type: z.string().trim().min(1).max(40),
  product_id: z.string().trim().max(200).nullable(),
  product_name: z.string().trim().min(1).max(200),
  product_image: z.string().trim().max(1000).nullable(),
  product_price_cents: z.number().int().min(0).max(100_000_000),
  units: z.number().int().min(1).max(10_000),
  entry_limit_per_user: z.number().int().min(1).max(100),
  opens_at: z.string().min(1),
  closes_at: z.string().min(1),
  draw_at: z.string().min(1).nullable(),
  payment_deadline_hours: z.number().int().min(1).max(2160),
  rules: z.string().trim().max(5000).nullable(),
});

export const adminListRaffles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listRaffles } = await import("./raffles.server");
    return listRaffles(context.userId);
  });

export const adminGetRaffle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getRaffleDetail } = await import("./raffles.server");
    return getRaffleDetail(context.userId, data.raffleId);
  });

export const adminCreateRaffle = createServerFn({ method: "POST" })
  .inputValidator((d) => RaffleInputSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { createRaffle } = await import("./raffles.server");
    return createRaffle(context.userId, data);
  });

export const adminUpdateRaffle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ raffleId: z.string().uuid(), input: RaffleInputSchema.partial() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { updateRaffle } = await import("./raffles.server");
    return updateRaffle(context.userId, data.raffleId, data.input);
  });

export const adminSetRaffleStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        raffleId: z.string().uuid(),
        status: z.enum(["draft", "open", "closed", "drawn", "payment", "finished"]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { setRaffleStatus } = await import("./raffles.server");
    return setRaffleStatus(context.userId, data.raffleId, data.status);
  });

export const adminDeleteRaffle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { deleteRaffle } = await import("./raffles.server");
    return deleteRaffle(context.userId, data.raffleId);
  });

export const adminSetWinnerStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        winnerId: z.string().uuid(),
        status: z.enum(["pending_payment", "paid", "expired", "cancelled"]),
        notes: z.string().trim().max(1000).nullable().default(null),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { setWinnerStatus } = await import("./raffles.server");
    return setWinnerStatus(context.userId, data.winnerId, data.status, data.notes);
  });

export const adminExtendWinnerDeadline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ winnerId: z.string().uuid(), hours: z.number().int().min(1).max(2160) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { extendWinnerDeadline } = await import("./raffles.server");
    return extendWinnerDeadline(context.userId, data.winnerId, data.hours);
  });

/** Executa o sorteio no banco (aleatório, atômico). Roda como o admin logado. */
export const adminRunDraw = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ raffleId: z.string().uuid(), units: z.number().int().min(1).max(10_000).nullable().default(null) }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { assertAdmin, expireReservations } = await import("./raffles.server");
    await assertAdmin(context.userId);
    await expireReservations();
    const { data: picked, error } = await (context.supabase as any).rpc("raffle_run_draw", {
      _raffle_id: data.raffleId,
      _units: data.units,
    });
    if (error) return { success: false as const, error: error.message, winners: 0 };
    return { success: true as const, winners: (picked as number) ?? 0 };
  });

/** Participação do cliente — todas as validações ficam no banco. */
export const joinRaffle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("raffle_join", { _raffle_id: data.raffleId });
    if (error) {
      const msg = error.message ?? "";
      const map: Record<string, string> = {
        raffle_not_found: "Sorteio não encontrado.",
        raffle_closed: "As inscrições deste sorteio não estão abertas.",
        already_winner: "Você já foi contemplado neste sorteio.",
        entry_limit_reached: "Você já atingiu o limite de participações neste sorteio.",
        unauthenticated: "Faça login para participar.",
      };
      const key = Object.keys(map).find((k) => msg.includes(k));
      return { success: false as const, error: key ? map[key]! : "Não foi possível registrar sua participação." };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { success: true as const, entryCode: (row?.entry_code as string) ?? null };
  });
