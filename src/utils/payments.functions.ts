import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const InputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  shippingMethod: z.enum(["fixed", "arrange"]),
  address: AddressSchema,
  notes: z.string().max(500).optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

const SHIPPING_FIXED_CENTS = 2500; // R$ 25,00
const ADMIN_COUPON_CODE = "POKEAGIOTAGEM";
const ADMIN_COUPON_PERCENT = 30;

export const createOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);

    const subtotalCents = data.items.reduce(
      (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
      0,
    );
    const shippingCents = data.shippingMethod === "fixed" ? SHIPPING_FIXED_CENTS : 0;

    // Validate coupon (admin-only)
    let discountCents = 0;
    let appliedCoupon: string | null = null;
    const submittedCoupon = data.couponCode?.trim().toUpperCase() ?? "";
    if (submittedCoupon) {
      if (submittedCoupon !== ADMIN_COUPON_CODE) {
        throw new Error("Cupom inválido");
      }
      const { data: roleRow, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr) throw new Error(roleErr.message);
      if (!roleRow) throw new Error("Cupom restrito a administradores");
      discountCents = Math.round((subtotalCents * ADMIN_COUPON_PERCENT) / 100);
      appliedCoupon = ADMIN_COUPON_CODE;
    }

    const totalCents = subtotalCents - discountCents + shippingCents;

    // Get user email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "";

    // Create order (status pending)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
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

    // Build Stripe line items (apply coupon discount per-item if active)
    const discountMultiplier = appliedCoupon ? (100 - ADMIN_COUPON_PERCENT) / 100 : 1;
    const lineItems = data.items.map((i) => {
      const original = Math.round(i.unitPrice * 100);
      const discounted = Math.round(original * discountMultiplier);
      return {
        price_data: {
          currency: "brl",
          product_data: {
            name: `${i.name} (${i.finish}, ${i.language}${i.condition ? `, ${i.condition}` : ""})${appliedCoupon ? ` — cupom ${appliedCoupon} -${ADMIN_COUPON_PERCENT}%` : ""}`,
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
    });

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return session.client_secret;
  });
