import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, Gift, Sparkles, PartyPopper, Tag, Info } from "lucide-react";

export type PopupIconKey = string;

type IconEntry = {
  key: string;
  label: string;
  render: (className: string, style?: CSSProperties) => ReactNode;
};

const SITE_LOGO = "/sevii-logo.png";

/**
 * Registry of popup header icons. Add a new entry here (or a new image-based
 * entry) to expose it in the admin dropdown — no other code changes required.
 */
export const POPUP_ICONS: IconEntry[] = [
  { key: "none", label: "Nenhum ícone", render: () => null },
  {
    key: "logo",
    label: "Logo do site",
    render: (c) => <img src={SITE_LOGO} alt="Sevii Colecionáveis" className={`${c} object-contain`} />,
  },
  {
    key: "warning",
    label: "Aviso",
    render: (c) => <AlertTriangle className={`${c} text-amber-500`} strokeWidth={1.8} />,
  },
  {
    key: "news",
    label: "Novidade",
    render: (c) => <Sparkles className={`${c} text-primary`} strokeWidth={1.8} />,
  },
  {
    key: "promo",
    label: "Promoção",
    render: (c) => <Tag className={`${c} text-primary`} strokeWidth={1.8} />,
  },
  {
    key: "gift",
    label: "Presente",
    render: (c) => <Gift className={`${c} text-primary`} strokeWidth={1.8} />,
  },
  {
    key: "party",
    label: "Comemoração",
    render: (c) => <PartyPopper className={`${c} text-primary`} strokeWidth={1.8} />,
  },
  {
    key: "info",
    label: "Informação",
    render: (c) => <Info className={`${c} text-primary`} strokeWidth={1.8} />,
  },
];

export function renderPopupIcon(key: string | null | undefined, className = "h-12 w-12") {
  const entry = POPUP_ICONS.find((i) => i.key === (key ?? "none"));
  if (!entry || entry.key === "none") return null;
  return (
    <div className="flex justify-center pt-6 pb-1">{entry.render(className)}</div>
  );
}

export const STORE_WHATSAPP_URL = "https://wa.me/5579981509552";

export type PopupButtonAction = "url" | "internal" | "whatsapp" | "close";

export const POPUP_BUTTON_ACTIONS: { value: PopupButtonAction; label: string }[] = [
  { value: "url", label: "Abrir URL externa" },
  { value: "internal", label: "Ir para página interna" },
  { value: "whatsapp", label: "WhatsApp da loja" },
  { value: "close", label: "Apenas fechar o pop-up" },
];

export function resolvePopupButtonHref(
  action: string | null | undefined,
  target: string | null | undefined,
): string | null {
  if (action === "whatsapp") return STORE_WHATSAPP_URL;
  if (action === "url" || action === "internal") return target?.trim() || null;
  return null;
}
