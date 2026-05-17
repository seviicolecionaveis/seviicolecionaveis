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
    // Cada carta ~5g; envelope vazio ~50g. Mínimo 300g (cabe em Mini Envios).
    const weightKg = Math.max(0.3, 0.05 + (data.itemsCount ?? 1) * 0.005);
    try {
      const quotes = await getSuperfreteQuotes({
        destinationCep: data.destinationCep,
        weightKg,
      });
      return { quotes, error: null as string | null };
    } catch (e: any) {
      console.error("[getShippingQuotes] erro:", e?.message);
      return { quotes: [], error: e?.message ?? "Falha ao consultar frete." };
    }
  });
