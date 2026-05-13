// Mercado Pago server helper — Pix only.
// Docs: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post

const MP_API = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return token;
}

export interface CreatePixInput {
  amountCents: number;
  description: string;
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  payerCpf?: string | null;
  externalReference: string; // order id
  notificationUrl: string;
  expiresInMinutes?: number; // default 30
}

export interface PixPayment {
  id: number;
  status: string; // pending, approved, rejected, cancelled, in_process
  status_detail?: string;
  qr_code: string;
  qr_code_base64: string;
  date_of_expiration: string;
  ticket_url?: string;
}

export async function createPixPayment(input: CreatePixInput): Promise<PixPayment> {
  const token = getAccessToken();
  const expiresMin = input.expiresInMinutes ?? 30;
  const expirationDate = new Date(Date.now() + expiresMin * 60 * 1000).toISOString();
  const cleanCpf = input.payerCpf?.replace(/\D/g, "") || undefined;

  const body: Record<string, unknown> = {
    transaction_amount: Number((input.amountCents / 100).toFixed(2)),
    description: input.description.slice(0, 250),
    payment_method_id: "pix",
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    date_of_expiration: expirationDate,
    payer: {
      email: input.payerEmail,
      first_name: input.payerFirstName?.slice(0, 50) ?? "Cliente",
      last_name: input.payerLastName?.slice(0, 50) ?? "Sevii",
      ...(cleanCpf && cleanCpf.length === 11
        ? { identification: { type: "CPF", number: cleanCpf } }
        : {}),
    },
  };

  const idempotencyKey = `${input.externalReference}-${Date.now()}`;

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("MP create payment failed", res.status, text);
    throw new Error(`Mercado Pago erro ${res.status}: ${text.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const tx = json.point_of_interaction?.transaction_data;
  if (!tx?.qr_code || !tx?.qr_code_base64) {
    throw new Error("Resposta do Mercado Pago sem QR Code Pix");
  }

  return {
    id: json.id,
    status: json.status,
    status_detail: json.status_detail,
    qr_code: tx.qr_code,
    qr_code_base64: tx.qr_code_base64,
    date_of_expiration: json.date_of_expiration ?? expirationDate,
    ticket_url: tx.ticket_url,
  };
}

export async function getPixPayment(paymentId: string | number): Promise<{ status: string; external_reference?: string }> {
  const token = getAccessToken();
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP get payment ${res.status}: ${text.slice(0, 200)}`);
  }
  const json: any = await res.json();
  return { status: json.status, external_reference: json.external_reference };
}
