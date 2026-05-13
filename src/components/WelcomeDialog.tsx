import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Mail } from "lucide-react";

const STORAGE_KEY = "welcome-dialog-dismissed";

export function WelcomeDialog() {
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
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold/70 text-background shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Bem-vindo, Trainer!
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Nosso site está em fase de implementação e podem ocorrer alguns
            erros, mas não desanime!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-border bg-secondary/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Encontrou algum erro? Fale com a gente:
          </p>
          <a
            href="mailto:seviicolecionaveis@gmail.com"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand-gold transition-colors"
          >
            <Mail className="h-4 w-4" />
            seviicolecionaveis@gmail.com
          </a>
        </div>

        <button
          onClick={() => handleClose(false)}
          className="mt-2 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Vamos lá!
        </button>
      </DialogContent>
    </Dialog>
  );
}
