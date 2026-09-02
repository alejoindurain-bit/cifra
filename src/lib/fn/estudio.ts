import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { PAYMENT_METHOD_KINDS } from "@/lib/constants";

const flagsSchema = z.object({
  caja: z.boolean(),
  cuentaCorriente: z.boolean(),
  honorarios: z.boolean(),
  cpceba: z.boolean(),
  cobrosFijos: z.boolean(),
  honorariosMensuales: z.boolean(),
  honorariosExtraordinarios: z.boolean(),
  pbaIibb: z.boolean(),
  vencimientos: z.boolean(),
  dashCobradoMes: z.boolean(),
  dashPendiente: z.boolean(),
  dashVencimientos: z.boolean(),
  dashGrafico: z.boolean(),
  dashIibbPba: z.boolean(),
});

export const updateEstudioSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      displayName: z.string().trim().min(2, "Ingresá el nombre del estudio"),
      accentColor: z.string().trim().optional().nullable(),
      flags: flagsSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { updateEstudioSettingsImpl } = await import("@/lib/server/estudio");
    const owner = await requireOwner(context.userId);
    return updateEstudioSettingsImpl(owner.estudioId, data);
  });

export const upsertPaymentMethod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1, "Ingresá el nombre del medio"),
      kind: z.enum(PAYMENT_METHOD_KINDS),
      bank: z.string().trim().optional().nullable(),
      cbuAlias: z.string().trim().optional().nullable(),
      active: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { upsertPaymentMethodImpl } = await import("@/lib/server/estudio");
    const owner = await requireOwner(context.userId);
    return upsertPaymentMethodImpl(owner.estudioId, data);
  });
