import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StackItemDTO {
  id: string;
  cardId: string;
  cardName: string;
  cardImage: string | null;
  collection: string | null;
  cardNumber: string | null;
  finish: string | null;
  language: string | null;
  condition: string | null;
  quantity: number;
  orderId: string;
  orderCreatedAt: string | null;
  status: string;
  createdAt: string;
}

export interface StackDTO {
  id: string;
  startedAt: string;
  expiresAt: string;
  status: string;
  totalCards: number;
  totalOrders: number;
  items: StackItemDTO[];
}

export const getMyStack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StackDTO | null> => {
    const { supabase, userId } = context;

    const { data: stack, error: stackErr } = await supabase
      .from("card_stacks")
      .select("id, started_at, expires_at, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (stackErr) throw new Error(stackErr.message);
    if (!stack) return null;

    const { data: items, error: itemsErr } = await supabase
      .from("card_stack_items")
      .select(
        "id, card_id, card_name, card_image, collection, card_number, finish, language, condition, quantity, order_id, status, created_at",
      )
      .eq("stack_id", stack.id)
      .eq("status", "stored")
      .order("created_at", { ascending: false });

    if (itemsErr) throw new Error(itemsErr.message);

    const orderIds = Array.from(new Set((items ?? []).map((i) => i.order_id)));
    let createdAtByOrder = new Map<string, string>();
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, created_at")
        .in("id", orderIds);
      createdAtByOrder = new Map((orders ?? []).map((o) => [o.id, o.created_at]));
    }

    const dtoItems: StackItemDTO[] = (items ?? []).map((i) => ({
      id: i.id,
      cardId: i.card_id,
      cardName: i.card_name,
      cardImage: i.card_image,
      collection: i.collection,
      cardNumber: i.card_number,
      finish: i.finish,
      language: i.language,
      condition: i.condition,
      quantity: i.quantity,
      orderId: i.order_id,
      orderCreatedAt: createdAtByOrder.get(i.order_id) ?? null,
      status: i.status,
      createdAt: i.created_at,
    }));

    const totalCards = dtoItems.reduce((s, i) => s + i.quantity, 0);

    return {
      id: stack.id,
      startedAt: stack.started_at,
      expiresAt: stack.expires_at,
      status: stack.status,
      totalCards,
      totalOrders: orderIds.length,
      items: dtoItems,
    };
  });
