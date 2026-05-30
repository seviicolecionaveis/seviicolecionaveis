import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "Código deve conter apenas letras, números, _ e -");

const discountShape = z
  .object({
    percent: z.number().int().min(1).max(100).nullable().optional(),
    amount_cents: z.number().int().min(1).max(10_000_000).nullable().optional(),
  })
  .refine(
    (v) =>
      (v.percent && !v.amount_cents) || (!v.percent && v.amount_cents),
    { message: "Informe percent OU amount_cents (exatamente um)." },
  );

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCouponsServer } = await import("./coupons.server");
    return listCouponsServer(context.userId);
  });

export const createBroadcastCoupon = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: codeSchema,
        percent: z.number().int().min(1).max(100).nullable(),
        amount_cents: z.number().int().min(1).max(10_000_000).nullable(),
        max_uses: z.number().int().min(1).max(100_000),
        expires_at: z.string().datetime().nullable(),
        message: z.string().trim().max(500).nullable(),
        send_email: z.boolean(),
      })
      .superRefine((v, ctx) => {
        const res = discountShape.safeParse({ percent: v.percent, amount_cents: v.amount_cents });
        if (!res.success) ctx.addIssue({ code: "custom", message: res.error.issues[0].message });
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { createBroadcastCouponServer } = await import("./coupons.server");
    return createBroadcastCouponServer(context.userId, data);
  });

export const createGiftVoucher = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: codeSchema,
        email: z.string().trim().email().max(255),
        percent: z.number().int().min(1).max(100).nullable(),
        amount_cents: z.number().int().min(1).max(10_000_000).nullable(),
        expires_at: z.string().datetime().nullable(),
        notes: z.string().trim().max(500).nullable(),
      })
      .superRefine((v, ctx) => {
        const res = discountShape.safeParse({ percent: v.percent, amount_cents: v.amount_cents });
        if (!res.success) ctx.addIssue({ code: "custom", message: res.error.issues[0].message });
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { createGiftVoucherServer } = await import("./coupons.server");
    return createGiftVoucherServer(context.userId, data);
  });

export const sendGiftVoucherEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ coupon_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { sendGiftVoucherEmailServer } = await import("./coupons.server");
    return sendGiftVoucherEmailServer(context.userId, data.coupon_id);
  });

export const setCouponActive = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ coupon_id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { setCouponActiveServer } = await import("./coupons.server");
    return setCouponActiveServer(context.userId, data.coupon_id, data.active);
  });

export const countBroadcastRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { countBroadcastRecipientsServer } = await import("./coupons.server");
    return countBroadcastRecipientsServer(context.userId);
  });

export const previewCouponEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["broadcast", "voucher"]),
        code: codeSchema,
        percent: z.number().int().min(1).max(100).nullable(),
        amount_cents: z.number().int().min(1).max(10_000_000).nullable(),
        expires_at: z.string().datetime().nullable(),
        message: z.string().max(500).nullable().optional(),
        recipient_email: z.string().email().max(255).nullable().optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { previewCouponEmailServer } = await import("./coupons.server");
    return previewCouponEmailServer(context.userId, data);
  });

