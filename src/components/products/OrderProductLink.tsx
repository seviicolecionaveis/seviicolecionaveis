import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
export function OrderProductLink({ cardId, name }: { cardId: string | null; name: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  const accessory = cardId?.startsWith("accessory:");
  useEffect(() => {
    let mounted = true;
    setSlug(null);
    if (accessory) {
      void supabase
        .from("accessories")
        .select("slug")
        .eq("id", cardId?.split(":")[1] ?? "")
        .maybeSingle()
        .then(({ data }) => {
          if (mounted) setSlug(data?.slug ?? null);
        });
    }
    return () => {
      mounted = false;
    };
  }, [cardId, accessory]);
  return accessory && slug ? (
    <Link
      to="/acessorios/$slug"
      params={{ slug }}
      className="underline decoration-border underline-offset-4 hover:text-primary"
    >
      {name}
    </Link>
  ) : (
    <>{name}</>
  );
}
