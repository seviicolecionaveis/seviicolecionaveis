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

export interface LoyaltyUserSummary {
  user_id: string;
  email: string | null;
  full_name: string | null;
  balance: number;
  lifetime_earned: number;
  tier: string;
  multiplier_bp: number;
  birth_date: string | null;
}

export async function searchLoyaltyUsers(adminId: string, query: string) {
  await assertAdmin(adminId);
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Try matching profiles by full_name first
  const { data: profileMatches } = await supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, birth_date")
    .ilike("full_name", `%${q}%`)
    .limit(20);

  const matched: { user_id: string; full_name: string | null; birth_date: string | null; email: string | null }[] = [];

  for (const p of profileMatches ?? []) {
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
      matched.push({
        user_id: p.user_id,
        full_name: p.full_name,
        birth_date: p.birth_date,
        email: u?.user?.email ?? null,
      });
    } catch {}
  }

  // Also search by email (paginate auth users)
  if (q.includes("@") || q.length >= 3) {
    let page = 1;
    while (page < 10 && matched.length < 30) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of list.users) {
        if (matched.find((m) => m.user_id === u.id)) continue;
        if ((u.email ?? "").toLowerCase().includes(q)) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("full_name, birth_date")
            .eq("user_id", u.id)
            .maybeSingle();
          matched.push({
            user_id: u.id,
            email: u.email ?? null,
            full_name: prof?.full_name ?? null,
            birth_date: prof?.birth_date ?? null,
          });
          if (matched.length >= 30) break;
        }
      }
      if (!list.users.length || list.users.length < 1000) break;
      page++;
    }
  }

  // Enrich with points data
  const results: LoyaltyUserSummary[] = [];
  for (const m of matched.slice(0, 30)) {
    const [bal, life, tier, mult] = await Promise.all([
      supabaseAdmin.rpc("user_points_balance", { _user_id: m.user_id }),
      supabaseAdmin.rpc("user_lifetime_earned", { _user_id: m.user_id }),
      supabaseAdmin.rpc("user_tier", { _user_id: m.user_id }),
      supabaseAdmin.rpc("user_tier_multiplier_bp", { _user_id: m.user_id }),
    ]);
    results.push({
      user_id: m.user_id,
      email: m.email,
      full_name: m.full_name,
      birth_date: m.birth_date,
      balance: Number(bal.data ?? 0),
      lifetime_earned: Number(life.data ?? 0),
      tier: (tier.data as string) ?? "bronze",
      multiplier_bp: Number(mult.data ?? 10000),
    });
  }

  results.sort((a, b) => b.balance - a.balance);
  return results;
}

export async function getUserLoyaltyDetail(adminId: string, targetUserId: string) {
  await assertAdmin(adminId);

  const { data: u } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("full_name, birth_date, whatsapp")
    .eq("user_id", targetUserId)
    .maybeSingle();

  const [bal, life, tier, mult] = await Promise.all([
    supabaseAdmin.rpc("user_points_balance", { _user_id: targetUserId }),
    supabaseAdmin.rpc("user_lifetime_earned", { _user_id: targetUserId }),
    supabaseAdmin.rpc("user_tier", { _user_id: targetUserId }),
    supabaseAdmin.rpc("user_tier_multiplier_bp", { _user_id: targetUserId }),
  ]);

  const { data: history } = await supabaseAdmin
    .from("loyalty_points_ledger")
    .select("id, delta, reason, description, order_id, created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    user_id: targetUserId,
    email: u?.user?.email ?? null,
    full_name: prof?.full_name ?? null,
    whatsapp: prof?.whatsapp ?? null,
    birth_date: prof?.birth_date ?? null,
    balance: Number(bal.data ?? 0),
    lifetime_earned: Number(life.data ?? 0),
    tier: (tier.data as string) ?? "bronze",
    multiplier_bp: Number(mult.data ?? 10000),
    history: history ?? [],
  };
}

export async function adjustUserPoints(
  adminId: string,
  targetUserId: string,
  delta: number,
  description: string,
) {
  await assertAdmin(adminId);
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Response("Quantidade inválida.", { status: 400 });
  }
  if (Math.abs(delta) > 1_000_000) {
    throw new Response("Quantidade muito grande.", { status: 400 });
  }

  // If debiting, ensure user has balance
  if (delta < 0) {
    const { data: bal } = await supabaseAdmin.rpc("user_points_balance", { _user_id: targetUserId });
    if (Number(bal ?? 0) + delta < 0) {
      throw new Response("Saldo insuficiente para este débito.", { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.from("loyalty_points_ledger").insert({
    user_id: targetUserId,
    delta,
    reason: "admin_adjust",
    description: description.trim().slice(0, 500) || (delta > 0 ? "Ajuste manual (crédito)" : "Ajuste manual (débito)"),
    metadata: { admin_id: adminId },
  });
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true };
}

export async function getLoyaltyStats(adminId: string) {
  await assertAdmin(adminId);

  // Total points outstanding (sum of all deltas)
  const { data: ledger } = await supabaseAdmin
    .from("loyalty_points_ledger")
    .select("delta, reason, user_id, created_at");

  const rows = ledger ?? [];
  const balanceByUser = new Map<string, number>();
  let totalAwarded = 0;
  let totalRedeemed = 0;
  let totalExpired = 0;
  let totalAdjusted = 0;
  for (const r of rows) {
    balanceByUser.set(r.user_id, (balanceByUser.get(r.user_id) ?? 0) + r.delta);
    if (r.delta > 0 && r.reason !== "admin_adjust") totalAwarded += r.delta;
    if (r.reason === "order_redeemed") totalRedeemed += -r.delta;
    if (r.reason === "expiration") totalExpired += -r.delta;
    if (r.reason === "admin_adjust") totalAdjusted += r.delta;
  }
  const totalOutstanding = Array.from(balanceByUser.values()).reduce((s, v) => s + Math.max(0, v), 0);
  const usersWithPoints = Array.from(balanceByUser.values()).filter((v) => v > 0).length;

  return {
    totalOutstanding,
    usersWithPoints,
    totalAwarded,
    totalRedeemed,
    totalExpired,
    totalAdjusted,
    totalLedgerEntries: rows.length,
  };
}

export async function listAllLoyaltyUsers(adminId: string) {
  await assertAdmin(adminId);

  const { data: ledger } = await supabaseAdmin
    .from("loyalty_points_ledger")
    .select("user_id, delta, reason");

  const balanceByUser = new Map<string, number>();
  const lifetimeByUser = new Map<string, number>();
  for (const r of ledger ?? []) {
    balanceByUser.set(r.user_id, (balanceByUser.get(r.user_id) ?? 0) + r.delta);
    if (r.delta > 0 && ["order_earned", "signup", "birthday"].includes(r.reason)) {
      lifetimeByUser.set(r.user_id, (lifetimeByUser.get(r.user_id) ?? 0) + r.delta);
    }
  }

  const userIds = Array.from(balanceByUser.entries())
    .filter(([, v]) => v > 0)
    .map(([uid]) => uid);

  if (userIds.length === 0) return [] as LoyaltyUserSummary[];

  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, birth_date")
    .in("user_id", userIds);
  const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));

  const emailMap = new Map<string, string | null>();
  let page = 1;
  while (page < 20) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of list.users) emailMap.set(u.id, u.email ?? null);
    if (!list.users.length || list.users.length < 1000) break;
    page++;
  }

  const results: LoyaltyUserSummary[] = userIds.map((uid) => {
    const lifetime = lifetimeByUser.get(uid) ?? 0;
    const tier = lifetime >= 20000 ? "gold" : lifetime >= 5000 ? "silver" : "bronze";
    const mult = tier === "gold" ? 15000 : tier === "silver" ? 12500 : 10000;
    const p = profMap.get(uid);
    return {
      user_id: uid,
      email: emailMap.get(uid) ?? null,
      full_name: p?.full_name ?? null,
      birth_date: p?.birth_date ?? null,
      balance: balanceByUser.get(uid) ?? 0,
      lifetime_earned: lifetime,
      tier,
      multiplier_bp: mult,
    };
  });

  results.sort((a, b) => b.balance - a.balance);
  return results;
}
