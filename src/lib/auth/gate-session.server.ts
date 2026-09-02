import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import {
  GATE_IDENTITY_HEADER,
  gateIdentityEnabled,
} from "./gate-identity.server";

export const GATE_PROVIDER_ID = "grok-gate";

/**
 * Better Auth plugin hook on `/get-session`.
 *
 * This app is multi-user (dueño + empleados). The Grok viewer identity must
 * not auto-sign anyone in, and must not replace a correo/clave session —
 * that re-entered the previous owner after logout.
 */
export function gateIdentitySessions() {
  return {
    id: "grok-gate-identity",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            if (!gateIdentityEnabled()) return;
            const inbound = ctx.request?.headers ?? ctx.headers;
            if (!inbound) return;
            if (inbound.get("authorization")) return;
            if (!inbound.get(GATE_IDENTITY_HEADER)) return;
            return;
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
