import type { Sealed } from "./SealedModal";
import type { Panel } from "./PanelModal";
import type { Accessory } from "./AccessoryModal";
import { parseVariants } from "@/lib/accessory-variants";

export type OtherProductTileEntry =
  | { kind: "panel"; panel: Panel }
  | { kind: "sealed"; sealed: Sealed }
  | { kind: "accessory"; accessory: Accessory };

interface Props {
  entry: OtherProductTileEntry;
  onClick: () => void;
}

function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function OtherProductTile({ entry, onClick }: Props) {
  const label = entry.kind === "panel" ? "Painel" : entry.kind === "sealed" ? "Lacrado" : "Acessório";
  const item =
    entry.kind === "panel" ? entry.panel : entry.kind === "sealed" ? entry.sealed : entry.accessory;

  let image = item.images[0] ?? "";
  let priceCents = item.price_cents;
  if (entry.kind === "accessory") {
    const vs = parseVariants(entry.accessory.variants);
    const withImage = vs.find((v) => v.images.length > 0);
    if (withImage) image = withImage.images[0];
    if (vs.length) {
      priceCents = Math.min(...vs.map((v) => v.price_cents ?? entry.accessory.price_cents));
    }
  }

  return (
    <button onClick={onClick} className="group text-left">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
        {image ? (
          <img
            src={image}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
            Sem imagem
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow">
          {label}
        </span>
        {entry.kind === "sealed" && entry.sealed.is_preorder && (
          <span className="absolute right-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
            Pré-venda
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold line-clamp-2">{item.title}</p>
      <p className="text-sm text-muted-foreground">{formatPrice(priceCents)}</p>
    </button>
  );
}
