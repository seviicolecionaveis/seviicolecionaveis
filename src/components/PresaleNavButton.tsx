import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listActivePresalePages } from "@/lib/presale.functions";

export function PresaleNavButton({ className = "" }: { className?: string }) {
  const [hasActive, setHasActive] = useState(false);
  const [targetSlug, setTargetSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listActivePresalePages()
      .then((res) => {
        if (cancelled) return;
        if (res.pages.length > 0) {
          setHasActive(true);
          setTargetSlug(res.pages.length === 1 ? res.pages[0].slug : null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasActive) return null;

  const linkProps = targetSlug
    ? ({ to: "/pre-venda/$slug", params: { slug: targetSlug } } as const)
    : ({ to: "/pre-venda" } as const);

  return (
    <Link
      {...linkProps}
      className={`whitespace-nowrap rounded-full bg-[#2563eb] px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#1d4ed8] transition ${className}`}
    >
      Pré-Venda
    </Link>
  );
}
