import { Link } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import logoUrl from "@/assets/logo.png";
import { subscribeNewsletter } from "@/lib/newsletter.functions";

const BRAND = "#20a5c9";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const subscribe = useServerFn(subscribeNewsletter);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    try {
      await subscribe({ data: { email: value } });
      setDone(true);
      setEmail("");
      toast.success("Inscrição confirmada! Bem-vindo(a) à Sevii. 🎉");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível inscrever agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
        Pronto! Você receberá novidades, lançamentos e promoções da Sevii.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <p className="text-xs text-neutral-600 leading-relaxed">
        Receba lançamentos, promoções exclusivas e novidades direto no seu e-mail.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 min-w-0 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
          style={{ ["--brand" as never]: BRAND }}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: BRAND }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Inscrever
        </button>
      </div>
    </form>
  );
}

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
