import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        q: z.string().optional(),
        includeInactive: z.boolean().optional(),
        ganancias: z.enum(["monthly", "ddjj"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    const { ensureStaff, listClientsImpl } = await import("@/lib/server/clients");
    const staff = await ensureStaff(context.userId);
    return listClientsImpl(staff.estudioId, data);
  });

export const searchClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ q: z.string() }))
  .handler(async ({ context, data }) => {
    const { ensureStaff, searchClientsImpl } = await import("@/lib/server/clients");
    const staff = await ensureStaff(context.userId);
    return searchClientsImpl(staff.estudioId, data.q);
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const { ensureStaff, fetchClientById } = await import("@/lib/server/clients");
    const staff = await ensureStaff(context.userId);
    return fetchClientById(data.id, staff.estudioId);
  });

const clientInput = z.object({
  name: z.string().trim().min(2, "Ingresá la razón social"),
  contact: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  cuit: z.string().trim().optional().nullable(),
  companyType: z.string().trim().optional().nullable(),
  ivaCondition: z.string().trim().optional().nullable(),
  monotributoCategory: z.string().trim().optional().nullable(),
  feeKind: z.enum(["modules", "amount", "variable"]),
  monthlyModules: z.number().min(0),
  monthlyAmount: z.number().min(0),
  gananciasInMonthly: z.boolean(),
  active: z.boolean().optional(),
});

export const createClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(clientInput)
  .handler(async ({ context, data }) => {
    const { createClientImpl } = await import("@/lib/server/clients");
    return createClientImpl(context.userId, data);
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(clientInput.extend({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const { updateClientImpl } = await import("@/lib/server/clients");
    return updateClientImpl(context.userId, data);
  });
