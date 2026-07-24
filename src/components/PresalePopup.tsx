import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DontShowAgainCheckbox } from "@/components/DontShowAgainCheckbox";
import { getPermanentlyDismissed, useDontShowAgain } from "@/hooks/usePopupPreference";
import presaleImg from "@/assets/serie_3_anuncio_feed.png.asset.json";

const POPUP_KEY = "presale-pi-serie-3";
const SESSION_KEY = "presale-pi-serie-3-session";
const TARGET_SLUG = "pi-serie-3";

export function PresalePopup() {
  const [open, setOpen] = useState(false);
  const { dontShowAgain, setDontShowAgain, commit } = useDontShowAgain(POPUP_KEY);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getPermanentlyDismissed(POPUP_KEY)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) commit();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 overflow-hidden sm:max-w-[420px] bg-transparent border-0 shadow-none"
        hideCloseButton
      >
        <div className="relative rounded-xl overflow-hidden bg-background shadow-2xl">
          <button
            type="button"
            onClick={() => handleClose(false)}
            aria-label="Fechar"
            className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
          <Link
            to="/pre-venda/$slug"
            params={{ slug: TARGET_SLUG }}
            onClick={() => handleClose(false)}
            className="block"
          >
            <img
              src={presaleImg.url}
              alt="Pré-venda Parceiro Inicial Série 3 — R$ 95 no Pix"
              className="block w-full h-auto"
            />
          </Link>
          <div className="px-4 py-3 bg-background">
            <DontShowAgainCheckbox
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
              id="presale-popup-dsa"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
