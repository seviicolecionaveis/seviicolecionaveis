import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { EVENT_MODE_KEY, parseEventMode } from "@/lib/event-mode";

export async function getEventModeServer() {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", EVENT_MODE_KEY)
    .maybeSingle();
  return parseEventMode((data as { value?: unknown } | null)?.value);
}

/** Lança erro quando o modo evento está ativo (vendas online bloqueadas). */
export async function assertSalesOpen() {
  const mode = await getEventModeServer();
  if (mode.enabled) throw new Error(mode.message);
}
