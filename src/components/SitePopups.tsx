import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DontShowAgainCheckbox } from "@/components/DontShowAgainCheckbox";
import { PromoCodeBlock } from "@/components/PromoCodeBlock";
import { getPermanentlyDismissed, setPermanentlyDismissed, useDontShowAgain } from "@/hooks/usePopupPreference";
import { supabase } from "@/integrations/supabase/client";

export type SitePopup = {
  id: string;
  title: string;
  body_html: string;
  image_url: string | null;
  link_url: string | null;
  is_promo_code: boolean;
  promo_code: string | null;
};

const SESSION_PREFIX = "site-popup-session:";

function PopupDialog({ popup, onClosed }: { popup: SitePopup; onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  const { dontShowAgain, setDontShowAgain, commit } = useDontShowAgain(popup.id);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      commit();
      onClosed();
    }
  };

  const image = popup.image_url ? (
    <img src={popup.image_url} alt={popup.title} className="block w-full h-auto" />
  ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden sm:max-w-[440px] border-0 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:grid [&>button]:h-9 [&>button]:w-9 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-white [&>button]:text-black [&>button]:opacity-100 [&>button]:shadow-lg [&>button]:ring-1 [&>button]:ring-black/10 [&>button:hover]:bg-white [&>button:hover]:scale-105 [&>button]:transition-transform [&>button_svg]:h-[1.2rem] [&>button_svg]:w-[1.2rem]">
        <div className="relative max-h-[85vh] overflow-y-auto">
          {image &&
            (popup.link_url ? (
              <a
                href={popup.link_url}
                onClick={() => handleOpenChange(false)}
                className="block"
                target={/^https?:\/\//.test(popup.link_url) && !popup.link_url.includes(typeof window !== "undefined" ? window.location.host : "") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {image}
              </a>
            ) : (
              image
            ))}

          {popup.is_promo_code && popup.promo_code?.trim() && (
            <PromoCodeBlock code={popup.promo_code.trim()} />
          )}

          {popup.body_html?.trim() && (
            <div
              className="prose prose-sm max-w-none px-5 pt-4 text-sm text-foreground [&_a]:underline [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: popup.body_html }}
            />
          )}

          <div className="px-4 py-3 bg-background">
            <DontShowAgainCheckbox
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
              id={`popup-dsa-${popup.id}`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SitePopups() {
  const [queue, setQueue] = useState<SitePopup[]>([]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("site_popups")
        .select("id, title, body_html, image_url, link_url, is_promo_code, promo_code")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (cancelled) return;
      let list = (data ?? []).filter(
        (p) =>
          !getPermanentlyDismissed(p.id) &&
          !sessionStorage.getItem(SESSION_PREFIX + p.id),
      ) as SitePopup[];

      // Hide promo-code popups whose coupon the signed-in user has already used.
      const codes = list
        .filter((p) => p.is_promo_code && p.promo_code?.trim())
        .map((p) => p.promo_code!.trim().toUpperCase());
      if (codes.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userData?.user) {
          const { data: usedOrders } = await supabase
            .from("orders")
            .select("coupon_code")
            .eq("user_id", userData.user.id)
            .not("coupon_code", "is", null);
          if (cancelled) return;
          const used = new Set(
            (usedOrders ?? []).map((o) => (o.coupon_code ?? "").trim().toUpperCase()),
          );
          list = list.filter((p) => {
            const code = p.is_promo_code ? p.promo_code?.trim().toUpperCase() : null;
            if (!code || !used.has(code)) return true;
            // Never show this coupon popup to this user again.
            setPermanentlyDismissed(p.id, true);
            return false;
          });
        }
      }

      list.forEach((p) => sessionStorage.setItem(SESSION_PREFIX + p.id, "1"));
      setQueue(list);
      setTimeout(() => !cancelled && setReady(true), 900);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || index >= queue.length) return null;
  const current = queue[index]!;
  return (
    <PopupDialog
      key={current.id}
      popup={current}
      onClosed={() => setIndex((i) => i + 1)}
    />
  );
}
