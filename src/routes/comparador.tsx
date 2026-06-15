import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCompare } from "@/hooks/useCompare";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/logo.webp";

export const Route = createFileRoute("/comparador")({
  head: () => ({
    meta: [
      { title: "Comparar Cartas — Sevii Colecionáveis" },
      { name: "description", content: "Compare cartas Pokémon lado a lado: preço, raridade, idiomas e disponibilidade." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const { cards, loading } = useCardsCatalog();

  const selected = useMemo(
    () => ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c),
    [ids, cards],
  );

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comparar cartas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selected.length === 0
                ? "Adicione até 3 cartas pelo catálogo."
                : `${selected.length} carta${selected.length > 1 ? "s" : ""} selecionada${selected.length > 1 ? "s" : ""}.`}
            </p>
          </div>
          {selected.length > 0 && (
            <Button variant="outline" size="sm" onClick={clear}>Limpar tudo</Button>
          )}
        </div>

        {loading && selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : selected.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma carta selecionada.</p>
            <Button asChild className="mt-4">
              <Link to="/cartas">Ir ao catálogo</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selected.map((c) => {
              const conditions = Array.from(new Set(c.variants.map((v) => v.condition))).join(", ");
              const finishes = Array.from(new Set(c.variants.map((v) => v.finish))).join(", ");
              const langs = c.languages.map((l) => l.language).join(", ");
              return (
                <div key={c.id} className="relative rounded-xl border border-border bg-card p-4">
                  <button
                    onClick={() => remove(c.id)}
                    className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-muted/80"
                    aria-label="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
                    <img src={c.image} alt={c.name} className="h-full w-full object-contain" />
                  </div>
                  <h2 className="mt-3 font-semibold text-sm line-clamp-2">{c.name}</h2>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <Row label="Coleção" value={c.collection} />
                    <Row label="Nº" value={c.number} />
                    <Row label="Categoria" value={c.category} />
                    {c.trainerSubcategory && <Row label="Subtipo" value={c.trainerSubcategory} />}
                    <Row label="Estoque" value={c.stock > 0 ? `${c.stock} un` : "Esgotada"} />
                    <Row
                      label="A partir de"
                      value={c.price != null ? `R$ ${c.price.toFixed(2).replace(".", ",")}` : "—"}
                    />
                    <Row label="Idiomas" value={langs} />
                    <Row label="Acabamentos" value={finishes} />
                    <Row label="Condições" value={conditions} />
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
