import { createFileRoute } from "@tanstack/react-router";
import { LoyaltyTermsPopup } from "@/components/LoyaltyTermsPopup";

export const Route = createFileRoute("/preview-pontos")({
  component: PreviewPontos,
  head: () => ({
    meta: [
      { title: "Prévia do pop-up de pontos | Sevii Colecionáveis" },
      { name: "description", content: "Prévia interna do aviso sobre as novas regras de resgate de pontos." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PreviewPontos() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <p className="text-sm text-muted-foreground">Prévia do pop-up de pontos</p>
      <LoyaltyTermsPopup forceOpen />
    </div>
  );
}
