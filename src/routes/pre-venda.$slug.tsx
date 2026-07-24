import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getActivePresalePageBySlug, type PublicPresaleProduct } from "@/lib/presale.functions";
import { SiteFooter } from "@/components/SiteFooter";

const WHATSAPP_NUMBER = "5579981509552";

export const Route = createFileRoute("/pre-venda/$slug")({
  loader: async ({ params }) => {
    const { page } = await getActivePresalePageBySlug({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Pré-Venda não encontrada" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.page.title} — Pré-Venda | Sevii Colecionáveis`;
    const desc = `Reserve agora: ${loaderData.page.title}. Pré-venda oficial na Sevii Colecionáveis.`;
    const img = loaderData.page.products.find((p) => p.image_url)?.image_url ?? undefined;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
    ];
    if (img && img.startsWith("https://")) {
      meta.push({ property: "og:image", content: img });
      meta.push({ name: "twitter:image", content: img });
    }
    return { meta };
  },
  component: PresalePage,
  notFoundComponent: PresaleNotFound,
});

function PresaleNotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">Pré-venda indisponível</h1>
        <p className="text-muted-foreground">Esta pré-venda não está mais ativa.</p>
        <Link to="/pre-venda" className="text-sm underline">Ver pré-vendas ativas</Link>
      </div>
    </div>
  );
}

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function PresalePage() {
  const { page } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/pre-venda" className="text-xs text-muted-foreground hover:text-foreground">← Todas as pré-vendas</Link>
        <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-8">{page.title}</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {page.products.map((p: PublicPresaleProduct) => {
            const msg = p.whatsapp_message_template.replaceAll("[nome do produto]", p.name);
            const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
            const dateLabel = formatDate(p.available_from);
            return (
              <article key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-secondary" />
                )}
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <h2 className="text-xl font-bold">{p.name}</h2>
                  {p.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {p.language && <span className="rounded-full bg-secondary px-2 py-0.5">{p.language}</span>}
                    {p.release_year && <span className="rounded-full bg-secondary px-2 py-0.5">{p.release_year}</span>}
                    {dateLabel && <span className="rounded-full bg-secondary px-2 py-0.5">Disponível: {dateLabel}</span>}
                  </div>
                  <p className="text-2xl font-bold tabular-nums mt-1">{formatBRL(p.price_cents)}</p>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8] transition"
                  >
                    {p.whatsapp_button_text}
                  </a>
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
