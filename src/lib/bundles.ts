// Bundle/combo definitions com preço fixo. O desconto do combo é aplicado
// ANTES (e independentemente) de cupons e do desconto Pix — esses descontos
// só incidem sobre os itens fora do combo.

export interface BundleMember {
  name: string;
  collection: string;
  number: string;
  finish: string;
  language: string;
  condition: string;
}

export interface BundleDefinition {
  id: string;
  label: string;
  bundlePriceCents: number; // valor fixo do combo por set completo
  members: BundleMember[];
}

export const BUNDLE_DEFINITIONS: BundleDefinition[] = [
  {
    id: "mep-trio-inicial-alola",
    label: "Combo Trio Inicial Alola (Rowlet + Litten + Popplio) — MEP",
    bundlePriceCents: 10000, // R$ 100,00 por set
    members: [
      { name: "Rowlet", collection: "MEP - Mega Evolução Promos", number: "043", finish: "Illustration Rare", language: "Português", condition: "NM" },
      { name: "Litten", collection: "MEP - Mega Evolução Promos", number: "044", finish: "Illustration Rare", language: "Português", condition: "NM" },
      { name: "Popplio", collection: "MEP - Mega Evolução Promos", number: "045", finish: "Illustration Rare", language: "Português", condition: "NM" },
    ],
  },
];

export interface BundleEligibleItem {
  name: string;
  collection?: string | null;
  number?: string | null;
  finish: string;
  language: string;
  condition?: string | null;
  unitPrice: number; // em reais
  quantity: number;
}

export interface AppliedBundle {
  id: string;
  label: string;
  sets: number;
  originalCentsPerSet: number;
  bundleCentsPerSet: number;
  discountCents: number; // (original − bundle) × sets
}

export interface BundleComputation {
  applied: AppliedBundle[];
  bundleDiscountCents: number; // soma dos descontos
  bundleSubtotalCents: number; // subtotal original dos itens que entraram no combo
}

function norm(s: string | null | undefined) {
  return (s ?? "").normalize("NFC").trim().toLowerCase();
}

function matches(item: BundleEligibleItem, m: BundleMember) {
  return (
    norm(item.name) === norm(m.name) &&
    norm(item.collection) === norm(m.collection) &&
    norm(item.number) === norm(m.number) &&
    norm(item.finish) === norm(m.finish) &&
    norm(item.language) === norm(m.language) &&
    norm(item.condition) === norm(m.condition)
  );
}

export function computeBundleDiscount(items: BundleEligibleItem[]): BundleComputation {
  const remaining = items.map((i) => ({ ...i, _rem: i.quantity }));
  const applied: AppliedBundle[] = [];
  let bundleDiscountCents = 0;
  let bundleSubtotalCents = 0;

  for (const def of BUNDLE_DEFINITIONS) {
    const memberRefs = def.members.map((m) => remaining.find((i) => matches(i, m)));
    if (memberRefs.some((r) => !r)) continue;
    const sets = Math.min(...memberRefs.map((r) => r!._rem));
    if (sets <= 0) continue;

    const originalCentsPerSet = memberRefs.reduce(
      (s, r) => s + Math.round(r!.unitPrice * 100),
      0,
    );
    const discountCents = (originalCentsPerSet - def.bundlePriceCents) * sets;
    if (discountCents <= 0) {
      // se o preço do combo for >= soma dos itens, não aplica
      continue;
    }
    applied.push({
      id: def.id,
      label: def.label,
      sets,
      originalCentsPerSet,
      bundleCentsPerSet: def.bundlePriceCents,
      discountCents,
    });
    bundleDiscountCents += discountCents;
    bundleSubtotalCents += originalCentsPerSet * sets;
    memberRefs.forEach((r) => {
      r!._rem -= sets;
    });
  }

  return { applied, bundleDiscountCents, bundleSubtotalCents };
}
