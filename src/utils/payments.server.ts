import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPixPayment, getPixPayment, createCardPaymentMP } from "@/lib/mercadopago.server";
import { markOrderPaid, cancelOrder } from "@/lib/orders.server";
import type { CardInput, PixInput, StripeInput } from "./payments.schemas";
import { sendTransactionalEmailSafe } from "@/lib/email/send.server";

async function sendOrderReceivedEmail(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, email, recipient_name, total_cents, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.email) return;
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_name, quantity, unit_price_cents, finish, language, card_image")
    .eq("order_id", orderId);
  await sendTransactionalEmailSafe({
    templateName: "order-received",
    recipientEmail: order.email,
    idempotencyKey: `order-received-${order.id}`,
    templateData: {
      recipientName: order.recipient_name?.split(/\s+/)[0],
      orderId: order.id,
      items: items ?? [],
      totalCents: order.total_cents,
      paymentMethod: order.payment_method,
    },
  });
}

const SHIPPING_FIXED_CENTS = 2500;
const ADMIN_COUPON_CODE = "POKEAGIOTAGEM";
const ADMIN_COUPON_PERCENT = 30;
const FIRST_PURCHASE_COUPON = "PRIMEIRACOMPRA10";
const FIRST_PURCHASE_PERCENT = 10;
const PIX_EXPIRES_MINUTES = 30;

function computeShippingCents(input: {
  shippingMethod: "fixed" | "arrange";
  shippingQuote?: { priceCents: number } | null;
}): number {
  if (input.shippingQuote && input.shippingQuote.priceCents >= 0) {
    return input.shippingQuote.priceCents;
  }
  return input.shippingMethod === "fixed" ? SHIPPING_FIXED_CENTS : 0;
}

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
  image?: string | null;
  collection?: string | null;
  number?: string | null;
  finish: string;
  language: string;
  condition?: string | null;
  unitPrice: number;
  quantity: number;
};

function normalizeText(value: string) {
  return value.normalize("NFC").trim();
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) return value;
  const clean = normalizeText(value);
  return clean || null;
}

function finishKey(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeCheckoutItem<T extends ResolvableItem>(it: T): T {
  return {
    ...it,
    name: normalizeText(it.name),
    collection: normalizeOptionalText(it.collection),
    number: normalizeOptionalText(it.number),
    finish: finishKey(it.finish) === "ima" ? "Ímã" : normalizeText(it.finish),
    language: normalizeText(it.language),
    condition: normalizeOptionalText(it.condition),
  };
}

function isVirtualItem(it: { finish: string }) {
  return finishKey(it.finish) === "ima";
}

async function resolveCardIds<T extends ResolvableItem>(items: T[]): Promise<T[]> {
  const resolved: T[] = [];
  for (const raw of items) {
    const it = normalizeCheckoutItem(raw);
    if (isVirtualItem(it)) {
      resolved.push(it);
      continue;
    }
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

async function ensureAvailableStock(
  items: { cardId: string; quantity: number; name: string; finish: string }[],
) {
  for (const it of items) {
    if (isVirtualItem(it)) continue;
    const { data, error } = await supabaseAdmin
      .from("cards")
      .select("stock")
      .eq("id", it.cardId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const available = Number(data?.stock ?? 0);
    if (available < it.quantity) {
      throw new Error(
        `Estoque insuficiente para "${it.name}". Disponível: ${available}, solicitado: ${it.quantity}.`,
      );
    }
  }
}

export async function createOrderCheckoutServer(data: StripeInput, userId: string) {
  const env = data.environment as StripeEnv;
  const stripe = createStripeClient(env);

  const subtotalCents = data.items.reduce(
    (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
    0,
  );
  const shippingCents = computeShippingCents(data);

  const { discountCents, code: appliedCoupon } = await validateCoupon(
    userId,
    data.couponCode,
    subtotalCents,
  );

  const items = await resolveCardIds(data.items);
  await ensureAvailableStock(items);

  const totalCents = subtotalCents - discountCents + shippingCents;

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email ?? "";

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
      superfrete_service_id: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceId ?? null : null,
      superfrete_service_name: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceName ?? null : null,
    })
    .select("id")
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

  const orderItems = items.map((i) => ({
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
  await sendOrderReceivedEmail(order.id);

  const discountMultiplier =
    discountCents > 0 ? (subtotalCents - discountCents) / subtotalCents : 1;
  const lineItems = items.map((i) => {
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

  let returnUrl = data.returnUrl;
  try {
    const u = new URL(data.returnUrl);
    returnUrl = `${u.origin}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`;
  } catch {
    returnUrl = data.returnUrl;
  }

  const session = await stripe.checkout.sessions.create({
    line_items: lineItems,
    mode: "payment",
    ui_mode: "embedded_page",
    redirect_on_completion: "always",
    return_url: returnUrl,
    customer_email: email,
    metadata: { orderId: order.id, userId },
    payment_intent_data: { metadata: { orderId: order.id, userId } },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  await supabaseAdmin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return { clientSecret: session.client_secret, orderId: order.id };
}

export async function createPixOrderServer(data: PixInput, userId: string) {
  const subtotalCents = data.items.reduce(
    (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
    0,
  );
  const shippingCents = computeShippingCents(data);

  const { discountCents, code: appliedCoupon } = await validateCoupon(
    userId,
    data.couponCode,
    subtotalCents,
  );

  const items = await resolveCardIds(data.items);
  await ensureAvailableStock(items);

  const totalCents = subtotalCents - discountCents + shippingCents;
  if (totalCents < 100) throw new Error("Valor mínimo para Pix: R$ 1,00");

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email ?? "";

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
      pix_expires_at: pixExpires.toISOString(),
      superfrete_service_id: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceId ?? null : null,
      superfrete_service_name: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceName ?? null : null,
    })
    .select("id")
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

  const orderItems = items.map((i) => ({
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
  await sendOrderReceivedEmail(order.id);

  const baseUrl = process.env.PUBLIC_SITE_URL ?? "https://seviicolecionaveis.lovable.app";
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
}

export async function checkPixOrderStatusServer(orderId: string, userId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, payment_method, mercadopago_payment_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

  if (order.status === "paid") return { status: "paid" as const };

  if (order.payment_method === "pix" && order.mercadopago_payment_id) {
    try {
      const remote = await getPixPayment(order.mercadopago_payment_id);
      if (remote.status === "approved" && order.status !== "paid") {
        await markOrderPaid(order.id, { mercadopagoPaymentId: order.mercadopago_payment_id });
        return { status: "paid" as const };
      }
    } catch (e) {
      console.error("checkPixOrderStatus poll error", e);
    }
  }

  return { status: order.status as "pending" | "cancelled" | "paid" };
}

export async function createCardOrderServer(data: CardInput, userId: string) {
  const subtotalCents = data.items.reduce(
    (s, i) => s + Math.round(i.unitPrice * 100) * i.quantity,
    0,
  );
  const shippingCents = computeShippingCents(data);

  const { discountCents, code: appliedCoupon } = await validateCoupon(
    userId,
    data.couponCode,
    subtotalCents,
  );

  const items = await resolveCardIds(data.items);
  await ensureAvailableStock(items);

  const totalCents = subtotalCents - discountCents + shippingCents;
  if (totalCents < 100) throw new Error("Valor mínimo: R$ 1,00");

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email ?? data.card.payerEmail ?? "";

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      payment_method: "mercadopago_card",
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
      superfrete_service_id: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceId ?? null : null,
      superfrete_service_name: data.shippingMethod === "fixed" ? data.shippingQuote?.serviceName ?? null : null,
    })
    .select("id")
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

  const orderItems = items.map((i) => ({
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
  await sendOrderReceivedEmail(order.id);

  const baseUrl = process.env.PUBLIC_SITE_URL ?? "https://seviicolecionaveis.lovable.app";
  const notificationUrl = `${baseUrl}/api/public/payments/mercadopago-webhook`;

  const [firstName, ...rest] = data.address.recipientName.trim().split(/\s+/);
  const lastName = rest.join(" ") || "Sevii";

  try {
    const result = await createCardPaymentMP({
      amountCents: totalCents,
      description: `Pedido Sevii Colecionáveis #${order.id.slice(0, 8)}`,
      token: data.card.token,
      paymentMethodId: data.card.paymentMethodId,
      issuerId: data.card.issuerId ?? null,
      installments: data.card.installments,
      payerEmail: data.card.payerEmail || email,
      payerFirstName: firstName,
      payerLastName: lastName,
      payerCpf: data.card.payerCpf ?? data.address.cpf ?? null,
      externalReference: order.id,
      notificationUrl,
    });

    await supabaseAdmin
      .from("orders")
      .update({ mercadopago_payment_id: String(result.id) })
      .eq("id", order.id);

    if (result.status === "approved") {
      await markOrderPaid(order.id, { mercadopagoPaymentId: String(result.id) });
      return { orderId: order.id, status: "approved" as const };
    }
    if (result.status === "in_process" || result.status === "pending" || result.status === "authorized") {
      return { orderId: order.id, status: "in_process" as const, statusDetail: result.status_detail };
    }
    // rejected / cancelled
    await cancelOrder(order.id);
    return {
      orderId: order.id,
      status: "rejected" as const,
      statusDetail: result.status_detail ?? "Pagamento recusado",
    };
  } catch (e) {
    await cancelOrder(order.id);
    throw e;
  }
}

// =========================================================================
// Resume / change payment for an existing pending order
// =========================================================================

export async function regeneratePixForExistingOrderServer(orderId: string, userId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, user_id, status, total_cents, email, recipient_name, cpf",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");
  if (order.status !== "pending") throw new Error("Este pedido não está mais pendente.");

  const baseUrl = process.env.PUBLIC_SITE_URL ?? "https://seviicolecionaveis.lovable.app";
  const notificationUrl = `${baseUrl}/api/public/payments/mercadopago-webhook`;

  const [firstName, ...rest] = (order.recipient_name ?? "Cliente").trim().split(/\s+/);
  const lastName = rest.join(" ") || "Sevii";

  const pix = await createPixPayment({
    amountCents: order.total_cents,
    description: `Pedido Sevii Colecionáveis #${order.id.slice(0, 8)}`,
    payerEmail: order.email ?? "",
    payerFirstName: firstName,
    payerLastName: lastName,
    payerCpf: order.cpf ?? null,
    externalReference: order.id,
    notificationUrl,
    expiresInMinutes: PIX_EXPIRES_MINUTES,
  });

  await supabaseAdmin
    .from("orders")
    .update({
      payment_method: "pix",
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
    totalCents: order.total_cents,
  };
}

export async function payExistingOrderWithCardServer(
  orderId: string,
  userId: string,
  card: {
    token: string;
    paymentMethodId: string;
    issuerId?: string | null;
    installments: number;
    payerEmail?: string | null;
    payerCpf?: string | null;
  },
) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, total_cents, email, recipient_name, cpf")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");
  if (order.status !== "pending") throw new Error("Este pedido não está mais pendente.");

  const baseUrl = process.env.PUBLIC_SITE_URL ?? "https://seviicolecionaveis.lovable.app";
  const notificationUrl = `${baseUrl}/api/public/payments/mercadopago-webhook`;

  const [firstName, ...rest] = (order.recipient_name ?? "Cliente").trim().split(/\s+/);
  const lastName = rest.join(" ") || "Sevii";

  const result = await createCardPaymentMP({
    amountCents: order.total_cents,
    description: `Pedido Sevii Colecionáveis #${order.id.slice(0, 8)}`,
    token: card.token,
    paymentMethodId: card.paymentMethodId,
    issuerId: card.issuerId ?? null,
    installments: card.installments,
    payerEmail: card.payerEmail || order.email || "",
    payerFirstName: firstName,
    payerLastName: lastName,
    payerCpf: card.payerCpf ?? order.cpf ?? null,
    externalReference: order.id,
    notificationUrl,
  });

  await supabaseAdmin
    .from("orders")
    .update({
      payment_method: "mercadopago_card",
      mercadopago_payment_id: String(result.id),
    })
    .eq("id", order.id);

  if (result.status === "approved") {
    await markOrderPaid(order.id, { mercadopagoPaymentId: String(result.id) });
    return { orderId: order.id, status: "approved" as const };
  }
  if (
    result.status === "in_process" ||
    result.status === "pending" ||
    result.status === "authorized"
  ) {
    return {
      orderId: order.id,
      status: "in_process" as const,
      statusDetail: result.status_detail,
    };
  }
  return {
    orderId: order.id,
    status: "rejected" as const,
    statusDetail: result.status_detail ?? "Pagamento recusado",
  };
}

export async function resendPendingOrderEmailsServer() {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, email, recipient_name, total_cents, payment_method")
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  const stamp = Date.now();
  let sent = 0;
  for (const order of orders ?? []) {
    if (!order.email) continue;
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("card_name, quantity, unit_price_cents, finish, language, card_image")
      .eq("order_id", order.id);
    await sendTransactionalEmailSafe({
      templateName: "order-received",
      recipientEmail: order.email,
      idempotencyKey: `order-received-${order.id}-resend-${stamp}`,
      templateData: {
        recipientName: order.recipient_name?.split(/\s+/)[0],
        orderId: order.id,
        items: items ?? [],
        totalCents: order.total_cents,
        paymentMethod: order.payment_method,
      },
    });
    sent++;
  }
  return { sent, total: orders?.length ?? 0 };
}
