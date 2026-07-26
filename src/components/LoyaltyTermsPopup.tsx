import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DontShowAgainCheckbox } from "@/components/DontShowAgainCheckbox";
import { getPermanentlyDismissed, useDontShowAgain } from "@/hooks/usePopupPreference";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, Clock, Truck, Wallet, ShoppingBag } from "lucide-react";
import {
  REAIS_PER_POINT,
  POINTS_PER_REDEEM_BLOCK,
  CENTS_PER_REDEEM_BLOCK,
  MIN_REDEEM_POINTS,
  EXPIRATION_MONTHS,
} from "@/lib/loyalty";

const POPUP_KEY = "loyalty-terms-2026";
const SESSION_KEY = "loyalty-terms-2026-session";

const RULES = [
  {
    icon: ShoppingBag,
    text: (
      <>
        Você ganha <strong>1 ponto a cada R$ {REAIS_PER_POINT},00</strong> em pedidos pagos.
      </>
    ),
  },
  {
    icon: Gift,
    text: (
      <>
        <strong>{POINTS_PER_REDEEM_BLOCK} pontos = R$ {(CENTS_PER_REDEEM_BLOCK / 100).toFixed(2).replace(".", ",")}</strong> de desconto no checkout.
      </>
    ),
  },
  {
    icon: Sparkles,
    text: (
      <>
        Resgate mínimo de <strong>{MIN_REDEEM_POINTS} pontos</strong>.
      </>
    ),
  },
  {
    icon: Clock,
    text: (
      <>
        Pontos válidos por <strong>{EXPIRATION_MONTHS} meses</strong> a partir do crédito.
      </>
    ),
  },
  { icon: Truck, text: <>O valor do <strong>frete não acumula</strong> pontos.</> },
  {
    icon: Wallet,
    text: <>Compras pagas <strong>totalmente com créditos</strong> não acumulam pontos.</>,
  },
];

export function LoyaltyTermsPopup({ forceOpen = false }: { forceOpen?: boolean }) {
  const [open, setOpen] = useState(forceOpen);
  const { dontShowAgain, setDontShowAgain, commit } = useDontShowAgain(POPUP_KEY);

  useEffect(() => {
    if (forceOpen) return;
    if (typeof window === "undefined") return;
    if (getPermanentlyDismissed(POPUP_KEY)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [forceOpen]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) commit();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 gap-0 overflow-hidden sm:max-w-[440px]">
        <div className="bg-primary text-primary-foreground px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">
            Programa de Pontos Sevii
          </p>
          <h2 className="text-xl font-black leading-tight mt-1">
            Novas regras de resgate de pontos
          </h2>
        </div>

        <ul className="px-6 py-5 space-y-3 text-sm text-muted-foreground">
          {RULES.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span className="text-foreground/90">{text}</span>
            </li>
          ))}
        </ul>

        <div className="px-6 pb-5 space-y-3">
          <Button asChild className="w-full font-bold">
            <Link to="/conta" onClick={() => handleClose(false)}>
              Ver meus pontos
            </Link>
          </Button>
          <DontShowAgainCheckbox
            checked={dontShowAgain}
            onCheckedChange={setDontShowAgain}
            id="loyalty-terms-popup-dsa"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
