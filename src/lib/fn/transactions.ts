import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.number(),
      amount: z.number().positive("El monto debe ser mayor a cero"),
      date: z.string().min(8),
      documentation: z.array(z.string()).min(1, "Elegí al menos un comprobante"),
      paymentMethod: z.string().min(1),
      dollarRate: z.number().positive().optional().nullable(),
      observations: z.string().optional().nullable(),
      transferAccount: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { recordPaymentImpl } = await import("@/lib/server/transactions");
    return recordPaymentImpl(context.userId, data);
  });

export const recordExtraordinaryCharge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.number(),
      concept: z.string().trim().min(3, "Describí el trabajo"),
      amount: z.number().positive("El monto debe ser mayor a cero"),
      date: z.string().min(8),
    }),
  )
  .handler(async ({ context, data }) => {
    const { recordExtraordinaryChargeImpl } = await import("@/lib/server/transactions");
    return recordExtraordinaryChargeImpl(context.userId, data);
  });

export const getClientAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ clientId: z.number() }))
  .handler(async ({ context, data }) => {
    const { getClientAccountImpl } = await import("@/lib/server/transactions");
    return getClientAccountImpl(context.userId, data.clientId);
  });

export const listLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        clientId: z.number().optional(),
        type: z.enum(["charge", "payment", "all"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        q: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listLedgerImpl } = await import("@/lib/server/transactions");
    const owner = await requireOwner(context.userId);
    return listLedgerImpl(owner.estudioId, data);
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number(),
      clientId: z.number(),
      date: z.string().min(8),
      concept: z.string().trim().min(3, "Describí el concepto"),
      amount: z.number().positive("El monto debe ser mayor a cero"),
      documentation: z.array(z.string()).optional(),
      paymentMethod: z.string().optional().nullable(),
      dollarRate: z.number().positive().optional().nullable(),
      observations: z.string().optional().nullable(),
      transferAccount: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { updateTransactionImpl } = await import("@/lib/server/transactions");
    return updateTransactionImpl(context.userId, data);
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const { deleteTransactionImpl } = await import("@/lib/server/transactions");
    return deleteTransactionImpl(context.userId, data.id);
  });
