import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export type VocabKind =
  | "payment_method"
  | "transfer_account"
  | "documentation"
  | "company_type"
  | "iva_condition"
  | "monotributo_category";

export type VocabEntry = {
  value: string;
  kindLabel: string | null;
  active: boolean;
  sortOrder: number;
};

const VALID_KINDS: VocabKind[] = [
  "payment_method",
  "transfer_account",
  "documentation",
  "company_type",
  "iva_condition",
  "monotributo_category",
];

function makeValidator() {
  return z.object({ kind: z.enum(VALID_KINDS) });
}

function makeValidatorWithData() {
  return z.object({
    kind: z.enum(VALID_KINDS),
    data: z.object({
      value: z.string().trim().min(1, "Ingresá un valor"),
      kindLabel: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }),
  });
}

function makeValidatorDelete() {
  return z.object({
    kind: z.enum(VALID_KINDS),
    value: z.string().trim().min(1),
  });
}

function makeValidatorToggle() {
  return z.object({
    kind: z.enum(VALID_KINDS),
    value: z.string().trim().min(1),
    active: z.boolean(),
  });
}

function makeValidatorReorder() {
  return z.object({
    kind: z.enum(VALID_KINDS),
    values: z.array(z.string().trim().min(1)),
  });
}

// Each handler imports from the server module to avoid circular dependencies
export const listVocabByKind = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(makeValidator())
  .handler(async ({ context, data }) => {
    const { listVocab } = await import("@/lib/server/estudio-vocab");
    const staff = await (await import("@/lib/server/staff")).ensureStaff(context.userId);
    return listVocab(staff.estudioId, data.kind);
  });

export const listAllVocab = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listAllVocab } = await import("@/lib/server/estudio-vocab");
    const staff = await (await import("@/lib/server/staff")).ensureStaff(context.userId);
    return listAllVocab(staff.estudioId);
  });

export const upsertVocabEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(makeValidatorWithData())
  .handler(async ({ context, data }) => {
    const { upsertVocabEntry } = await import("@/lib/server/estudio-vocab");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return upsertVocabEntry(context.userId, data.kind, data.data);
  });

export const deleteVocabEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(makeValidatorDelete())
  .handler(async ({ context, data }) => {
    const { deleteVocabEntry } = await import("@/lib/server/estudio-vocab");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return deleteVocabEntry(context.userId, data.kind, data.value);
  });

export const toggleVocabEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(makeValidatorToggle())
  .handler(async ({ context, data }) => {
    const { toggleVocabEntry } = await import("@/lib/server/estudio-vocab");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return toggleVocabEntry(context.userId, data.kind, data.value, data.active);
  });

export const reorderVocab = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(makeValidatorReorder())
  .handler(async ({ context, data }) => {
    const { reorderVocab } = await import("@/lib/server/estudio-vocab");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return reorderVocab(context.userId, data.kind, data.values);
  });