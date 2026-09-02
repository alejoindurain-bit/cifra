import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { VENCIMIENTO_KINDS, VENCIMIENTO_STATUSES } from "@/lib/constants";

const statusFilter = z.enum(["pendiente", "cumplido", "all"]);

export const listVencimientos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ status: statusFilter.optional() }).optional())
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listVencimientosImpl } = await import("@/lib/server/vencimientos");
    const owner = await requireOwner(context.userId);
    return listVencimientosImpl(owner.estudioId, data);
  });

const vencimientoInput = z.object({
  id: z.number().optional(),
  title: z.string().trim().min(2, "Ingresá el título"),
  dueDate: z.string().min(8, "Ingresá una fecha"),
  kind: z.enum(VENCIMIENTO_KINDS),
  clientId: z.number().nullable().optional(),
  status: z.enum(VENCIMIENTO_STATUSES).optional(),
});

export const upsertVencimiento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(vencimientoInput)
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { upsertVencimientoImpl } = await import("@/lib/server/vencimientos");
    const owner = await requireOwner(context.userId);
    return upsertVencimientoImpl(owner.estudioId, data);
  });

export const setVencimientoStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number(),
      status: z.enum(VENCIMIENTO_STATUSES),
    }),
  )
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { setVencimientoStatusImpl } = await import("@/lib/server/vencimientos");
    const owner = await requireOwner(context.userId);
    return setVencimientoStatusImpl(owner.estudioId, data.id, data.status);
  });
