import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const ensurePreview = createServerFn({ method: "GET" }).handler(async () => {
  const { seedPreviewData } = await import("@/lib/server/seed");
  await seedPreviewData();
  return { ok: true };
});

export const bootstrapSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { bootstrapSessionImpl } = await import("@/lib/server/staff");
    return bootstrapSessionImpl(context.userId);
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner, listStaffImpl } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return listStaffImpl(owner.estudioId);
  });

export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      role: z.enum(["owner", "employee"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { updateStaffRoleImpl } = await import("@/lib/server/staff");
    return updateStaffRoleImpl(context.userId, data.userId, data.role);
  });

export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(2, "Ingresá el nombre"),
      email: z.string().trim().email("Ingresá un correo válido"),
      password: z.string().min(8, "La clave tiene que tener al menos 8 caracteres"),
      role: z.enum(["owner", "employee"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { createStaffMemberImpl } = await import("@/lib/server/staff");
    return createStaffMemberImpl(context.userId, data);
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { setStaffActiveImpl } = await import("@/lib/server/staff");
    return setStaffActiveImpl(context.userId, data.userId, data.active);
  });
