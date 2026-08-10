// Superfrete API client (server-only).
// Docs: https://docs.superfrete.com
// Endpoint: POST /api/v0/calculator — returns quotes for the given package.

const PROD_BASE = "https://api.superfrete.com";
// Origem fixa: SeVII Colecionáveis (Aracaju/SE)
const ORIGIN_CEP = "49037320";
// Pacote padrão de cartas (envelope rígido): 16x24x4 cm, 300g
const DEFAULT_PACKAGE = {
  height: 4,
  width: 16,
  length: 24,
  weight: 0.3,
};

export interface SuperfreteQuote {
  id: string;          // "superfrete:1" | "superfrete:2" | etc.
  serviceId: number;   // 1=PAC, 2=SEDEX, 17=Mini Envios
  serviceName: string; // "Mini Envios" | "PAC" | "SEDEX"
  company: string;     // "Correios" | "Jadlog"...
  priceCents: number;
  deliveryDays: number | null;
  hasTracking: boolean;
}

interface SuperfreteRaw {
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
}

function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

function parseMoneyToCents(v: unknown): number {
  if (typeof v === "number") return Math.round(v * 100);
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  return 0;
}

export async function getSuperfreteQuotes(params: {
  destinationCep: string;
  weightKg?: number;
}): Promise<SuperfreteQuote[]> {
  const token = process.env.SUPERFRETE_API_TOKEN;
  if (!token) throw new Error("SUPERFRETE_API_TOKEN não configurado.");

  const to = normalizeCep(params.destinationCep);
  if (to.length !== 8) throw new Error("CEP de destino inválido.");

  const body = {
    from: { postal_code: ORIGIN_CEP },
    to: { postal_code: to },
    services: "1,2,17", // PAC, SEDEX, Mini Envios
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: 0,
      use_insurance_value: false,
    },
    package: {
      ...DEFAULT_PACKAGE,
      // Correios recusa acima de 30 kg — limita para não gerar erro 400.
      weight: Math.min(
        30,
        params.weightKg && params.weightKg > 0 ? params.weightKg : DEFAULT_PACKAGE.weight,
      ),
    },
  };

  const res = await fetch(`${PROD_BASE}/api/v0/calculator`, {
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
    console.error("[Superfrete] HTTP", res.status, text.slice(0, 500));
    throw new Error(superfreteErrorMessage(res.status, text));
  }


  let raw: SuperfreteRaw[];
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida do Superfrete.");
  }
  if (!Array.isArray(raw)) {
    console.error("[Superfrete] resposta inesperada:", text.slice(0, 500));
    return [];
  }

  const quotes: SuperfreteQuote[] = [];
  for (const r of raw) {
    if (r.has_error || !r.id) continue;
    const cents = parseMoneyToCents(r.price ?? r.custom_price ?? 0);
    if (cents <= 0) continue;
    quotes.push({
      id: `superfrete:${r.id}`,
      serviceId: r.id,
      serviceName: r.name ?? `Serviço ${r.id}`,
      company: r.company?.name ?? "Correios",
      priceCents: cents,
      deliveryDays: r.delivery_time ?? r.delivery_range?.max ?? null,
      hasTracking: true,
    });
  }
  return quotes.sort((a, b) => a.priceCents - b.priceCents);
}
