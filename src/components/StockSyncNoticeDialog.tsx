import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

const STORAGE_KEY = "stock-sync-notice-dismissed";

export function StockSyncNoticeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) sessionStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <PackageWarning className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-xl">
            Aviso importante sobre o estoque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          <p>
            Pessoal, boa noite!
          </p>
          <p>
            Nosso site está passando por alguns problemas de sincronização de estoque e estamos trabalhando para corrigir tudo o mais rápido possível.
          </p>
          <p>
            Algumas cartas que temos em estoque estavam aparecendo como indisponíveis, enquanto outras que já estão esgotadas apareciam como disponíveis para compra.
          </p>
          <p>
            Já estamos há alguns dias realizando uma conferência manual do estoque, carta por carta. Como trabalhamos com mais de 3000 cartas cadastradas, ainda podem ocorrer divergências. Por esse motivo, em alguns casos poderemos entrar em contato após a compra para informar que determinada carta não está disponível no momento.
          </p>
          <p>
            Informamos também que o estoque das cartas <strong>ex</strong>, <strong>Ilustração Rara (IR)</strong> e <strong>Ultra Rara (UR)</strong> já foi revisado e corrigido. Neste momento, estamos realizando a conferência das cartas normais, reverse e foil, que representam a maior parte do nosso catálogo.
          </p>
          <p>
            Pedimos desculpas pelo transtorno e agradecemos a compreensão de todos. Estamos empenhados em normalizar a situação o quanto antes.
          </p>
          <p>
            Caso tenha dúvidas sobre a disponibilidade de alguma carta, entre em contato conosco antes da compra. Teremos prazer em ajudar!
          </p>
        </div>

        <button
          onClick={() => handleClose(false)}
          className="mt-4 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Entendi, continuar navegando
        </button>
      </DialogContent>
    </Dialog>
  );
}
