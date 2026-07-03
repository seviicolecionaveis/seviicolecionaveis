import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Check, X, ArrowLeft, ZoomIn } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import type { Sealed } from "@/components/catalog/SealedModal";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { slugify } from "@/lib/slug";
import { toast } from "sonner";
import logoUrl from "@/assets/logo.webp";

async function fetchBySlug(slug: string): Promise<Sealed | null> {
  const { data } = await supabase
    .from("sealed_products")
    .select("id, title, description, price_cents, stock, images, is_preorder, release_date, product_type, collection, language, distribution, condition, age_rating, sku")
    .eq("active", true);
  const list = (data ?? []) as Sealed[];
  return list.find((p) => slugify(p.title) === slug) ?? null;
}

export const Route = createFileRoute("/produtos-lacrados/$slug")({
  loader: async ({ params }) => {
    const item = await fetchBySlug(params.slug);
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Produto não encontrado | Sevii Colecionáveis" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.item;
    const title = `${p.title} | Sevii Colecionáveis`;
    const desc = (p.description?.slice(0, 160)) || `${p.title} — Produto lacrado Pokémon disponível na Sevii Colecionáveis.`;
    const url = `https://seviicolecionaveis.com.br/produtos-lacrados/${params.slug}`;
    const img = p.images?.[0];
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (img) {
      meta.push({ property: "og:image", content: img });
      meta.push({ name: "twitter:image", content: img });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: desc,
          image: img ? [img] : undefined,
          sku: p.sku ?? undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: (p.price_cents / 100).toFixed(2),
            availability: (!p.is_preorder && (p.stock ?? 0) <= 0)
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            url,
          },
        }),
      }],
    };
  },
  notFoundComponent: NotFoundView,
  component: SealedDetailPage,
});

function NotFoundView() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <p className="mt-2 text-muted-foreground">O produto que você procura não está mais disponível.</p>
        <Link to="/produtos-lacrados" className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Produtos Lacrados
        </Link>
      </div>
    </div>
  );
}

function SealedDetailPage() {
  const { item } = Route.useLoaderData();
  const router = useRouter();
  const { add } = useCart();
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [shared, setShared] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => { setIdx(0); setQty(1); setShared(false); setZoomOpen(false); setZoomed(false); }, [item.id]);

  const imgs = item.images.length ? item.images : [""];
  const isPreorder = !!item.is_preorder;
  const releaseDateLabel = item.release_date
    ? new Date(item.release_date + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  const canBuy = isPreorder ? true : item.stock > 0;
  const maxQty = isPreorder ? 99 : item.stock;
  const price = item.price_cents / 100;

  const handleAdd = () => {
    if (!canBuy) return;
    const namePrefix = isPreorder
      ? `[Pré-venda${releaseDateLabel ? ` ${releaseDateLabel}` : ""}] `
      : "";
    add(
      {
        id: `sealed:${item.id}`,
        cardId: `sealed:${item.id}`,
        name: `${namePrefix}${item.title}`,
        image: imgs[0],
        collection: "Selado",
        number: "—",
        finish: "Selado",
        language: "—",
        condition: "NM",
        unitPrice: price,
        maxStock: maxQty,
      },
      qty,
    );
    toast.success(isPreorder ? "Pré-venda adicionada ao carrinho" : "Adicionado ao carrinho");
  };

  const shareUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://seviicolecionaveis.com.br/produtos-lacrados/${slugify(item.title)}`;

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" width={224} height={56} className="h-12 w-auto sm:h-14" />
          </Link>
          <SiteNav className="hidden md:flex" />
        </div>
        <div className="md:hidden border-t border-border px-4 py-3">
          <SiteNav className="-mx-1 overflow-x-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/produtos-lacrados" className="hover:text-foreground">Produtos Lacrados</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground line-clamp-1">{item.title}</span>
        </nav>

        <button
          type="button"
          onClick={() => router.history.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Produtos Lacrados
        </button>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-secondary"
              aria-label="Ampliar imagem"
            >
              {imgs[idx] && <img src={imgs[idx]} alt={item.title} className="h-full w-full object-cover" />}
              <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-background/80 p-1.5 opacity-90 shadow group-hover:bg-background">
                <ZoomIn className="h-4 w-4" />
              </span>
              {imgs.length > 1 && (
                <>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + imgs.length) % imgs.length); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setIdx((i) => (i - 1 + imgs.length) % imgs.length); } }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background"
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % imgs.length); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setIdx((i) => (i + 1) % imgs.length); } }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background"
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </>
              )}
            </button>
            {imgs.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {imgs.map((url: string, i: number) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === idx ? "border-primary" : "border-transparent opacity-70"}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-start gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{item.title}</h1>
              {isPreorder && (
                <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Pré-venda
                </span>
              )}
            </div>
            {isPreorder && releaseDateLabel && (
              <p className="mt-1 text-sm font-semibold text-primary">
                Envio a partir de {releaseDateLabel}
              </p>
            )}
            {item.description && (
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{item.description}</p>
            )}

            {(() => {
              const specs: Array<[string, string | null | undefined]> = [
                ["SKU", item.sku],
                ["Produto", item.product_type],
                ["Coleção", item.collection],
                ["Idioma", item.language],
                ["Distribuição", item.distribution],
                ["Condição", item.condition],
                ["Faixa etária", item.age_rating],
              ];
              const filled = specs.filter(([, v]) => v && v.trim());
              if (filled.length === 0) return null;
              return (
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {filled.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-semibold text-muted-foreground">{k}:</dt>
                      <dd className="text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            <div className="mt-5 text-3xl font-bold">
              R$ {price.toFixed(2).replace(".", ",")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPreorder
                ? "Reserve agora — o envio ocorrerá após o lançamento."
                : item.stock > 0
                  ? `${item.stock} em estoque`
                  : "Esgotado"}
            </p>

            {canBuy && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm">Qtd.</label>
                <div className="inline-flex items-center rounded-md border border-border">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2 py-1 text-sm">−</button>
                  <span className="px-3 text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="px-2 py-1 text-sm">+</button>
                </div>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={!canBuy}
              className="mt-6 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canBuy ? (isPreorder ? "Reservar pré-venda" : "Adicionar ao carrinho") : "Esgotado"}
            </button>

            <button
              type="button"
              onClick={() => {
                const text = `Olha esse produto na Sevii Colecionáveis: ${item.title} — R$ ${price.toFixed(2).replace(".", ",")}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, "_blank");
                setShared(true);
                setTimeout(() => setShared(false), 1500);
              }}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              Compartilhar no WhatsApp
            </button>
          </div>
        </div>
      </main>

      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            className="absolute right-4 top-4 z-10 rounded-full bg-background/90 p-2 hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          {imgs.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + imgs.length) % imgs.length); setZoomed(false); }}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 hover:bg-background"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % imgs.length); setZoomed(false); }}
                className="absolute right-16 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 hover:bg-background"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {imgs[idx] && (
              <img
                src={imgs[idx]}
                alt={item.title}
                onClick={() => setZoomed((z) => !z)}
                className={`select-none transition-transform duration-200 ${zoomed ? "scale-[2] cursor-zoom-out" : "cursor-zoom-in"} max-h-[90vh] max-w-[90vw] object-contain`}
              />
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
