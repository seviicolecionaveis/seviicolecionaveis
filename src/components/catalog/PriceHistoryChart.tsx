import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { getCardPriceHistory } from "@/lib/card-price-history.functions";

type Props = { cardId: string };

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function PriceHistoryChart({ cardId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cardPriceHistory", cardId],
    queryFn: () => getCardPriceHistory({ data: { cardId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-xs text-muted-foreground">Carregando histórico de preço...</p>
      </div>
    );
  }

  if (!data || (data.points.length === 0 && data.current == null && data.ligaPrice == null)) {
    return null;
  }

  const chartData = data.points.map((p) => ({
    date: new Date(p.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    price: p.price,
  }));

  const variation = data.variation30dPercent;
  const varColor =
    variation == null
      ? "text-muted-foreground"
      : variation < -0.5
        ? "text-emerald-600"
        : variation > 0.5
          ? "text-rose-600"
          : "text-muted-foreground";
  const VarIcon =
    variation == null
      ? Minus
      : variation < -0.5
        ? TrendingDown
        : variation > 0.5
          ? TrendingUp
          : Minus;

  return (
    <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de preço
        </h3>
        {variation != null && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${varColor}`}>
            <VarIcon className="h-3.5 w-3.5" />
            {variation > 0 ? "+" : ""}
            {variation.toFixed(1)}% (30d)
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Atual" value={formatBRL(data.current)} highlight />
        <Stat label="Mínimo" value={formatBRL(data.min)} />
        <Stat label="Máximo" value={formatBRL(data.max)} />
        <Stat label="Liga Pokémon" value={formatBRL(data.ligaPrice)} />
      </div>

      {chartData.length >= 2 ? (
        <div className="mt-4 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} width={55} />
              <Tooltip
                formatter={(v: number) => [formatBRL(v), "Preço"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Ainda não há variações registradas. O gráfico aparecerá quando o preço mudar.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${highlight ? "text-foreground" : "text-foreground/80"}`}>
        {value}
      </p>
    </div>
  );
}
