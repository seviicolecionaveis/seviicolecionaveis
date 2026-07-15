import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOwnedCardKeysInCollection } from "@/lib/collection-progress.functions";

export function useOwnedCollectionKeys(collection: string | null) {
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchOwned = useServerFn(getOwnedCardKeysInCollection);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !collection) {
      setOwnedKeys(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOwned({ data: { collection } })
      .then((r) => {
        if (!cancelled) setOwnedKeys(new Set(r.ownedKeys));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, collection, fetchOwned]);

  return { ownedKeys, loading, isSignedIn: !!userId };
}
