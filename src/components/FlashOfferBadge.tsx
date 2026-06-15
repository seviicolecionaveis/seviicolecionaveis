import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

interface Props {
  discountPercent: number;
  endsAt: string;
  compact?: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "encerrada";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

export function FlashOfferBadge({ discountPercent, endsAt, compact }: Props) {
  const [remaining, setRemaining] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(endsAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-type-fire to-brand-gold text-white font-bold ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      title="Oferta relâmpago"
    >
      <Flame className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      -{discountPercent}% · {formatRemaining(remaining)}
    </span>
  );
}
