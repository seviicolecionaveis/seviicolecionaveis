import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminStackItem {
  id: string;
  card_id: string;
  card_name: string;
  card_image: string | null;
  collection: string | null;
  card_number: string | null;
  finish: string | null;
  language: string | null;
  condition: string | null;
  quantity: number;
  unit_price_cents: number;
  order_id: string;
  status: string;
  service_order_id: string | null;
}

export interface AdminServiceOrder {
  id: string;
  code: number;
  user_id: string;
  method: string;
  status: string;
  amount_cents: number;
  shipping_cost_cents: number;
  recipient_name: string | null;
  phone: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  arte_em_cards_code: string | null;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  items: AdminStackItem[];
}

export interface AdminStack {
  id: string;
  user_id: string;
  started_at: string;
  expires_at: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  items: AdminStackItem[];
}

async function ensureAdmin(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas administradores.");
}

export const adminGetPilhaData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ serviceOrders: AdminServiceOrder[]; stacks: AdminStack[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const [{ data: osRows }, { data: stackRows }] = await Promise.all([
      supabaseAdmin
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("card_stacks")
        .select("*")
        .eq("status", "active")
        .order("expires_at", { ascending: true }),
    ]);

    const orders = osRows ?? [];
    const stacks = stackRows ?? [];
    const osIds = orders.map((o: any) => o.id);
    const stackIds = stacks.map((s: any) => s.id);

    const [{ data: osItems }, { data: stackItems }] = await Promise.all([
      osIds.length
        ? supabaseAdmin.from("card_stack_items").select("*").in("service_order_id", osIds)
        : Promise.resolve({ data: [] as any[] }),
      stackIds.length
        ? supabaseAdmin
            .from("card_stack_items")
            .select("*")
            .in("stack_id", stackIds)
            .eq("status", "stored")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const allUserIds = Array.from(
      new Set<string>([
        ...orders.map((o: any) => o.user_id),
        ...stacks.map((s: any) => s.user_id),
      ]),
    );

    const profileMap = new Map<string, { name: string | null; email: string | null }>();
    if (allUserIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", allUserIds);
      (profiles ?? []).forEach((p: any) =>
        profileMap.set(p.user_id, { name: p.full_name ?? null, email: null }),
      );
      // emails via auth admin
      for (const uid of allUserIds) {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
          const prev = profileMap.get(uid) ?? { name: null, email: null };
          profileMap.set(uid, { name: prev.name, email: data?.user?.email ?? null });
        } catch {
          // ignore
        }
      }
    }

    const byOs: Record<string, AdminStackItem[]> = {};
    (osItems ?? []).forEach((it: any) => {
      (byOs[it.service_order_id] ??= []).push(it);
    });
    const byStack: Record<string, AdminStackItem[]> = {};
    (stackItems ?? []).forEach((it: any) => {
      (byStack[it.stack_id] ??= []).push(it);
    });

    return {
      serviceOrders: orders.map((o: any) => ({
        ...o,
        customer_name: profileMap.get(o.user_id)?.name ?? null,
        customer_email: profileMap.get(o.user_id)?.email ?? null,
        items: byOs[o.id] ?? [],
      })),
      stacks: stacks.map((s: any) => ({
        ...s,
        customer_name: profileMap.get(s.user_id)?.name ?? null,
        customer_email: profileMap.get(s.user_id)?.email ?? null,
        items: byStack[s.id] ?? [],
      })),
    };
  });

export const adminAdjustStackItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        itemId: z.string().uuid(),
        newQuantity: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    if (data.newQuantity === 0) {
      const { error } = await supabaseAdmin
        .from("card_stack_items")
        .delete()
        .eq("id", data.itemId);
      if (error) throw new Error(error.message);
      return { ok: true, removed: true };
    }

    const { error } = await supabaseAdmin
      .from("card_stack_items")
      .update({ quantity: data.newQuantity })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true, removed: false };
  });
