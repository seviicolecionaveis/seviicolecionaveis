import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getOrCreateMpCustomer,
  listMpCustomerCards,
  deleteMpCustomerCard,
  type MpCustomerCard,
} from "@/lib/mercadopago.server";

export interface SavedCardRow {
  id: string;
  mp_customer_id: string;
  mp_card_id: string;
  last_four: string;
  brand: string | null;
  payment_method_id: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  created_at: string;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function getProfileName(userId: string): Promise<{ first: string; last: string }> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  const parts = (data?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "Cliente", last: parts.slice(1).join(" ") || "Sevii" };
}

/**
 * Devolve o mp_customer_id deste usuário, criando se necessário e armazenando em profiles.
 */
export async function ensureMpCustomerForUser(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("mp_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.mp_customer_id) return profile.mp_customer_id;

  const email = await getUserEmail(userId);
  if (!email) return null;
  const { first, last } = await getProfileName(userId);
  const customerId = await getOrCreateMpCustomer(email, first, last);
  await supabaseAdmin
    .from("profiles")
    .update({ mp_customer_id: customerId })
    .eq("user_id", userId);
  return customerId;
}

/**
 * Após um pagamento aprovado com customer_id, busca os cartões no MP e faz upsert
 * em saved_cards (idempotente — sempre reflete o estado do MP).
 */
export async function syncSavedCardsForUser(userId: string, customerId: string): Promise<void> {
  const cards = await listMpCustomerCards(customerId);
  for (const c of cards) {
    await supabaseAdmin
      .from("saved_cards")
      .upsert(
        {
          user_id: userId,
          mp_customer_id: customerId,
          mp_card_id: c.id,
          last_four: c.last_four_digits ?? "",
          brand: c.payment_method?.name ?? c.payment_method?.id ?? null,
          payment_method_id: c.payment_method?.id ?? null,
          exp_month: c.expiration_month ?? null,
          exp_year: c.expiration_year ?? null,
          cardholder_name: c.cardholder?.name ?? null,
        },
        { onConflict: "user_id,mp_card_id" },
      );
  }
}

export async function listSavedCardsServer(userId: string): Promise<SavedCardRow[]> {
  const { data, error } = await supabaseAdmin
    .from("saved_cards")
    .select("id, mp_customer_id, mp_card_id, last_four, brand, payment_method_id, exp_month, exp_year, cardholder_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedCardRow[];
}

export async function deleteSavedCardServer(userId: string, cardRowId: string): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from("saved_cards")
    .select("id, user_id, mp_customer_id, mp_card_id")
    .eq("id", cardRowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.user_id !== userId) throw new Error("Cartão não encontrado");

  // remove no MP antes (best-effort) e depois localmente
  try {
    await deleteMpCustomerCard(row.mp_customer_id, row.mp_card_id);
  } catch (e) {
    console.error("delete MP card failed (continuando)", e);
  }
  await supabaseAdmin.from("saved_cards").delete().eq("id", cardRowId);
}

/**
 * Devolve o customer_id deste usuário para uso no Card Brick (sem criar — só se já existe).
 */
export async function getMpCustomerIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("mp_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.mp_customer_id ?? null;
}
