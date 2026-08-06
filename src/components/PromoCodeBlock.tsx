import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

type Props = {
  code: string;
  onCopied?: () => void;
  className?: string;
  /** Optional custom background for the highlighted code box. */
  bgColor?: string | null;
  /** Optional custom color for the code text, border and icons. */
  textColor?: string | null;
};

/** Highlighted promo code with a "tap to copy" action. */
export function PromoCodeBlock({
  code,
  onCopied,
  className = "",
  bgColor,
  textColor,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onCopied?.();
  };

  const boxStyle: React.CSSProperties = {};
  if (bgColor) boxStyle.backgroundColor = bgColor;
  if (textColor) boxStyle.borderColor = textColor;

  return (
    <div className={`px-5 pt-4 ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        style={boxStyle}
        className={`group w-full rounded-xl border-2 border-dashed px-4 py-3 text-center transition-colors ${
          bgColor || textColor
            ? "hover:opacity-90"
            : "border-primary/60 bg-primary/5 hover:bg-primary/10"
        }`}
      >
        <span
          className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          style={textColor ? { color: textColor, opacity: 0.75 } : undefined}
        >
          Código promocional
        </span>
        <span
          className="mt-1 block text-2xl font-black tracking-widest text-foreground"
          style={textColor ? { color: textColor } : undefined}
        >
          {code}
        </span>
        <span
          className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary"
          style={textColor ? { color: textColor } : undefined}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Toque para copiar"}
        </span>
      </button>
    </div>
  );
}
