import { z } from "zod";

const ItemSchema = z.object({
  cardId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  image: z.string().max(500).optional().nullable(),
  collection: z.string().max(200).optional().nullable(),
  number: z.string().max(50).optional().nullable(),
  finish: z.string().max(50),
  language: z.string().max(50),
  condition: z.string().max(10).optional().nullable(),
  unitPrice: z.number().positive().max(100000),
  quantity: z.number().int().positive().max(100),
});

const AddressSchema = z.object({
  recipientName: z.string().min(2).max(150),
  cpf: z.string().max(20).optional().nullable(),
  phone: z.string().min(8).max(30),
  cep: z.string().min(8).max(10),
  street: z.string().min(2).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().min(1).max(150),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
});

export const StripeInputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  shippingMethod: z.enum(["fixed", "arrange"]),
  address: AddressSchema,
  notes: z.string().max(500).optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

export const PixInputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  shippingMethod: z.enum(["fixed", "arrange"]),
  address: AddressSchema,
  notes: z.string().max(500).optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
});

export type StripeInput = z.infer<typeof StripeInputSchema>;
export type PixInput = z.infer<typeof PixInputSchema>;
