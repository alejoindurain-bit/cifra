import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const getTransferReport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12).nullable(),
      account: z.string().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { getTransferReportImpl } = await import("@/lib/server/cobranzas");
    return getTransferReportImpl(context.userId, data);
  });
