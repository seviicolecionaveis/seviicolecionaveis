import { supabaseAdmin } from "@/integrations/supabase/client.server";

// São Paulo is UTC-3 year-round (no DST since 2019).
// Cycle: Friday 12:00 SP → next Friday 11:59:59 SP
//      = Friday 15:00 UTC → next Friday 14:59:59 UTC
const FRIDAY_15_UTC_EPOCH = Date.UTC(2024, 0, 5, 15, 0, 0); // 2024-01-05 was a Friday
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CycleBounds {
  cycleStart: Date;
  cycleEnd: Date;
}

export function getCurrentCycleBounds(now: Date = new Date()): CycleBounds {
  const nowMs = now.getTime();
  const diff = nowMs - FRIDAY_15_UTC_EPOCH;
  const cyclesSince = Math.floor(diff / WEEK_MS);
  const startMs = FRIDAY_15_UTC_EPOCH + cyclesSince * WEEK_MS;
  const endMs = startMs + WEEK_MS - 1000;
  return { cycleStart: new Date(startMs), cycleEnd: new Date(endMs) };
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `AEC-${s}`;
}

export async function findActiveCodeForUser(userId: string) {
  const { cycleStart, cycleEnd } = getCurrentCycleBounds();
  const { data } = await supabaseAdmin
    .from("arte_em_cards_codes")
    .select("code, cycle_start, cycle_end")
    .eq("user_id", userId)
    .eq("cycle_start", cycleStart.toISOString())
    .maybeSingle();
  if (data) return { code: data.code, cycleStart, cycleEnd: new Date(data.cycle_end) };
  return null;
}

export async function ensureCodeForUser(userId: string) {
  const existing = await findActiveCodeForUser(userId);
  if (existing) return existing;
  const { cycleStart, cycleEnd } = getCurrentCycleBounds();
  // Try up to 5 times in case of collision on `code`
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabaseAdmin
      .from("arte_em_cards_codes")
      .insert({
        user_id: userId,
        code,
        cycle_start: cycleStart.toISOString(),
        cycle_end: cycleEnd.toISOString(),
      })
      .select("code, cycle_end")
      .maybeSingle();
    if (data) return { code: data.code, cycleStart, cycleEnd: new Date(data.cycle_end) };
    // Unique violation on (user_id, cycle_start) → another concurrent insert won
    if (error && (error.code === "23505")) {
      const after = await findActiveCodeForUser(userId);
      if (after) return after;
    }
  }
  throw new Error("Não foi possível gerar o código Arte em Cards. Tente novamente.");
}

/**
 * Validates a code for a given user. Returns the cycle end if valid,
 * otherwise an error reason.
 */
export async function validateCodeForUser(
  userId: string,
  rawCode: string,
): Promise<
  | { valid: true; code: string; cycleEnd: Date }
  | { valid: false; reason: string }
> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return { valid: false, reason: "Informe o código." };
  const { data } = await supabaseAdmin
    .from("arte_em_cards_codes")
    .select("user_id, code, cycle_start, cycle_end")
    .eq("code", code)
    .maybeSingle();
  if (!data) return { valid: false, reason: "Código não encontrado." };
  if (data.user_id !== userId)
    return { valid: false, reason: "Este código pertence a outro cliente." };
  const now = new Date();
  const end = new Date(data.cycle_end);
  if (now > end) return { valid: false, reason: "Este código expirou." };
  return { valid: true, code: data.code, cycleEnd: end };
}
