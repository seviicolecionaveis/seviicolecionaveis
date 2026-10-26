import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validCpf } from "@/lib/customer-payment";

export interface CustomerSearchRow {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  birth_date: string | null;
  email: string | null;
  created_at: string;
  orders_count: number;
  total: number;
}

export async function searchCustomersServer(
  search: string,
  limit: number,
  offset: number
): Promise<{ rows: CustomerSearchRow[]; total: number }> {
  const { data, error } = await supabaseAdmin.rpc("admin_search_customers", {
    _search: search.trim() || "",
    _limit: limit,
    _offset: offset,
  });
  if (error) throw new Response(error.message, { status: 500 });
  const rows = (data ?? []) as CustomerSearchRow[];
  return { rows, total: rows.length > 0 ? Number(rows[0].total) : 0 };
}

export interface CustomerDetail {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  birth_date: string | null;
  favorite_pokemons: string[];
  favorite_categories: string[];
  email: string | null;
  email_confirmed: boolean;
  signup_at: string | null;
  last_sign_in_at: string | null;
  whatsapp_linked: boolean;
  points_balance: number;
  tier: string | null;
  credit_balance_cents: number;
  addresses: Array<{
    id: string;
    label: string | null;
    recipient_name: string;
    cep: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    is_default: boolean;
  }>;
  orders: Array<{
    id: string;
    status: string;
    total_cents: number;
    created_at: string;
    origin: string | null;
  }>;
  points_ledger: Array<{
    id: string;
    delta: number;
    reason: string;
    created_at: string;
    description: string | null;
  }>;
}

export async function getCustomerDetailServer(userId: string): Promise<CustomerDetail> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!profile) throw new Response("Cliente não encontrado.", { status: 404 });

  const [authRes, addressesRes, ordersRes, pointsRes, tierRes, creditRes, ledgerRes] =
    await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin
        .from("addresses")
        .select("id,label,recipient_name,cep,street,number,complement,neighborhood,city,state,is_default")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("orders")
        .select("id,status,total_cents,created_at,origin")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin.rpc("user_points_balance", { _user_id: userId }),
      supabaseAdmin.rpc("user_tier", { _user_id: userId }),
      supabaseAdmin
        .from("customer_credit_accounts")
        .select("balance_cents")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("loyalty_points_ledger")
        .select("id,delta,reason,created_at,description")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  if (authRes.error) throw new Response(authRes.error.message, { status: 500 });
  const u = authRes.data?.user;

  return {
    user_id: userId,
    full_name: profile.full_name ?? null,
    cpf: profile.cpf ?? null,
    phone: profile.phone ?? null,
    whatsapp: profile.whatsapp ?? null,
    birth_date: profile.birth_date ?? null,
    favorite_pokemons: profile.favorite_pokemons ?? [],
    favorite_categories: profile.favorite_categories ?? [],
    email: u?.email ?? null,
    email_confirmed: Boolean(u?.email_confirmed_at),
    signup_at: profile.created_at ?? null,
    last_sign_in_at: u?.last_sign_in_at ?? null,
    whatsapp_linked: Boolean(profile.whatsapp),
    points_balance: Number(pointsRes.data ?? 0),
    tier: (tierRes.data as string | null) ?? null,
    credit_balance_cents: Number(creditRes.data?.balance_cents ?? 0),
    addresses: addressesRes.data ?? [],
    orders: ordersRes.data ?? [],
    points_ledger: ledgerRes.data ?? [],
  };
}

export interface UpdateCustomerInput {
  userId: string;
  fullName?: string | null;
  cpf?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  birthDate?: string | null;
  email?: string | null;
}

export async function updateCustomerServer(actorId: string, input: UpdateCustomerInput) {
  const changes: string[] = [];

  const profilePatch: Record<string, unknown> = {};
  if (input.fullName !== undefined) {
    const name = input.fullName?.trim() ?? "";
    if (name.length < 2 || name.length > 120) throw new Response("Nome inválido.", { status: 400 });
    profilePatch.full_name = name;
    changes.push("nome");
  }
  if (input.cpf !== undefined) {
    if (input.cpf === null || input.cpf.trim() === "") {
      profilePatch.cpf = null;
      changes.push("CPF removido");
    } else {
      const cpf = validCpf(input.cpf);
      if (!cpf) throw new Response("CPF inválido. Verifique os dígitos.", { status: 400 });
      // CPF must be unique across profiles when set.
      const { data: dup } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("cpf", cpf)
        .neq("user_id", input.userId)
        .limit(1);
      if (dup && dup.length > 0) {
        throw new Response("Este CPF já está cadastrado em outra conta.", { status: 400 });
      }
      profilePatch.cpf = cpf;
      changes.push("CPF");
    }
  }
  if (input.phone !== undefined) {
    const phone = input.phone?.trim() ?? "";
    if (phone && !/^[0-9 ()+\-]{8,20}$/.test(phone)) throw new Response("Telefone inválido.", { status: 400 });
    profilePatch.phone = phone || null;
    changes.push("telefone");
  }
  if (input.whatsapp !== undefined) {
    const wa = input.whatsapp?.trim() ?? "";
    if (wa && !/^[0-9 ()+\-]{8,20}$/.test(wa)) throw new Response("WhatsApp inválido.", { status: 400 });
    profilePatch.whatsapp = wa || null;
    changes.push("WhatsApp");
  }
  if (input.birthDate !== undefined) {
    const bd = input.birthDate?.trim() ?? "";
    if (bd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) throw new Response("Data de nascimento inválida.", { status: 400 });
      const d = new Date(`${bd}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
        throw new Response("Data de nascimento inválida.", { status: 400 });
      }
      profilePatch.birth_date = bd;
    } else {
      profilePatch.birth_date = null;
    }
    changes.push("data de nascimento");
  }

  if (Object.keys(profilePatch).length > 0) {
    profilePatch.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("profiles").update(profilePatch as any).eq("user_id", input.userId);
    if (error) throw new Response(error.message, { status: 500 });
  }

  if (input.email !== undefined && input.email !== null) {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Response("E-mail inválido.", { status: 400 });
    const { data: current } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    const oldEmail = current?.user?.email ?? null;
    if (email !== oldEmail) {
      const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
        email,
        // Admin fixing a wrong address: apply immediately, no confirmation loop.
        email_confirm: true,
      } as any);
      if (error || !updated?.user) {
        throw new Response(
          error?.message?.includes("already been registered")
            ? "Este e-mail já pertence a outra conta."
            : error?.message ?? "Não foi possível alterar o e-mail.",
          { status: 400 }
        );
      }
      changes.push("e-mail de login");
    }
  }

  return { ok: true, changes };
}

export interface AddressInput {
  userId: string;
  addressId?: string;
  label?: string | null;
  recipientName?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault?: boolean;
}

export async function upsertAddressServer(actorId: string, input: AddressInput) {
  const required = { cep: input.cep, street: input.street, number: input.number, neighborhood: input.neighborhood, city: input.city, state: input.state };
  for (const [k, v] of Object.entries(required)) {
    if (!String(v ?? "").trim()) throw new Response(`Preencha o campo ${k}.`, { status: 400 });
  }
  const patch: Record<string, unknown> = {
    user_id: input.userId,
    label: input.label?.trim() || null,
    recipient_name: input.recipientName?.trim() || "",
    cep: input.cep.trim(),
    street: input.street.trim(),
    number: input.number.trim(),
    complement: input.complement?.trim() || null,
    neighborhood: input.neighborhood.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase().slice(0, 2),
  };

  if (input.addressId) {
    const { error } = await supabaseAdmin.from("addresses").update(patch as any).eq("id", input.addressId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true, action: "updated" };
  }

  patch.is_default = input.isDefault ?? false;
  const { data, error } = await supabaseAdmin.from("addresses").insert(patch as any).select("id").single();
  if (error) throw new Response(error.message, { status: 500 });

  if (input.isDefault) {
    await supabaseAdmin
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", input.userId)
      .neq("id", data!.id);
  }
  return { ok: true, action: "created", id: data!.id as string };
}

export async function deleteAddressServer(actorId: string, userId: string, addressId: string) {
  const { error } = await supabaseAdmin
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", userId);
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true };
}

export async function setDefaultAddressServer(actorId: string, userId: string, addressId: string) {
  const { error: clearErr } = await supabaseAdmin
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (clearErr) throw new Response(clearErr.message, { status: 500 });
  const { error } = await supabaseAdmin
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("user_id", userId);
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true };
}
