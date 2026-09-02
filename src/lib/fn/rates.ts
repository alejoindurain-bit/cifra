import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const getModuleValue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureStaff } = await import("@/lib/server/staff");
    const { fetchModuleValue } = await import("@/lib/server/rates");
    const staff = await ensureStaff(context.userId);
    return fetchModuleValue(staff.estudioId);
  });

export const getDollarRate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureStaff } = await import("@/lib/server/staff");
    const { fetchDollarRate } = await import("@/lib/server/rates");
    await ensureStaff(context.userId);
    return fetchDollarRate();
  });
