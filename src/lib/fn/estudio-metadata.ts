import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const domicilioSchema = z.object({
  calle: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  piso: z.string().optional().nullable(),
  depto: z.string().optional().nullable(),
  localidad: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  cp: z.string().optional().nullable(),
});

const updateInputSchema = z.object({
  cuit: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  web: z.string().optional().nullable(),
  domicilio: domicilioSchema.optional(),
});

export const getMetadata = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getEstudioMetadata } = await import("@/lib/server/estudio-metadata");
    const staff = await (await import("@/lib/server/staff")).ensureStaff(context.userId);
    return getEstudioMetadata(staff.estudioId);
  });

export const updateMetadata = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => updateInputSchema.parse(raw))
  .handler(async ({ context, data }) => {
    const { updateEstudioMetadata } = await import("@/lib/server/estudio-metadata");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    return updateEstudioMetadata(owner.estudioId, data);
  });

export const uploadLogo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const obj = raw as { filename?: unknown; mimeType?: unknown; contentBase64?: unknown };
    if (typeof obj?.contentBase64 !== "string" || !obj.contentBase64) {
      throw new Error("Adjuntá un archivo de imagen");
    }
    if (typeof obj.filename !== "string" || !obj.filename) {
      throw new Error("Nombre de archivo inválido");
    }
    if (typeof obj.mimeType !== "string" || !obj.mimeType) {
      throw new Error("Tipo de archivo inválido");
    }
    return {
      filename: obj.filename,
      mimeType: obj.mimeType,
      contentBase64: obj.contentBase64,
    };
  })
  .handler(async ({ context, data }) => {
    const { saveEstudioLogo } = await import("@/lib/server/estudio-metadata");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    const bytes = Buffer.from(data.contentBase64, "base64");
    const file = new File([bytes], data.filename, { type: data.mimeType });
    return saveEstudioLogo(owner.estudioId, file);
  });

export const removeLogo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { removeEstudioLogo } = await import("@/lib/server/estudio-metadata");
    const { requireOwner } = await import("@/lib/server/staff");
    const owner = await requireOwner(context.userId);
    await removeEstudioLogo(owner.estudioId);
    return { ok: true };
  });
