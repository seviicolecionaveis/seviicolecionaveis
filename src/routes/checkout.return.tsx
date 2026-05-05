import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Pedido confirmado — Sevii Colecionáveis" }] }),
  component: ReturnPage,
});

function ReturnPage() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
        <h1 className="text-2xl font-bold">Pagamento recebido!</h1>
        <p className="text-sm text-muted-foreground">
          Obrigado pela compra. Seu pedido foi confirmado e em breve entraremos em contato sobre o envio.
        </p>
        {session_id && (
          <p className="text-[10px] text-muted-foreground font-mono break-all">Ref: {session_id}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary">
            Voltar ao catálogo
          </Link>
          <Link to="/orders" className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-semibold hover:bg-foreground/90">
            Meus pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
