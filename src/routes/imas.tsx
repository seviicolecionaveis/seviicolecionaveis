import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/imas")({
  head: () => ({
    meta: [
      { title: "Ímãs — Em breve | Sevii Colecionáveis" },
      { name: "description", content: "Em breve: catálogo de ímãs colecionáveis Sevii." },
      { property: "og:title", content: "Ímãs — Em breve | Sevii Colecionáveis" },
      { property: "og:description", content: "Em breve: catálogo de ímãs colecionáveis Sevii." },
    ],
  }),
  component: ImasPage,
});

function ImasPage() {
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

      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Ímãs</h1>
        <p className="mt-4 text-muted-foreground">
          Em breve você vai encontrar nossos ímãs colecionáveis por aqui. Volte logo!
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
