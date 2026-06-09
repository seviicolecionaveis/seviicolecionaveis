import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalDataForm } from "@/components/account/PersonalDataForm";
import { PreferencesForm } from "@/components/account/PreferencesForm";
import { AddressesManager } from "@/components/account/AddressesManager";
import { LoyaltyPointsCard } from "@/components/account/LoyaltyPointsCard";
import { ShoppingBag, Heart, Layers, Sparkles } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Sevii Colecionáveis" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold mb-1">Minha conta</h1>
        <p className="text-sm text-muted-foreground mb-6 truncate">{user.email}</p>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="preferencias">Preferências</TabsTrigger>
            <TabsTrigger value="enderecos">Endereços</TabsTrigger>
            <TabsTrigger value="atalhos">Pedidos & Favoritos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-6">
            <PersonalDataForm />
          </TabsContent>

          <TabsContent value="preferencias" className="mt-6">
            <PreferencesForm />
          </TabsContent>

          <TabsContent value="enderecos" className="mt-6">
            <AddressesManager />
          </TabsContent>

          <TabsContent value="atalhos" className="mt-6">
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <Link
                to="/orders"
                className="rounded-xl border border-border bg-card p-6 hover:border-foreground/40 transition"
              >
                <ShoppingBag className="h-6 w-6 mb-3" />
                <h3 className="font-semibold">Meus pedidos</h3>
                <p className="text-xs text-muted-foreground mt-1">Histórico e status de envio</p>
              </Link>
              <Link
                to="/favoritos"
                className="rounded-xl border border-border bg-card p-6 hover:border-foreground/40 transition"
              >
                <Heart className="h-6 w-6 mb-3" />
                <h3 className="font-semibold">Meus favoritos</h3>
                <p className="text-xs text-muted-foreground mt-1">Cartas que você salvou</p>
              </Link>
              <Link
                to="/pilha"
                className="rounded-xl border border-border bg-card p-6 hover:border-foreground/40 transition"
              >
                <Layers className="h-6 w-6 mb-3" />
                <h3 className="font-semibold">Pilha de Cartas</h3>
                <p className="text-xs text-muted-foreground mt-1">Armazene cartas por até 30 dias</p>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
