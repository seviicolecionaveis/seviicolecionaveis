import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/cartas", label: "Cartas" },
  { to: "/sobre", label: "Sobre" },
  { to: "/faq", label: "FAQ" },
  { to: "/favoritos", label: "Favoritos" },
] as const;

export function SiteNav({ className = "" }: { className?: string }) {
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
    </nav>
  );
}
