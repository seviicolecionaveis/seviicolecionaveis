import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Check, Copy } from "lucide-react";

const STORAGE_KEY = "welcome-dialog-dismissed";
const COUPON = "PRIMEIRACOMPRA10";

export function WelcomeDialog() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) localStorage.setItem(STORAGE_KEY, "1");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold/70 text-background shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Bem-vindo, Trainer!
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Como boas-vindas, ganhe <strong>10% de desconto</strong> na sua
            primeira compra com o cupom abaixo.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 w-full rounded-xl border-2 border-dashed border-brand-gold bg-brand-gold/10 px-5 py-4 text-center transition hover:bg-brand-gold/15"
          aria-label="Copiar cupom"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Cupom de 10% OFF
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="font-mono text-xl font-bold tracking-widest text-foreground">
              {COUPON}
            </span>
            {copied ? (
              <Check className="h-4 w-4 text-condition-mint" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {copied ? "Copiado!" : "Toque para copiar"}
          </p>
        </button>

        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Aplique no checkout. Válido apenas na primeira compra.
        </p>

        <button
          onClick={() => handleClose(false)}
          className="mt-2 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Bora colecionar!
        </button>
      </DialogContent>
    </Dialog>
  );
}
