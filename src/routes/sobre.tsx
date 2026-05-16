import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Truck, Heart } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre nós — Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Conheça a Sevii Colecionáveis: loja brasileira especializada em cartas Pokémon originais, com garantia de autenticidade e envio rastreado.",
      },
      { property: "og:title", content: "Sobre a Sevii Colecionáveis" },
      {
        property: "og:description",
        content:
          "Loja brasileira especializada em cartas Pokémon originais, com garantia de autenticidade e envio rastreado.",
      },
      {
        property: "og:url",
        content: "https://seviicolecionaveis.lovable.app/sobre",
      },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.lovable.app/sobre" }],
  }),
  component: SobrePage,
});

function SobrePage() {
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
          Sobre nós
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold">
          Cartas Pokémon de verdade, pra colecionador de verdade.
        </h1>

        <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/90">
          <p>
            A <strong>Sevii Colecionáveis</strong> nasceu da paixão por Pokémon e da
            vontade de oferecer um lugar onde colecionadores brasileiros possam
            comprar cartas <strong>originais</strong>, com preço justo, atendimento
            humano e envio cuidadoso.
          </p>
          <p>
            Trabalhamos com cartas em inglês, português e japonês, de Base Set às
            coleções mais recentes. Cada carta é verificada antes do envio, embalada
            com proteção (sleeve + toploader + envelope rígido) e enviada com código
            de rastreio.
          </p>
          <p>
            Somos uma loja pequena e independente, então cada pedido importa — se você
            tiver qualquer dúvida ou problema, falamos direto com você.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border p-5 bg-card">
            <ShieldCheck className="h-6 w-6 mb-3 text-foreground" />
            <p className="font-semibold">Garantia de autenticidade</p>
            <p className="text-sm text-muted-foreground mt-1">
              100% das cartas são originais. Conferimos uma a uma antes de enviar.
            </p>
          </div>
          <div className="rounded-xl border border-border p-5 bg-card">
            <Truck className="h-6 w-6 mb-3 text-foreground" />
            <p className="font-semibold">Envio rastreado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Despachamos em até 2 dias úteis com código dos Correios.
            </p>
          </div>
          <div className="rounded-xl border border-border p-5 bg-card">
            <Heart className="h-6 w-6 mb-3 text-foreground" />
            <p className="font-semibold">Feito por quem coleciona</p>
            <p className="text-sm text-muted-foreground mt-1">
              Atendimento próximo, pessoal, sem robôs.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl bg-secondary p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Pronto pra começar sua coleção?</p>
          <Link
            to="/"
            className="inline-block rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            Ver catálogo
          </Link>
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
