import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const LINKS = [
  { to: "/cartas", label: "Cartas" },
  { to: "/imas", label: "Ímãs" },
  { to: "/acessorios", label: "Acessórios" },
  { to: "/selados", label: "Selados" },
  { to: "/sobre", label: "Sobre" },
  { to: "/favoritos", label: "Favoritos" },
] as const;

const FAQ_GROUP = [
  { to: "/faq", label: "Dúvidas (FAQ)" },
  { to: "/tipos-de-carta", label: "Tipos de Carta" },
  { to: "/envios", label: "Envios e Retirada" },
] as const;

export function SiteNav({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const faqActive = FAQ_GROUP.some((l) => pathname === l.to);

  return (
    <nav className={`items-center gap-1 ${className}`}>
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-foreground text-background hover:bg-foreground hover:text-background" }}
        >
          {l.label}
        </Link>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              faqActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            Dúvidas (FAQ)
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-56 p-1">
          {FAQ_GROUP.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-secondary"
              activeProps={{ className: "bg-secondary font-semibold" }}
            >
              {l.label}
            </Link>
          ))}
        </PopoverContent>
      </Popover>
    </nav>
  );
}
