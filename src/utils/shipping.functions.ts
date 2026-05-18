import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QuoteInputSchema = z.object({
  destinationCep: z.string().min(8).max(10).regex(/^[\d-]+$/),
  itemsCount: z.number().int().min(1).max(500).optional(),
});

export const getShippingQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => QuoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getSuperfreteQuotes } = await import("@/lib/superfrete.server");
    const { getMelhorEnvioQuotes, getStoredTokens } = await import("@/lib/melhorenvio.server");
    // Cada carta ~5g; envelope vazio ~50g. Mínimo 300g (cabe em Mini Envios).
    const weightKg = Math.max(0.3, 0.05 + (data.itemsCount ?? 1) * 0.005);

    const meEnabled = !!(await getStoredTokens().catch(() => null));

    const [sfRes, meRes] = await Promise.allSettled([
      getSuperfreteQuotes({ destinationCep: data.destinationCep, weightKg }),
      meEnabled
        ? getMelhorEnvioQuotes({ destinationCep: data.destinationCep, weightKg })
        : Promise.resolve([]),
    ]);

    const quotes: Array<any> = [];
    let error: string | null = null;

    if (sfRes.status === "fulfilled") {
      quotes.push(...sfRes.value);
    } else {
      console.error("[getShippingQuotes] Superfrete erro:", sfRes.reason?.message);
      error = sfRes.reason?.message ?? "Falha Superfrete.";
    }
    if (meRes.status === "fulfilled") {
      quotes.push(...meRes.value);
    } else {
      console.error("[getShippingQuotes] MelhorEnvio erro:", meRes.reason?.message);
      // Não bloqueia: só loga. Se Superfrete deu certo, mantemos sem erro.
      if (!quotes.length) error = meRes.reason?.message ?? error ?? "Falha Melhor Envio.";
    }

    quotes.sort((a, b) => a.priceCents - b.priceCents);
    return { quotes, error };
  });
