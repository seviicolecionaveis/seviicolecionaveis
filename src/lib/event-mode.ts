import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const EVENT_MODE_KEY = "event_mode";

export const DEFAULT_EVENT_MODE_MESSAGE =
  "Estamos em um evento presencial. As vendas online estão temporariamente pausadas e voltam em breve.";

export interface EventModeSetting {
  enabled: boolean;
  message: string;
}

export function parseEventMode(value: unknown): EventModeSetting {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    message: typeof v.message === "string" && v.message.trim()
      ? v.message.trim()
      : DEFAULT_EVENT_MODE_MESSAGE,
  };
}

export async function fetchEventMode(): Promise<EventModeSetting> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", EVENT_MODE_KEY)
    .maybeSingle();
  return parseEventMode((data as { value?: unknown } | null)?.value);
}

export function useEventMode() {
  const [eventMode, setEventMode] = useState<EventModeSetting>({
    enabled: false,
    message: DEFAULT_EVENT_MODE_MESSAGE,
  });
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      setEventMode(await fetchEventMode());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchEventMode()
      .then((v) => { if (active) setEventMode(v); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { eventMode, loading, reload };
}
