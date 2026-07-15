import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { CardItem } from "@/components/catalog/CardItem";
import { CardModal } from "@/components/catalog/CardModal";
import type { Card } from "@/data/cards";
import { getMyShareToken, createShareToken, revokeShareToken } from "@/lib/wishlist-share.functions";
import { Share2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/logo.webp";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Meus Favoritos — Sevii Colecionáveis" },
      { name: "description", content: "Suas cartas Pokémon favoritas salvas na Sevii Colecionáveis. Acompanhe disponibilidade e preços das cartas que mais te interessam." },
      { property: "og:title", content: "Meus Favoritos — Sevii Colecionáveis" },
      { property: "og:description", content: "Cartas Pokémon que você salvou para acompanhar." },
      { property: "og:url", content: "https://seviicolecionaveis.lovable.app/favoritos" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.lovable.app/favoritos" }],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { ids } = useWishlist();
  const { cards, loading } = useCardsCatalog();
  const [active, setActive] = useState<Card | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const getToken = useServerFn(getMyShareToken);
  const createToken = useServerFn(createShareToken);
  const revokeToken = useServerFn(revokeShareToken);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user) return;
    getToken().then((r) => setShareToken(r.token)).catch(() => {});
  }, [user, getToken]);

  const favs = useMemo(
    () => cards.filter((c) => ids.has(c.id)),
    [cards, ids],
  );

  const shareUrl = shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/lista-desejos/${shareToken}` : null;

  const handleShare = async () => {
    setShareBusy(true);
    try {
      const r = shareToken ? { token: shareToken } : await createToken();
      setShareToken(r.token);
      const url = `${window.location.origin}/lista-desejos/${r.token}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Minha lista de desejos", url });
        } catch { /* cancelled */ }
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link copiado!");
      }
    } catch (e) {
      toast.error("Não foi possível gerar o link");
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  const handleRevoke = async () => {
    if (!confirm("Revogar o link atual? Quem tiver o link não poderá mais acessar.")) return;
    setShareBusy(true);
    try {
      await revokeToken();
      setShareToken(null);
      toast.success("Link revogado");
    } finally {
      setShareBusy(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold mb-2">Meus Favoritos</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {favs.length} {favs.length === 1 ? "carta salva" : "cartas salvas"}
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : favs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma carta favoritada ainda. Toque no coração para salvar.
            </p>
            <Link to="/" className="mt-4 inline-block text-sm font-medium underline underline-offset-2">
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {favs.map((c) => (
              <CardItem key={c.id} card={c} onClick={() => setActive(c)} />
            ))}
          </div>
        )}
      </main>

      <CardModal card={active} onClose={() => setActive(null)} />
    </div>
  );
}
