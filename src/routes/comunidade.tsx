import { createFileRoute, Link } from "@tanstack/react-router";
import QRCode from "react-qr-code";
import { Megaphone, Gavel, ShoppingBag, MessagesSquare, Sparkles, Instagram, MessageCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import logoUrl from "@/assets/logo.webp";
import bannerUrl from "@/assets/comunidade-banner.jpg";

const TITLE = "Comunidade Sevii | Grupos Oficiais da Sevii Colecionáveis";
const DESCRIPTION =
  "Participe da comunidade oficial da Sevii Colecionáveis. Entre em nossos grupos de WhatsApp para leilões, encomendas, bate-papo, eventos e novidades.";
const URL = "https://seviicolecionaveis.com.br/comunidade";

export const Route = createFileRoute("/comunidade")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: ComunidadePage,
});

type Group = {
  icon: typeof Megaphone;
  emoji: string;
  title: string;
  description: React.ReactNode;
  link: string | null;
};

const GROUPS: Group[] = [
  {
    icon: Megaphone,
    emoji: "📢",
    title: "Grupo de Avisos",
    description:
      "Receba todas as novidades da Sevii em primeira mão: lançamentos, promoções, eventos, pré-vendas e comunicados importantes.",
    link: "https://chat.whatsapp.com/LfG18YtcQMJ8PBjNz5IogS",
  },
  {
    icon: Gavel,
    emoji: "🏆",
    title: "Leilões",
    description:
      "Toda quarta-feira às 20h realizamos nossos leilões exclusivos, onde você pode conseguir cartas e produtos por preços imperdíveis.",
    link: "https://chat.whatsapp.com/BWQmSpxjqXbLh4ixY50zam",
  },
  {
    icon: ShoppingBag,
    emoji: "🛒",
    title: "Encomendas",
    description: (
      <>
        Produtos exclusivos do Japão, cartas graduadas dos Estados Unidos e pré-vendas de importados.
        <br />
        <span className="mt-2 block">
          <strong className="text-foreground">Segunda-feira:</strong> produtos do Japão.
        </span>
        <span className="block">
          <strong className="text-foreground">Quinta-feira:</strong> cartas graduadas.
        </span>
      </>
    ),
    link: "https://chat.whatsapp.com/FqR6XbTNLTpE0eJOxILrmz",
  },
  {
    icon: MessagesSquare,
    emoji: "💬",
    title: "Chat Geral",
    description:
      "Espaço para conversar com outros colecionadores, tirar dúvidas, compartilhar experiências e negociar cartas.",
    link: "https://chat.whatsapp.com/IQIX5EZrH1V8Dg0oObCNxC",
  },
  {
    icon: Sparkles,
    emoji: "✨",
    title: "Treinadores Iniciantes",
    description:
      "Grupo voltado para novos jogadores. Em breve teremos torneios, desafios e eventos exclusivos.",
    link: "https://chat.whatsapp.com/HM6sKvdKv5F0EQS4nkEuj6",
  },
];

function GroupCard({ group }: { group: Group }) {
  const Icon = group.icon;
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            <span aria-hidden className="mr-1">{group.emoji}</span>
            {group.title}
          </h2>
        </div>
      </div>

      <div className="mt-4 flex flex-1 gap-4">
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{group.description}</p>
        {group.link && (
          <div className="hidden shrink-0 rounded-lg border border-border bg-background p-2 sm:block">
            <QRCode value={group.link} size={80} style={{ height: 80, width: 80 }} />
            <p className="mt-1 text-center text-[10px] text-muted-foreground">Escaneie</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {group.link ? (
          <Button asChild className="w-full transition-transform hover:scale-[1.02]">
            <a href={group.link} target="_blank" rel="noopener noreferrer">
              Entrar no grupo
            </a>
          </Button>
        ) : (
          <Button disabled className="w-full">
            Em breve
          </Button>
        )}
      </div>
    </article>
  );
}

function ComunidadePage() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-2xl border border-border">
          <img
            src={bannerUrl}
            alt="Ilustração da comunidade Sevii Colecionáveis"
            width={1600}
            height={600}
            className="h-40 w-full object-cover sm:h-56"
          />
        </div>

        <div className="mt-8 max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Comunidade</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Comunidade Sevii</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Faça parte da comunidade oficial da Sevii Colecionáveis. Entre em nossos grupos do WhatsApp
            e participe de leilões, encomendas, bate-papo e eventos exclusivos.
          </p>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <GroupCard key={g.title} group={g} />
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Conheça a Sevii</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Além da comunidade, visite nossa loja online e acompanhe nossas redes sociais para não
            perder nenhuma novidade.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild className="transition-transform hover:scale-[1.02]">
              <Link to="/">
                <Store className="mr-2 h-4 w-4" />
                Ir para a Loja
              </Link>
            </Button>
            <Button asChild variant="outline" className="transition-transform hover:scale-[1.02]">
              <a href="https://instagram.com/seviicolecionaveis" target="_blank" rel="noopener noreferrer">
                <Instagram className="mr-2 h-4 w-4" />
                Instagram
              </a>
            </Button>
            <Button asChild variant="outline" className="transition-transform hover:scale-[1.02]">
              <a href="https://wa.me/557998150955" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp da Loja
              </a>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
