import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/SiteFooter";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/sorteios/")({
  head: () => ({
    meta: [
      { title: "Sorteios — Sevii Colecionáveis" },
      { name: "description", content: "Participe dos sorteios de produtos com estoque limitado da Sevii Colecionáveis." },
      { property: "og:title", content: "Sorteios — Sevii Colecionáveis" },
      { property: "og:description", content: "Participe dos sorteios de produtos com estoque limitado da Sevii Colecionáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RafflesIndex,
});

export const RAFFLE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  open: "Inscrições abertas",
  closed: "Inscrições encerradas",
  drawn: "Sorteio realizado",
  payment: "Pagamento em andamento",
  finished: "Finalizado",
};

interface RaffleRow {
  id: string;
  title: string;
  product_name: string;
  product_image: string | null;
  units: number;
  opens_at: string;
  closes_at: string;
  draw_at: string | null;
  status: string;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function RafflesIndex() {
  const [rows, setRows] = useState<RaffleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from("raffles")
      .select("id, title, product_name, product_image, units, opens_at, closes_at, draw_at, status")
      .neq("status", "draft")
      .order("closes_at", { ascending: false })
      .then(({ data }: { data: RaffleRow[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Sorteios</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Produtos com estoque extremamente limitado são distribuídos por sorteio. Participe gratuitamente estando logado.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sorteio disponível no momento.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/sorteios/$raffleId"
                  params={{ raffleId: r.id }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-foreground/40 transition"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {r.product_image ? (
                      <img src={r.product_image} alt={r.product_name} className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.units} {r.units === 1 ? "unidade" : "unidades"} · inscrições até {fmt(r.closes_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                    {RAFFLE_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
