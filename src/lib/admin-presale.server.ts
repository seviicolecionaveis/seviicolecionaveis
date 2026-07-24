import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Response("Erro ao verificar permissão", { status: 500 });
  if (!data) throw new Response("Acesso negado", { status: 403 });
}
