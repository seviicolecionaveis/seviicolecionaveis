import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Perguntas frequentes — Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Tire suas dúvidas sobre prazos de envio, condição das cartas (NM, LP, MP), formas de pagamento, autenticidade e mais.",
      },
      { property: "og:title", content: "FAQ — Sevii Colecionáveis" },
      {
        property: "og:description",
        content:
          "Dúvidas sobre envio, condição das cartas e pagamento na Sevii Colecionáveis.",
      },
      {
        property: "og:url",
        content: "https://seviicolecionaveis.lovable.app/faq",
      },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.lovable.app/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "As cartas são originais?",
    a: "Sim, 100%. Todas as cartas passam por verificação antes do envio. Vendemos somente cartas originais da Pokémon Company / Wizards of the Coast.",
  },
  {
    q: "O que significa NM, LP, MP, HP?",
    a: "São classificações de condição: NM (Near Mint) — quase perfeita; LP (Lightly Played) — sinais mínimos de uso; MP (Moderately Played) — desgaste visível mas íntegra; HP (Heavily Played) — desgaste forte mas jogável/colecionável.",
  },
  {
    q: "Quais são as formas de pagamento?",
    a: "Aceitamos Pix (com QR Code) e cartão de crédito via Mercado Pago. O Pix tem confirmação imediata; o cartão depende da aprovação da operadora.",
  },
  {
    q: "Qual o prazo de envio?",
    a: "Postamos em até 2 dias úteis após a confirmação do pagamento. O prazo de entrega depois disso depende dos Correios e da sua região (geralmente 3 a 10 dias úteis).",
  },
  {
    q: "Como as cartas são embaladas?",
    a: "Cada carta vai em sleeve protetora, dentro de toploader rígido, e envelopada em embalagem reforçada para evitar dobras e umidade durante o transporte.",
  },
  {
    q: "Posso rastrear meu pedido?",
    a: "Sim. Assim que postamos, você recebe o código de rastreio dos Correios por e-mail.",
  },
  {
    q: "Tenho 30 minutos para pagar — por quê?",
    a: "Reservamos o estoque das suas cartas durante 30 minutos enquanto você finaliza o pagamento. Se não confirmar nesse prazo, o pedido é cancelado automaticamente e as cartas voltam ao catálogo.",
  },
  {
    q: "Vocês têm loja física?",
    a: "Não, somos uma loja 100% online. Isso nos permite manter preços competitivos e atender todo o Brasil.",
  },
  {
    q: "Como entro em contato?",
    a: "Você pode falar com a gente direto pelo e-mail seviicolecionaveis@gmail.com — respondemos pessoalmente.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          FAQ
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold">Perguntas frequentes</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Não encontrou sua resposta? Mande e-mail pra{" "}
          <a
            href="mailto:seviicolecionaveis@gmail.com"
            className="underline hover:text-foreground"
          >
            seviicolecionaveis@gmail.com
          </a>
          .
        </p>

        <div className="mt-8 divide-y divide-border border-y border-border">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left hover:opacity-80"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <p className="text-center text-xs text-muted-foreground">
          © Sevii Colecionáveis
        </p>
      </footer>
    </div>
  );
}
