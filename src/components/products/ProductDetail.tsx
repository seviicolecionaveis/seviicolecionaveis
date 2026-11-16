import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Share2,
  MessageCircle,
  Minus,
  Plus,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { parseVariants } from "@/lib/accessory-variants";
import { STORE_WHATSAPP } from "@/lib/scheduling";
import { subscribeStockAlert } from "@/lib/stock-alerts.functions";
import { formatProductPrice, productSlug, type StoreProduct } from "@/lib/product-catalog";
import { ProductGallery } from "./ProductGallery";
import { ProductShell } from "./ProductShell";
export function ProductDetail({
  item,
  kind,
}: {
  item: StoreProduct;
  kind: "accessory" | "sealed";
}) {
  const { add } = useCart();
  const { user } = useAuth();
  const subscribe = useServerFn(subscribeStockAlert);
  const variants = parseVariants(item.variants);
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? "",
  );
  const [qty, setQty] = useState(1);
  useEffect(() => {
    setQty(1);
    setVariantId(
      parseVariants(item.variants).find((v) => v.stock > 0)?.id ??
        parseVariants(item.variants)[0]?.id ??
        "",
    );
  }, [item.id]);
  const variant = variants.find((v) => v.id === variantId);
  const images = variant?.images.length ? variant.images : item.images;
  const stock = variant ? variant.stock : item.stock;
  const price = variant?.price_cents ?? item.price_cents;
  const canBuy = !!item.is_preorder || stock > 0;
  const max = item.is_preorder ? 99 : stock;
  const path = kind === "accessory" ? "/acessorios" : "/produtos-lacrados";
  const label = kind === "accessory" ? "Acessórios" : "Produtos Lacrados";
  const url = `https://seviicolecionaveis.com.br${path}/${productSlug(item)}`;
  const cartId = `${kind === "accessory" ? "accessory" : "sealed"}:${item.id}${variant ? `:${variant.id}` : ""}`;
  const release = item.release_date
    ? new Date(item.release_date + "T12:00:00Z").toLocaleDateString("pt-BR", {
        timeZone: "America/Fortaleza",
      })
    : null;
  function handleAdd() {
    if (!canBuy) return;
    add(
      {
        id: cartId,
        cardId: cartId,
        name: `${item.is_preorder ? `[Pré-venda${release ? " " + release : ""}] ` : ""}${item.title}${variant ? " — " + variant.name : ""}`,
        image: images[0] ?? "",
        collection: kind === "accessory" ? "Acessório" : "Selado",
        number: "—",
        finish: kind === "accessory" ? (item.category ?? "Acessório") : "Selado",
        language: "—",
        condition: "NM",
        unitPrice: price / 100,
        maxStock: max,
      },
      qty,
    );
    toast.success("Adicionado ao carrinho");
  }
  return (
    <ProductShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav
          aria-label="breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link to={path}>{label}</Link>
          <ChevronRight className="h-4 w-4" />
          <span>{item.title}</span>
        </nav>
        <Button asChild variant="link" className="mb-6 p-0">
          <Link to={path}>
            <ArrowLeft />
            Voltar para {label}
          </Link>
        </Button>
        <div className="grid gap-8 md:grid-cols-2">
          <ProductGallery images={images} title={item.title} />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold sm:text-3xl">{item.title}</h1>
            {item.is_preorder && (
              <p className="mt-2 text-sm font-semibold text-primary">
                Pré-venda{release ? ` · Envio a partir de ${release}` : ""}
              </p>
            )}
            {item.description && (
              <p className="mt-3 break-words whitespace-pre-line text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {item.description}
              </p>
            )}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {[
                ["SKU", item.sku],
                ["Categoria", item.category],
                ["Produto", item.product_type],
                ["Coleção", item.collection],
                ["Idioma", item.language],
                ["Distribuição", item.distribution],
                ["Condição", item.condition],
                ["Faixa etária", item.age_rating],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div className="contents" key={k}>
                    <dt className="font-semibold text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {variants.length > 0 && (
              <label className="mt-5 block text-sm font-semibold">
                Variação
                <select
                  aria-label="Variação"
                  className="mt-2 w-full rounded-md border border-border bg-background p-2"
                  value={variantId}
                  onChange={(e) => {
                    setVariantId(e.target.value);
                    setQty(1);
                  }}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.stock > 0 ? `${v.stock} em estoque` : "Esgotado"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="mt-5 text-3xl font-bold">{formatProductPrice(price)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.is_preorder
                ? "Reserve agora — envio após o lançamento."
                : stock > 0
                  ? `${stock} em estoque`
                  : "Esgotado"}
            </p>
            {canBuy && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm">Qtd.</span>
                <div className="inline-flex items-center gap-1 rounded-md border border-border">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Diminuir quantidade"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-semibold">{qty}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Aumentar quantidade"
                    disabled={qty >= max}
                    onClick={() => setQty((q) => Math.min(max, q + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            )}
            <Button className="mt-6 w-full" onClick={handleAdd} disabled={!canBuy}>
              {canBuy
                ? item.is_preorder
                  ? "Reservar pré-venda"
                  : "Adicionar ao carrinho"
                : "Esgotado"}
            </Button>
            {!canBuy && kind === "accessory" && (
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={async () => {
                  if (!user) {
                    toast.error("Entre na sua conta para receber o aviso.");
                    return;
                  }
                  try {
                    const result = await subscribe({
                      data: {
                        cardKey: cartId,
                        cardName: item.title,
                        cardCollection: "Acessórios",
                        cardNumber: variant?.name ?? "—",
                      },
                    });
                    result.success
                      ? toast.success("Você será avisado quando voltar ao estoque.")
                      : toast.error("Não foi possível cadastrar o aviso.");
                  } catch {
                    toast.error("Não foi possível cadastrar o aviso.");
                  }
                }}
              >
                <Bell />
                Avisar quando voltar ao estoque
              </Button>
            )}
            <Button variant="outline" asChild className="mt-2 w-full">
              <a
                href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(`Olá! Tenho interesse em ${item.title}${variant ? " — " + variant.name : ""}. ${url}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                Entrar em contato no WhatsApp
              </a>
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copiado");
                  } catch {
                    toast.error("Não foi possível copiar o link.");
                  }
                }}
              >
                <Copy />
                Copiar link
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${item.title} — ${formatProductPrice(price)} ${url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Share2 />
                  Compartilhar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ProductShell>
  );
}
