import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Share2, Check, ZoomIn, Copy } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { getSealedBySlug } from "@/lib/sealed.functions";
import logoUrl from "@/assets/logo.webp";

const SITE = "https://seviicolecionaveis.com.br";

export const Route = createFileRoute("/produtos-lacrados/$slug")({
  loader: async ({ params }) => {
    const item = await getSealedBySlug({ data: { slug: params.slug } });
    if (!item) throw notFound();
    return item;
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/produtos-lacrados/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Produto não encontrado | Sevii Colecionáveis" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const item = loaderData;
    const price = (item.price_cents / 100).toFixed(2);
    const title = `${item.title} | Sevii Colecionáveis`;
    const description =
      (item.description?.trim().slice(0, 155)) ||
      `${item.title} — produto lacrado Pokémon disponível na Sevii Colecionáveis por R$ ${price.replace(".", ",")}.`;
    const image = item.images[0];
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
    ];
    if (image) {
      meta.push(
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      );
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: item.title,
            description,
            url,
            image: item.images,
            ...(item.sku ? { sku: item.sku } : {}),
            brand: { "@type": "Brand", name: "Pokémon" },
            offers: {
              "@type": "Offer",
              url,
              priceCurrency: "BRL",
              price,
              availability:
                item.is_preorder
                  ? "https://schema.org/PreOrder"
                  : item.stock > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
              { "@type": "ListItem", position: 2, name: "Produtos Lacrados", item: `${SITE}/produtos-lacrados` },
              { "@type": "ListItem", position: 3, name: item.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: NotFound,
  errorComponent: NotFound,
  component: SealedDetailPage,
});

function NotFound() {
  return (
    <div className="min-h-screen text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <Link to="/produtos-lacrados" className="mt-4 inline-block text-sm underline">
          Ver produtos lacrados
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
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
  );
}

function SealedDetailPage() {
  const item = Route.useLoaderData();
  const { add } = useCart();
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => { setIdx(0); setQty(1); }, [item.id]);

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

  const pageUrl = `${SITE}/produtos-lacrados/${item.slug}`;

  const handleShareWhats = () => {
    const text = `Olha esse produto na Sevii Colecionáveis: ${item.title} — R$ ${price.toFixed(2).replace(".", ",")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`)}`, "_blank");
    setShared(true);
    setTimeout(() => setShared(false), 1500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const specs: Array<[string, string | null | undefined]> = [
    ["SKU", item.sku],
    ["Produto", item.product_type],
    ["Coleção", item.collection],
    ["Idioma", item.language],
    ["Distribuição", item.distribution],
    ["Condição", item.condition],
    ["Faixa etária", item.age_rating],
  ];
  const filledSpecs = specs.filter(([, v]) => v && v.trim());

  return (
    <div className="min-h-screen text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:underline">Início</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/produtos-lacrados" className="hover:underline">Produtos Lacrados</Link></li>
            <li aria-hidden>›</li>
            <li className="text-foreground">{item.title}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <button
              type="button"
              onClick={() => imgs[idx] && setZoomOpen(true)}
              className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-secondary"
              aria-label="Ampliar imagem"
            >
              {imgs[idx] ? (
                <>
                  <img src={imgs[idx]} alt={item.title} className="h-full w-full object-contain" />
                  <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[11px] font-semibold shadow opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3 w-3" /> Zoom
                  </span>
                </>
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">Sem imagem</div>
              )}
              {imgs.length > 1 && (
                <>
                  <span
                    onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + imgs.length) % imgs.length); }}
                    role="button"
                    aria-label="Imagem anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % imgs.length); }}
                    role="button"
                    aria-label="Próxima imagem"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 hover:bg-background"
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
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 ${i === idx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                    aria-label={`Imagem ${i + 1}`}
                  >
                    {url && <img src={url} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-start gap-2">
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

            <div className="mt-4 text-3xl font-bold">
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
              <div className="mt-4 flex items-center gap-3">
                <label className="text-sm">Qtd.</label>
                <div className="inline-flex items-center rounded-md border border-border">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-1.5 text-sm">−</button>
                  <span className="px-4 text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="px-3 py-1.5 text-sm">+</button>
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

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleShareWhats}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                Compartilhar no WhatsApp
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Link copiado" : "Copiar link"}
              </button>
            </div>

            {item.description && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Descrição</h2>
                <p className="mt-2 text-sm whitespace-pre-line">{item.description}</p>
              </div>
            )}

            {filledSpecs.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Detalhes</h2>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {filledSpecs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-semibold text-muted-foreground">{k}:</dt>
                      <dd className="text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </main>

      {zoomOpen && (
        <ZoomLightbox
          images={imgs.filter(Boolean)}
          startIndex={idx}
          alt={item.title}
          onClose={() => setZoomOpen(false)}
        />
      )}

      <SiteFooter />
    </div>
  );
}

function ZoomLightbox({
  images,
  startIndex,
  alt,
  onClose,
}: {
  images: string[];
  startIndex: number;
  alt: string;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") { setI((p) => (p - 1 + images.length) % images.length); resetView(); }
      else if (e.key === "ArrowRight") { setI((p) => (p + 1) % images.length); resetView(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);

  const resetView = () => { setScale(1); setTx(0); setTy(0); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => Math.min(5, Math.max(1, s + delta * s)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX - tx, y: e.clientY - ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setTx(e.clientX - dragging.current.x);
    setTy(e.clientY - dragging.current.y);
  };
  const onPointerUp = () => { dragging.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = Math.min(5, Math.max(1, pinchRef.current.scale * (d / pinchRef.current.dist)));
      setScale(next);
      if (next === 1) { setTx(0); setTy(0); }
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 select-none"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => (p - 1 + images.length) % images.length); resetView(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Imagem anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => (p + 1) % images.length); resetView(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Próxima imagem"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white">
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(1, s - 0.5)); }} className="px-2">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(5, s + 0.5)); }} className="px-2">+</button>
        {scale !== 1 && (
          <button onClick={(e) => { e.stopPropagation(); resetView(); }} className="ml-2 px-2">Reset</button>
        )}
      </div>

      <div
        className="h-full w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: scale > 1 ? (dragging.current ? "grabbing" : "grab") : "zoom-in" }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={images[i]}
            alt={alt}
            draggable={false}
            onDoubleClick={() => (scale === 1 ? setScale(2.5) : resetView())}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  );
}
