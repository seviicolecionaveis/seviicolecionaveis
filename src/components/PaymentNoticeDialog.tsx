import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Mail } from "lucide-react";

const STORAGE_KEY = "payment-notice-dismissed";

export function PaymentNoticeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) sessionStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Instabilidade nos pagamentos</DialogTitle>
          <DialogDescription className="text-center">
            Estamos enfrentando instabilidade nas formas de pagamento do site.
            Para finalizar sua compra, entre em contato pelo e-mail abaixo:
          </DialogDescription>
        </DialogHeader>
        <a
          href="mailto:seviicolecionaveis@gmail.com"
          className="mx-auto flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          seviicolecionaveis@gmail.com
        </a>
        <DialogFooter className="sm:justify-center">
          <button
            onClick={() => handleClose(false)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            Entendi, continuar navegando
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
