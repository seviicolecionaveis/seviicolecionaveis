import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import {
  productCover,
  productPrice,
  productSlug,
  productStock,
  stockLabel,
  formatProductPrice,
  type StoreProduct,
} from "@/lib/product-catalog";
export function ProductCard({
  product,
  kind,
}: {
  product: StoreProduct;
  kind: "accessory" | "sealed";
}) {
  const cover = productCover(product);
  const stock = productStock(product);
  return (
    <Link
      to={kind === "accessory" ? "/acessorios/$slug" : "/produtos-lacrados/$slug"}
      params={{ slug: productSlug(product) }}
      className="group block min-w-0 text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
        {cover ? (
          <img
            src={cover}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Package className="h-12 w-12" aria-label="Sem imagem" />
          </div>
        )}
        {(stock <= 3 || product.is_preorder) && (
          <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-1 text-xs font-semibold">
            {product.is_preorder ? "Pré-venda" : stockLabel(stock)}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold">{product.title}</p>
      <p className="text-sm text-muted-foreground">
        {parsePricePrefix(product)}
        {formatProductPrice(productPrice(product))}
      </p>
      {product.is_preorder && product.release_date && (
        <p className="text-xs text-primary">
          Envio a partir de{" "}
          {new Date(product.release_date + "T12:00:00Z").toLocaleDateString("pt-BR", {
            timeZone: "America/Fortaleza",
          })}
        </p>
      )}
    </Link>
  );
}
function parsePricePrefix(p: StoreProduct) {
  return productPrice(p) !== p.price_cents ? "a partir de " : "";
}
