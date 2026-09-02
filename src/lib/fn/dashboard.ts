import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getDashboardImpl } = await import("@/lib/server/dashboard");
    return getDashboardImpl(context.userId);
  });
