import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    const full = pathname + (search ? `?${search}` : "");
    trackPageView(full);
  }, [pathname, search]);

  return null;
}
