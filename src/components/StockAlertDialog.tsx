import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, Check } from "lucide-react";
import { subscribeStockAlert } from "@/lib/stock-alerts.functions";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  cardKey: string;
  cardName: string;
  cardCollection: string;
  cardNumber: string;
}

export function StockAlertDialog({
  open,
  onClose,
  cardKey,
  cardName,
  cardCollection,
  cardNumber,
}: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscribe = useServerFn(subscribeStockAlert);

  useEffect(() => {
    if (open) {
      setDone(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user?.email) {
      setError("Faça login para receber o alerta.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await subscribe({
        data: { cardKey, cardName, cardCollection, cardNumber },
      });
      if (res.success) {
        setDone(true);
      } else if (res.reason === "email_suppressed") {
        setError(
          "Seu e-mail foi removido da nossa lista. Fale com a gente para reativar.",
        );
      } else {
        setError("Não conseguimos cadastrar agora. Tente novamente em instantes.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao se inscrever. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
            <Bell className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            Avise-me quando voltar
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            Te mandamos um e-mail assim que <strong>{cardName}</strong> voltar
            ao estoque.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-condition-mint/20 text-condition-mint">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Pronto! Você está na fila.</p>
            <p className="text-xs text-muted-foreground">
              Vamos te avisar no e-mail <strong>{user?.email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Faça login para receber o aviso no seu e-mail cadastrado.
            </p>
            <Link
              to="/auth"
              onClick={onClose}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Entrar / Criar conta
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O aviso será enviado para{" "}
              <strong className="text-foreground">{user.email}</strong>.
            </p>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Quero ser avisado"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Só te enviamos quando essa carta específica voltar. Sem spam.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
