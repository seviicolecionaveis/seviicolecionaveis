import { Link } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import logoUrl from "@/assets/logo.png";

const BRAND = "#20a5c9";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-black px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
      {children}
    </span>
  );
}

const NAV_LINKS: { to: string; label: string }[] = [
  { to: "/", label: "Catálogo" },
  { to: "/imas", label: "Ímãs" },
  { to: "/selados", label: "Selados" },
  { to: "/sobre", label: "Sobre nós" },
  { to: "/faq", label: "Perguntas frequentes" },
  { to: "/favoritos", label: "Favoritos" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white mt-16 text-neutral-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-10">
          {/* Coluna 1 — Marca */}
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="Sevii Colecionáveis"
              width={224}
              height={56}
              className="h-16 w-auto mb-4"
            />
            <p className="text-sm leading-relaxed text-neutral-600 max-w-[260px]">
              Cartas Pokémon originais, com garantia de autenticidade e envio
              rastreado para todo o Brasil.
            </p>
          </div>

          {/* Coluna 2 — Navegação */}
          <div>
            <SectionTitle>Navegação</SectionTitle>
            <ul className="mt-4 space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-neutral-700 transition-colors hover:text-[color:var(--brand)]"
                    style={{ ["--brand" as never]: BRAND }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3 — Contato */}
          <div>
            <SectionTitle>Contato</SectionTitle>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0" style={{ color: BRAND }} />
                <a
                  href="https://wa.me/557998150955"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-700 transition-colors hover:text-[color:var(--brand)]"
                  style={{ ["--brand" as never]: BRAND }}
                >
                  (79) 9 9815-0955
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" style={{ color: BRAND }} />
                <a
                  href="mailto:seviicolecionaveis@gmail.com"
                  className="text-neutral-700 transition-colors hover:text-[color:var(--brand)]"
                  style={{ ["--brand" as never]: BRAND }}
                >
                  seviicolecionaveis@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" style={{ color: BRAND }} />
                <span>Aracaju, Sergipe — Brasil</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-border text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Sevii Colecionáveis. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
