import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const triggerMonthlyBilling = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    const { runMonthlyBillingIfDue } = await import("@/lib/server/billing");
    return runMonthlyBillingIfDue(owner.estudioId, true);
  });

const fromMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Elegí un mes de inicio");

export const previewHonorariosBackfill = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.number().optional(),
      monthlyModules: z.number().positive().optional(),
      monthlyAmount: z.number().positive().optional(),
      from: fromMonth,
    }),
  )
  .handler(async ({ context, data }) => {
    const { previewHonorariosBackfillImpl } = await import("@/lib/server/billing");
    return previewHonorariosBackfillImpl(context.userId, data);
  });

export const runHonorariosBackfill = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.number(),
      from: fromMonth,
    }),
  )
  .handler(async ({ context, data }) => {
    const { runHonorariosBackfillImpl } = await import("@/lib/server/billing");
    return runHonorariosBackfillImpl(context.userId, data);
  });
