import { ShieldCheck, Truck, Lock } from "lucide-react";

interface TrustBadgesProps {
  variant?: "row" | "compact";
}

export function TrustBadges({ variant = "row" }: TrustBadgesProps) {
  const items = [
    { icon: ShieldCheck, label: "Cartas 100% originais", sub: "Garantia de autenticidade" },
    { icon: Truck, label: "Envio rastreado", sub: "Postagem em até 2 dias úteis" },
    { icon: Lock, label: "Pagamento seguro", sub: "Pix e cartão via Mercado Pago" },
  ];

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center max-w-2xl mx-auto">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/60">
            <Icon className="h-5 w-5 text-foreground" />
            <p className="text-[11px] font-semibold leading-tight">{label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-4 justify-items-center sm:justify-items-stretch">
        {items.map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background border border-border">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold leading-tight">{label}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-0.5">
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
