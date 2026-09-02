import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const exportClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listClientsImpl } = await import("@/lib/server/clients");
    const owner = await requireOwner(context.userId);
    return listClientsImpl(owner.estudioId, { includeInactive: true });
  });

export const exportLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listAllLedgerImpl } = await import("@/lib/server/transactions");
    const owner = await requireOwner(context.userId);
    return listAllLedgerImpl(owner.estudioId);
  });

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listClientsImpl } = await import("@/lib/server/clients");
    const { listAllLedgerImpl } = await import("@/lib/server/transactions");
    const owner = await requireOwner(context.userId);
    const [clients, ledger] = await Promise.all([
      listClientsImpl(owner.estudioId, { includeInactive: true }),
      listAllLedgerImpl(owner.estudioId),
    ]);
    return { clients, ledger };
  });
