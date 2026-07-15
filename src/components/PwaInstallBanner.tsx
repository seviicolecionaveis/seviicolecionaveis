import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { getPermanentlyDismissed, setPermanentlyDismissed } from "@/hooks/usePopupPreference";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(getPermanentlyDismissed("pwa-install"));
  }, []);

  useEffect(() => {
    if (hidden) return;
    // Skip if already installed as standalone
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS Safari
        window.navigator.standalone === true;
      if (standalone) return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [hidden]);

  if (!visible || hidden) return null;

  const onInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  };

  const onDismiss = () => {
    setVisible(false);
    setPermanentlyDismissed("pwa-install", true);
    setHidden(true);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onDismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar Sevii no seu dispositivo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Acesso rápido pelo ícone na tela inicial, como um app.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onInstall}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Instalar
            </button>
            <button
              onClick={onDismiss}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
