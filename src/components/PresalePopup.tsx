import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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
      <DialogContent className="p-0 gap-0 overflow-hidden sm:max-w-[420px] border-0">
        <div className="relative">
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
