import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

type Props = {
  code: string;
  onCopied?: () => void;
  className?: string;
};

/** Highlighted promo code with a "tap to copy" action. */
export function PromoCodeBlock({ code, onCopied, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onCopied?.();
  };

  return (
    <div className={`px-5 pt-4 ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        className="group w-full rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 px-4 py-3 text-center transition-colors hover:bg-primary/10"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Código promocional
        </span>
        <span className="mt-1 block text-2xl font-black tracking-widest text-foreground">
          {code}
        </span>
        <span className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Toque para copiar"}
        </span>
      </button>
    </div>
  );
}
