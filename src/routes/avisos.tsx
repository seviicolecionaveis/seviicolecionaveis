import { createFileRoute } from "@tanstack/react-router";
import { Bell, AlertTriangle, MessageCircle, Sparkles, Info } from "lucide-react";
import { NOTICES, type Notice } from "@/data/notices";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos e Comunicados — Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Consulte aqui todos os avisos e comunicados da Sevii Colecionáveis: pagamentos, estoque, promoções e novidades.",
      },
      { property: "og:title", content: "Avisos e Comunicados — Sevii Colecionáveis" },
      {
        property: "og:description",
        content: "Lista completa de avisos e comunicados da loja.",
      },
    ],
  }),
  component: AvisosPage,
});

const ICONS: Record<Notice["category"], React.ComponentType<{ className?: string }>> = {
  Pagamentos: AlertTriangle,
  Estoque: AlertTriangle,
  Comunidade: MessageCircle,
  Promoção: Sparkles,
  Geral: Info,
};

const CATEGORY_COLORS: Record<Notice["category"], string> = {
  Pagamentos: "bg-orange-100 text-orange-700",
  Estoque: "bg-amber-100 text-amber-700",
  Comunidade: "bg-emerald-100 text-emerald-700",
  Promoção: "bg-yellow-100 text-yellow-700",
  Geral: "bg-sky-100 text-sky-700",
};

function AvisosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Avisos e Comunicados</h1>
            <p className="text-sm text-muted-foreground">
              Todos os avisos da loja em um único lugar.
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {NOTICES.map((notice) => {
            const Icon = ICONS[notice.category];
            return (
              <article
                key={notice.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CATEGORY_COLORS[notice.category]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {notice.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">• {notice.date}</span>
                      {notice.active && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Ativo
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-foreground">
                      {notice.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{notice.summary}</p>
                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground">
                      {notice.body.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
