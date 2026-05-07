import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Response("Erro ao verificar permissão", { status: 500 });
  if (!data) throw new Response("Acesso negado", { status: 403 });
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin");
    if (error) throw new Response(error.message, { status: 500 });

    const result: { user_id: string; email: string | null; created_at: string }[] = [];
    for (const r of roles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      result.push({
        user_id: r.user_id,
        email: u?.user?.email ?? null,
        created_at: r.created_at,
      });
    }
    return result;
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const email = data.email.toLowerCase();
    // Find user by email by paginating auth users
    let foundId: string | null = null;
    let page = 1;
    while (page < 50 && !foundId) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Response(error.message, { status: 500 });
      const u = list.users.find((x) => x.email?.toLowerCase() === email);
      if (u) foundId = u.id;
      if (!list.users.length || list.users.length < 1000) break;
      page++;
    }
    if (!foundId) {
      throw new Response("Usuário não encontrado. Peça para fazer login pelo menos uma vez.", { status: 404 });
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: foundId, role: "admin" });
    if (insErr && !insErr.message.includes("duplicate")) {
      throw new Response(insErr.message, { status: 500 });
    }
    return { ok: true, user_id: foundId };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Response("Você não pode remover seu próprio acesso de admin.", { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
