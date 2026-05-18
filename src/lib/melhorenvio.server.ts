// Melhor Envio API client (server-only).
// Docs: https://docs.melhorenvio.com.br
// OAuth2 com refresh automático. Usa tabela `melhorenvio_tokens` (singleton id=1).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";

const ORIGIN_CEP = "49037320"; // SeVII Colecionáveis (Aracaju/SE)
const DEFAULT_PACKAGE = { height: 4, width: 16, length: 24, weight: 0.3 };
const USER_AGENT = "SeVII Colecionaveis (contato@seviicolecionaveis.com.br)";

function getEnv() {
  return (process.env.MELHORENVIO_ENVIRONMENT ?? "sandbox") as "sandbox" | "production";
}

export function getMelhorEnvioBaseUrl() {
  return getEnv() === "production"
    ? "https://www.melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";
}

export function getRedirectUri() {
  // URL pública estável do projeto. Cliente precisa cadastrar EXATAMENTE essa URI no painel ME.
  const base =
    process.env.MELHORENVIO_REDIRECT_BASE_URL ??
    "https://seviicolecionaveis.com.br";
  return `${base.replace(/\/$/, "")}/api/public/melhorenvio/callback`;
}

const SCOPES = [
  "shipping-calculate",
  "shipping-cart",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "cart-read",
  "cart-write",
].join(" ");

/* ---------------- CSRF state ---------------- */

function getStateSecret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.MELHORENVIO_CLIENT_SECRET;
  if (!s) throw new Error("Sem segredo para assinar state.");
  return s;
}

export function signState(payload: { uid: string; ts: number }) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyState(state: string): { uid: string; ts: number } | null {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Date.now() - payload.ts > 10 * 60 * 1000) return null; // 10 min
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- OAuth ---------------- */

export function buildAuthorizeUrl(state: string) {
  const clientId = process.env.MELHORENVIO_CLIENT_ID;
  if (!clientId) throw new Error("MELHORENVIO_CLIENT_ID não configurado.");
  const url = new URL(`${getMelhorEnvioBaseUrl()}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${getMelhorEnvioBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[MelhorEnvio] /oauth/token", res.status, text.slice(0, 500));
    throw new Error(`Falha OAuth Melhor Envio (${res.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

export async function exchangeCodeForToken(code: string) {
  const tokens = await postToken({
    grant_type: "authorization_code",
    client_id: process.env.MELHORENVIO_CLIENT_ID!,
    client_secret: process.env.MELHORENVIO_CLIENT_SECRET!,
    redirect_uri: getRedirectUri(),
    code,
  });
  await saveTokens(tokens);
  return tokens;
}

async function refreshTokens(refresh_token: string) {
  const tokens = await postToken({
    grant_type: "refresh_token",
    client_id: process.env.MELHORENVIO_CLIENT_ID!,
    client_secret: process.env.MELHORENVIO_CLIENT_SECRET!,
    refresh_token,
  });
  await saveTokens(tokens);
  return tokens;
}

async function saveTokens(tokens: TokenResponse) {
  const expires_at = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin.from("melhorenvio_tokens").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at,
    environment: getEnv(),
    scope: tokens.scope ?? SCOPES,
    updated_at: new Date().toISOString(),
  });
}

export async function getStoredTokens() {
  const { data } = await supabaseAdmin
    .from("melhorenvio_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

export async function deleteStoredTokens() {
  await supabaseAdmin.from("melhorenvio_tokens").delete().eq("id", 1);
}

/** Retorna access_token válido, renovando se necessário. */
async function getValidAccessToken(): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) throw new Error("Melhor Envio não conectado.");
  const exp = new Date(tokens.expires_at).getTime();
  if (Date.now() < exp - 30_000) return tokens.access_token;
  const refreshed = await refreshTokens(tokens.refresh_token);
  return refreshed.access_token;
}

/* ---------------- Quotes ---------------- */

export interface MelhorEnvioQuote {
  id: string;
  serviceId: number;
  serviceName: string;
  company: string;
  priceCents: number;
  deliveryDays: number | null;
  hasTracking: boolean;
}

interface MERaw {
  id?: number;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  discount?: string | number;
  delivery_time?: number;
  delivery_range?: { min?: number; max?: number };
  company?: { name?: string };
  has_error?: boolean;
  error?: string;
  additional_services?: { tracking?: boolean };
}

function parseMoneyToCents(v: unknown): number {
  if (typeof v === "number") return Math.round(v * 100);
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  return 0;
}

export async function getMelhorEnvioQuotes(params: {
  destinationCep: string;
  weightKg?: number;
}): Promise<MelhorEnvioQuote[]> {
  const to = params.destinationCep.replace(/\D/g, "");
  if (to.length !== 8) throw new Error("CEP de destino inválido.");

  const token = await getValidAccessToken();

  const body = {
    from: { postal_code: ORIGIN_CEP },
    to: { postal_code: to },
    package: {
      ...DEFAULT_PACKAGE,
      weight: params.weightKg && params.weightKg > 0 ? params.weightKg : DEFAULT_PACKAGE.weight,
    },
    options: {
      receipt: false,
      own_hand: false,
      insurance_value: 0,
    },
    services: "1,2,3,4,7,11,17", // Correios + Jadlog principais
  };

  const res = await fetch(`${getMelhorEnvioBaseUrl()}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[MelhorEnvio] calculate", res.status, text.slice(0, 500));
    throw new Error(`Falha cotação Melhor Envio (${res.status}).`);
  }

  let raw: MERaw[];
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida do Melhor Envio.");
  }
  if (!Array.isArray(raw)) return [];

  const quotes: MelhorEnvioQuote[] = [];
  for (const r of raw) {
    if (r.has_error || !r.id) continue;
    const cents = parseMoneyToCents(r.price ?? r.custom_price ?? 0);
    if (cents <= 0) continue;
    quotes.push({
      id: `melhorenvio:${r.id}`,
      serviceId: r.id,
      serviceName: r.name ?? `Serviço ${r.id}`,
      company: r.company?.name ?? "Correios",
      priceCents: cents,
      deliveryDays: r.delivery_time ?? r.delivery_range?.max ?? null,
      hasTracking: r.additional_services?.tracking ?? true,
    });
  }
  return quotes.sort((a, b) => a.priceCents - b.priceCents);
}
