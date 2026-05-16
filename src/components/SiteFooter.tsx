import { Link } from "@tanstack/react-router";
import { Mail, ShieldCheck, Truck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/30 mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-3 gap-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest mb-3">
              Sevii Colecionáveis
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cartas Pokémon originais, com garantia de autenticidade e envio
              rastreado para todo o Brasil.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">
              Loja
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:underline">Catálogo</Link>
              </li>
              <li>
                <Link to="/sobre" className="hover:underline">Sobre nós</Link>
              </li>
              <li>
                <Link to="/faq" className="hover:underline">Perguntas frequentes</Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">
              Garantias
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% originais
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" /> Envio rastreado
              </li>
              <li className="flex items-center gap-2 pt-1">
                <Mail className="h-3.5 w-3.5" />
                <a
                  href="mailto:seviicolecionaveis@gmail.com"
                  className="hover:text-foreground hover:underline"
                >
                  seviicolecionaveis@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-border text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Sevii Colecionáveis. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
