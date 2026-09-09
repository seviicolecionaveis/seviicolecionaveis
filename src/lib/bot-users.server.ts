// Provisionamento de clientes a partir do WhatsApp (bot_seviicolecionaveis)
export const WHATSAPP_EMAIL_DOMAIN = "whatsapp.seviicolecionaveis.com.br";

export function randomPassword() {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}@1`;
}

export type EnsuredUser = {
  userId: string;
  email: string;
  created: boolean;
  /** Só é retornada quando o usuário foi criado agora ou quando resetPassword = true. */
  password: string | null;
};

/**
 * Localiza (por telefone/e-mail) ou cria o usuário do arrematante.
 * @param resetPassword força a geração de uma nova senha para usuário já existente.
 */
export async function ensureWhatsAppUser(
  phone: string,
  name: string | null,
  opts: { resetPassword?: boolean } = {},
): Promise<EnsuredUser | { error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = `${phone}@${WHATSAPP_EMAIL_DOMAIN}`;
  const password = randomPassword();

  const { data: prof } = await (supabaseAdmin as any)
    .from("profiles")
    .select("user_id")
    .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
    .maybeSingle();

  let userId: string | null = prof?.user_id ?? null;
  let created = false;

  if (!userId) {
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name ?? phone, phone, source: "bot_seviicolecionaveis" },
    });
    if (createErr) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list?.users?.find((u) => u.email === email);
      if (!found) return { error: createErr.message };
      userId = found.id;
    } else {
      userId = createdUser.user?.id ?? null;
      created = true;
    }
  }

  if (!userId) return { error: "Falha ao criar usuário" };

  if (!created && opts.resetPassword) {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (updErr) return { error: updErr.message };
  }

  await (supabaseAdmin as any).from("profiles").upsert(
    {
      user_id: userId,
      full_name: name ?? phone,
      phone,
      whatsapp: phone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return {
    userId,
    email,
    created,
    password: created || opts.resetPassword ? password : null,
  };
}
