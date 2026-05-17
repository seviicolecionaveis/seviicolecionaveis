// Compra automática de etiqueta Superfrete após pagamento aprovado.
// Fluxo: POST /api/v0/cart (adiciona ao carrinho) -> POST /api/v0/checkout (compra)
// Docs: https://docs.superfrete.com

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://api.superfrete.com";

// Remetente fixo: SeVII Colecionáveis
const SENDER = {
  name: "Sevii Colecionáveis",
  document: "66773191000132", // CNPJ só números
  company_document: "66773191000132",
  address: "Rua João Garcez Vieira",
  number: "60",
  complement: "",
  district: "Aeroporto",
  city: "Aracaju",
  state_abbr: "SE",
  postal_code: "49037320",
  phone: "79981509552",
  email: "seviicolecionaveis@gmail.com",
};

const DEFAULT_PACKAGE = { height: 4, width: 16, length: 24 };

function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

interface OrderRow {
  id: string;
  superfrete_service_id: string | null;
  superfrete_order_id: string | null;
  recipient_name: string;
  cpf: string | null;
  phone: string | null;
  email: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  shipping_method: string;
}

interface ItemRow {
  card_name: string;
  quantity: number;
  unit_price_cents: number;
}

async function superfreteFetch(path: string, body: unknown) {
  const token = process.env.SUPERFRETE_API_TOKEN;
  if (!token) throw new Error("SUPERFRETE_API_TOKEN não configurado.");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "SeVII Colecionaveis (contato@seviicolecionaveis.com.br)",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[Superfrete]", path, res.status, text.slice(0, 800));
    throw new Error(`Superfrete ${path} falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Superfrete ${path}: resposta inválida.`);
  }
}

/**
 * Compra a etiqueta para o pedido. Best-effort: se falhar, marca status
 * 'failed' no pedido e registra o erro mas não lança (não bloqueia o
 * pagamento). Idempotente: se já existe superfrete_order_id, não refaz.
 */
export async function purchaseShippingLabel(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, superfrete_service_id, superfrete_order_id, recipient_name, cpf, phone, email, cep, street, number, complement, neighborhood, city, state, shipping_method",
    )
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (!order) return;
  if (order.superfrete_order_id) return; // já comprou
  if (order.shipping_method !== "fixed") return; // cliente escolheu "combinar"
  if (!order.superfrete_service_id) {
    await markFailed(orderId, "Serviço Superfrete não definido no pedido.");
    return;
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_name, quantity, unit_price_cents")
    .eq("order_id", orderId);

  const products =
    (items ?? []).length > 0
      ? (items as ItemRow[]).map((i) => ({
          name: i.card_name.slice(0, 100),
          quantity: i.quantity,
          unitary_value: i.unit_price_cents / 100,
        }))
      : [{ name: "Pedido Sevii", quantity: 1, unitary_value: 1 }];

  const totalValue = products.reduce(
    (s, p) => s + p.unitary_value * p.quantity,
    0,
  );

  // Peso: 5g por carta + envelope 50g, mínimo 300g
  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const weightKg = Math.max(0.3, 0.05 + totalQty * 0.005);

  const cartBody = {
    from: SENDER,
    to: {
      name: order.recipient_name.slice(0, 100),
      address: order.street.slice(0, 100),
      complement: (order.complement ?? "").slice(0, 100),
      number: order.number.slice(0, 20),
      district: order.neighborhood.slice(0, 100),
      city: order.city.slice(0, 100),
      state_abbr: order.state.toUpperCase().slice(0, 2),
      country_id: "BR",
      postal_code: onlyDigits(order.cep),
      phone: onlyDigits(order.phone),
      email: order.email,
      document: onlyDigits(order.cpf),
    },
    service: Number(order.superfrete_service_id),
    products,
    volumes: [
      {
        ...DEFAULT_PACKAGE,
        weight: weightKg,
      },
    ],
    options: {
      insurance_value: totalValue,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: true,
      invoice: { key: "" },
      platform: "Sevii Colecionáveis",
      tags: [{ tag: orderId, url: null }],
    },
  };

  let cartId: string;
  try {
    const cart = await superfreteFetch("/api/v0/cart", cartBody);
    cartId = String(cart?.id ?? "");
    if (!cartId) throw new Error("Carrinho sem id na resposta.");
  } catch (e: any) {
    await markFailed(orderId, `cart: ${e?.message ?? "erro"}`);
    return;
  }

  try {
    const checkout = await superfreteFetch("/api/v0/checkout", {
      orders: [cartId],
    });
    // checkout retorna { purchase: { id, ... }, orders: [...] }
    const purchased = Array.isArray(checkout?.purchase?.orders)
      ? checkout.purchase.orders[0]
      : Array.isArray(checkout?.orders)
        ? checkout.orders[0]
        : null;

    const labelUrl: string | null =
      purchased?.tracking_url ??
      purchased?.self_tracking ??
      checkout?.purchase?.self_tracking ??
      null;

    const trackingCode: string | null =
      purchased?.tracking ??
      purchased?.protocol ??
      null;

    await supabaseAdmin
      .from("orders")
      .update({
        superfrete_order_id: cartId,
        superfrete_label_url: labelUrl,
        superfrete_status: "purchased",
        superfrete_error: null,
        tracking_code: trackingCode ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  } catch (e: any) {
    await markFailed(orderId, `checkout: ${e?.message ?? "erro"}`);
  }
}

async function markFailed(orderId: string, error: string) {
  console.error("[Superfrete] etiqueta falhou", orderId, error);
  await supabaseAdmin
    .from("orders")
    .update({
      superfrete_status: "failed",
      superfrete_error: error.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}
