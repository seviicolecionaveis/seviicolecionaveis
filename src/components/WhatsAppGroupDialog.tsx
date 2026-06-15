import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, X } from "lucide-react";
import logo from "@/assets/logo.webp";
import { DontShowAgainCheckbox } from "@/components/DontShowAgainCheckbox";
import { getPermanentlyDismissed, useDontShowAgain } from "@/hooks/usePopupPreference";

const POPUP_KEY = "whatsapp-group";

const STORAGE_KEY = "whatsapp-group-dismissed-at";
const GROUP_LINK = "https://chat.whatsapp.com/LfG18YtcQMJ8PBjNz5IogS";
const DISMISS_DAYS = 7;

function shouldShow() {
  if (typeof window === "undefined") return false;
  if (getPermanentlyDismissed(POPUP_KEY)) return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return true;
  const dismissedAt = parseInt(raw, 10);
  if (Number.isNaN(dismissedAt)) return true;
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return now - dismissedAt > DISMISS_DAYS * msPerDay;
}

export function WhatsAppGroupDialog() {
  const [open, setOpen] = useState(false);
  const { dontShowAgain, setDontShowAgain, commit } = useDontShowAgain(POPUP_KEY);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldShow()) return;

    const t = setTimeout(() => {
      setOpen(true);
    }, 3000);

    return () => clearTimeout(t);
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      commit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-border">
            <img src={logo} alt="Sevii Colecionáveis" className="h-full w-full object-contain" />
          </div>
          <DialogTitle className="text-center text-xl">
            Junte-se à nossa comunidade!
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Entre no nosso grupo exclusivo do WhatsApp e fique por dentro de
            lançamentos, promoções e novidades do mundo Pokémon.
          </DialogDescription>
        </DialogHeader>

        <a
          href={GROUP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, String(Date.now()));
          }}
          className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
        >
          <MessageCircle className="h-5 w-5" />
          Entrar no grupo
        </a>

        <DialogFooter className="sm:justify-center">
          <button
            onClick={() => handleClose(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Agora não
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
