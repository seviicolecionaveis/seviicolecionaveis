import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PromoCodeBlock } from "@/components/PromoCodeBlock";
import { Bell, AlertTriangle, MessageCircle, Sparkles, Info } from "lucide-react";
import { NOTICES, type Notice } from "@/data/notices";
import { SiteFooter } from "@/components/SiteFooter";
import logoUrl from "@/assets/logo.webp";

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

type PopupNotice = {
  id: string;
  title: string;
  body_html: string;
  image_url: string | null;
  link_url: string | null;
  is_promo_code: boolean;
  promo_code: string | null;
  promo_bg_color: string | null;
  promo_text_color: string | null;
  created_at: string;
};

function PopupNotices() {
  const [items, setItems] = useState<PopupNotice[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("site_popups")
        .select(
          "id, title, body_html, image_url, link_url, is_promo_code, promo_code, promo_bg_color, promo_text_color, created_at",
        )
        .eq("active", true)
        .eq("show_on_notices", true)
        .order("sort_order", { ascending: true });
      setItems((data ?? []) as PopupNotice[]);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 space-y-4">
      {items.map((n) => (
        <article key={n.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Comunicado
            </span>
            <span className="text-[10px] text-muted-foreground">
              • {new Date(n.created_at).toLocaleDateString("pt-BR")}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Ativo
            </span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">{n.title}</h2>
          {n.image_url &&
            (n.link_url ? (
              <a href={n.link_url} className="mt-3 block">
                <img src={n.image_url} alt={n.title} className="w-full rounded-xl" />
              </a>
            ) : (
              <img src={n.image_url} alt={n.title} className="mt-3 w-full rounded-xl" />
            ))}
          {n.is_promo_code && n.promo_code?.trim() && (
            <div className="mt-3 -mx-5">
              <PromoCodeBlock code={n.promo_code.trim()} />
            </div>
          )}
          {n.body_html?.trim() && (
            <div
              className="prose prose-sm mt-3 max-w-none text-sm leading-relaxed text-foreground [&_a]:underline [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: n.body_html }}
            />
          )}
        </article>
      ))}
    </div>
  );
}

function AvisosPage() {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
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

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Comunicados
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Avisos</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Todos os avisos e comunicados que apareceram ou aparecem nos pop-ups do
          site ficam listados aqui para consulta a qualquer momento.
        </p>

        <PopupNotices />

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
                        <p key={i} className="text-justify">{p}</p>
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
