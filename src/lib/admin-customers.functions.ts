import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CustomerDetail } from "@/lib/admin-customers.server";
export type { CustomerDetail };

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Acesso negado.");
}

const searchSchema = z.object({
  q: z.string().max(120).optional().default(""),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const searchCustomersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => searchSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { searchCustomersServer } = await import("@/lib/admin-customers.server");
    return searchCustomersServer(context.supabase, data.q, data.limit, data.offset);
  });

const detailSchema = z.object({ userId: z.string().uuid() });

export const getCustomerDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => detailSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getCustomerDetailServer } = await import("@/lib/admin-customers.server");
    return getCustomerDetailServer(data.userId);
  });

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().max(120).nullable().optional(),
  cpf: z.string().max(20).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  birthDate: z.string().max(10).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
});

export const updateCustomerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { updateCustomerServer } = await import("@/lib/admin-customers.server");
    return updateCustomerServer(context.userId, data as any);
  });

const addrSchema = z.object({
  userId: z.string().uuid(),
  addressId: z.string().uuid().optional(),
  label: z.string().max(60).nullable().optional(),
  recipientName: z.string().max(160).optional(),
  cep: z.string().max(20),
  street: z.string().max(200),
  number: z.string().max(30),
  complement: z.string().max(200).nullable().optional(),
  neighborhood: z.string().max(120),
  city: z.string().max(120),
  state: z.string().max(4),
  isDefault: z.boolean().optional(),
});

export const upsertAddressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addrSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { upsertAddressServer } = await import("@/lib/admin-customers.server");
    return upsertAddressServer(context.userId, data as any);
  });

const delAddrSchema = z.object({ userId: z.string().uuid(), addressId: z.string().uuid() });

export const deleteAddressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => delAddrSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { deleteAddressServer } = await import("@/lib/admin-customers.server");
    return deleteAddressServer(context.userId, data.userId, data.addressId);
  });

export const setDefaultAddressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => delAddrSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { setDefaultAddressServer } = await import("@/lib/admin-customers.server");
    return setDefaultAddressServer(context.userId, data.userId, data.addressId);
  });
