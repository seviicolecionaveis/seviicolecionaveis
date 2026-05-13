import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPixPayment, getPixPayment } from "@/lib/mercadopago.server";
import { markOrderPaid } from "@/lib/orders.server";

const ItemSchema = z.object({
  cardId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  image: z.string().max(500).optional().nullable(),
  collection: z.string().max(200).optional().nullable(),
  number: z.string().max(50).optional().nullable(),
  finish: z.string().max(50),
  language: z.string().max(50),
  condition: z.string().max(10).optional().nullable(),
  unitPrice: z.number().positive().max(100000),
  quantity: z.number().int().positive().max(100),
});

const AddressSchema = z.object({
  recipientName: z.string().min(2).max(150),
  cpf: z.string().max(20).optional().nullable(),
  phone: z.string().min(8).max(30),
  cep: z.string().min(8).max(10),
  street: z.string().min(2).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().min(1).max(150),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
});

const StripeInputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  shippingMethod: z.enum(["fixed", "arrange"]),
  address: AddressSchema,
  notes: z.string().max(500).optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

const PixInputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  shippingMethod: z.enum(["fixed", "arrange"]),
  address: AddressSchema,
  notes: z.string().max(500).optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
});

const SHIPPING_FIXED_CENTS = 2500;
const ADMIN_COUPON_CODE = "POKEAGIOTAGEM";
const ADMIN_COUPON_PERCENT = 30;
const FIRST_PURCHASE_COUPON = "PRIMEIRACOMPRA10";
const FIRST_PURCHASE_PERCENT = 10;
const STOCK_RESERVATION_MINUTES = 5;
const PIX_EXPIRES_MINUTES = 30;

// ---------- helpers ----------

async function validateCoupon(
  userId: string,
  rawCode: string | null | undefined,
  subtotalCents: number,
): Promise<{ discountCents: number; code: string | null }> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return { discountCents: 0, code: null };

  if (code === ADMIN_COUPON_CODE) {
    const { data: roleRow, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!roleRow) throw new Error("Cupom restrito a administradores");
    return {
      discountCents: Math.round((subtotalCents * ADMIN_COUPON_PERCENT) / 100),
      code: ADMIN_COUPON_CODE,
    };
  }

  if (code === FIRST_PURCHASE_COUPON) {
    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "paid");
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      throw new Error("Cupom PRIMEIRACOMPRA10 válido apenas para a primeira compra");
    }
    return {
      discountCents: Math.round((subtotalCents * FIRST_PURCHASE_PERCENT) / 100),
      code: FIRST_PURCHASE_COUPON,
    };
  }

  throw new Error("Cupom inválido");
}

type ResolvableItem = {
  cardId: string;
  name: string;
  collection?: string | null;
  number?: string | null;
  finish: string;
  language: string;
  condition?: string | null;
  quantity: number;
};

// The client sends a synthetic cardId (name__collection__number).
// Resolve it to the real cards.id UUID matching finish/language/condition.
async function resolveCardIds<T extends ResolvableItem>(items: T[]): Promise<T[]> {
  const resolved: T[] = [];
  for (const it of items) {
    let query = supabaseAdmin
      .from("cards")
      .select("id")
      .eq("name", it.name)
      .eq("finish", it.finish as never)
      .eq("language", it.language as never)
      .limit(1);
    if (it.collection) query = query.eq("collection", it.collection);
    if (it.number) query = query.eq("card_number", it.number);
    if (it.condition) query = query.eq("condition", it.condition as never);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(
        `Carta não encontrada no estoque: "${it.name}" (${it.finish}/${it.language}${it.condition ? "/" + it.condition : ""}).`,
      );
    }
    resolved.push({ ...it, cardId: data.id });
  }
  return resolved;
}

async function ensureAvailableStock(items: { cardId: string; quantity: number; name: string }[]) {
  for (const it of items) {
    const { data, error } = await supabaseAdmin.rpc("available_stock", { _card_id: it.cardId });
    if (error) throw new Error(error.message);
    const available = Number(data ?? 0);
    if (available < it.quantity) {
      throw new Error(
        `Estoque insuficiente para "${it.name}". Disponível: ${available}, solicitado: ${it.quantity}.`,
      );
    }
  }
}

async function createReservations(
  userId: string,
  orderId: string,
  items: { cardId: string; quantity: number }[],
  expiresAt: Date,
) {
  const rows = items.map((i) => ({
    user_id: userId,
    card_id: i.cardId,
    quantity: i.quantity,
    order_id: orderId,
    expires_at: expiresAt.toISOString(),
  }));
  const { error } = await supabaseAdmin.from("stock_reservations").insert(rows);
  if (error) throw new Error(error.message);
}

// ---------- STRIPE (cartão) ----------

export const createOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StripeInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);

    const subtotalCents = data.items.reduce(
      (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
      0,
    );
    const shippingCents = data.shippingMethod === "fixed" ? SHIPPING_FIXED_CENTS : 0;

    const { discountCents, code: appliedCoupon } = await validateCoupon(
      userId,
      data.couponCode,
      subtotalCents,
    );

    await ensureAvailableStock(data.items);

    const totalCents = subtotalCents - discountCents + shippingCents;

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "";

    const reservationExpires = new Date(Date.now() + STOCK_RESERVATION_MINUTES * 60 * 1000);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        payment_method: "stripe",
        shipping_method: data.shippingMethod,
        shipping_cost_cents: shippingCents,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        coupon_code: appliedCoupon,
        total_cents: totalCents,
        recipient_name: data.address.recipientName,
        cpf: data.address.cpf,
        phone: data.address.phone,
        email,
        cep: data.address.cep,
        street: data.address.street,
        number: data.address.number,
        complement: data.address.complement,
        neighborhood: data.address.neighborhood,
        city: data.address.city,
        state: data.address.state,
        notes: data.notes,
        stock_reservation_expires_at: reservationExpires.toISOString(),
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

    const orderItems = data.items.map((i) => ({
      order_id: order.id,
      card_id: i.cardId,
      card_name: i.name,
      card_image: i.image ?? null,
      collection: i.collection ?? null,
      card_number: i.number ?? null,
      finish: i.finish,
      language: i.language,
      condition: i.condition ?? null,
      quantity: i.quantity,
      unit_price_cents: Math.round(i.unitPrice * 100),
    }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsErr) throw new Error(itemsErr.message);

    await createReservations(userId, order.id, data.items, reservationExpires);

    const discountMultiplier = discountCents > 0 ? (subtotalCents - discountCents) / subtotalCents : 1;
    const lineItems = data.items.map((i) => {
      const original = Math.round(i.unitPrice * 100);
      const discounted = Math.round(original * discountMultiplier);
      return {
        price_data: {
          currency: "brl",
          product_data: {
            name: `${i.name} (${i.finish}, ${i.language}${i.condition ? `, ${i.condition}` : ""})${appliedCoupon ? ` — cupom ${appliedCoupon}` : ""}`,
            ...(i.image && i.image.startsWith("http") ? { images: [i.image] } : {}),
          },
          unit_amount: discounted,
        },
        quantity: i.quantity,
      };
    });
    if (shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: "brl",
          product_data: { name: "Frete (Mini Envios)" },
          unit_amount: shippingCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer_email: email,
      metadata: { orderId: order.id, userId },
      payment_intent_data: { metadata: { orderId: order.id, userId } },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return session.client_secret;
  });

// ---------- PIX (Mercado Pago) ----------

export const createPixOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PixInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const subtotalCents = data.items.reduce(
      (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
      0,
    );
    const shippingCents = data.shippingMethod === "fixed" ? SHIPPING_FIXED_CENTS : 0;

    const { discountCents, code: appliedCoupon } = await validateCoupon(
      userId,
      data.couponCode,
      subtotalCents,
    );

    await ensureAvailableStock(data.items);

    const totalCents = subtotalCents - discountCents + shippingCents;
    if (totalCents < 100) throw new Error("Valor mínimo para Pix: R$ 1,00");

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "";

    const reservationExpires = new Date(Date.now() + STOCK_RESERVATION_MINUTES * 60 * 1000);
    const pixExpires = new Date(Date.now() + PIX_EXPIRES_MINUTES * 60 * 1000);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        payment_method: "pix",
        shipping_method: data.shippingMethod,
        shipping_cost_cents: shippingCents,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        coupon_code: appliedCoupon,
        total_cents: totalCents,
        recipient_name: data.address.recipientName,
        cpf: data.address.cpf,
        phone: data.address.phone,
        email,
        cep: data.address.cep,
        street: data.address.street,
        number: data.address.number,
        complement: data.address.complement,
        neighborhood: data.address.neighborhood,
        city: data.address.city,
        state: data.address.state,
        notes: data.notes,
        stock_reservation_expires_at: reservationExpires.toISOString(),
        pix_expires_at: pixExpires.toISOString(),
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

    const orderItems = data.items.map((i) => ({
      order_id: order.id,
      card_id: i.cardId,
      card_name: i.name,
      card_image: i.image ?? null,
      collection: i.collection ?? null,
      card_number: i.number ?? null,
      finish: i.finish,
      language: i.language,
      condition: i.condition ?? null,
      quantity: i.quantity,
      unit_price_cents: Math.round(i.unitPrice * 100),
    }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsErr) throw new Error(itemsErr.message);

    await createReservations(userId, order.id, data.items, reservationExpires);

    // Build notification URL — must be a public absolute URL
    const baseUrl =
      process.env.PUBLIC_SITE_URL ??
      "https://seviicolecionaveis.lovable.app";
    const notificationUrl = `${baseUrl}/api/public/payments/mercadopago-webhook`;

    const [firstName, ...rest] = data.address.recipientName.trim().split(/\s+/);
    const lastName = rest.join(" ") || "Sevii";

    const pix = await createPixPayment({
      amountCents: totalCents,
      description: `Pedido Sevii Colecionáveis #${order.id.slice(0, 8)}`,
      payerEmail: email,
      payerFirstName: firstName,
      payerLastName: lastName,
      payerCpf: data.address.cpf,
      externalReference: order.id,
      notificationUrl,
      expiresInMinutes: PIX_EXPIRES_MINUTES,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        mercadopago_payment_id: String(pix.id),
        pix_qr_code: pix.qr_code,
        pix_qr_code_base64: pix.qr_code_base64,
        pix_expires_at: pix.date_of_expiration,
      })
      .eq("id", order.id);

    return {
      orderId: order.id,
      qrCode: pix.qr_code,
      qrCodeBase64: pix.qr_code_base64,
      expiresAt: pix.date_of_expiration,
      totalCents,
    };
  });

// ---------- Poll Pix status ----------

export const checkPixOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, payment_method, mercadopago_payment_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

    if (order.status === "paid") return { status: "paid" as const };

    if (order.payment_method === "pix" && order.mercadopago_payment_id) {
      try {
        const remote = await getPixPayment(order.mercadopago_payment_id);
        if (remote.status === "approved" && order.status !== "paid") {
          await markOrderPaid(order.id);
          return { status: "paid" as const };
        }
      } catch (e) {
        console.error("checkPixOrderStatus poll error", e);
      }
    }

    return { status: order.status as "pending" | "cancelled" | "paid" };
  });

