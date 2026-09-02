import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import type { EstudioMetadata } from "@/lib/fn/types";

type Row = {
  logo_path: string | null;
  domicilio_calle: string | null;
  domicilio_numero: string | null;
  domicilio_piso: string | null;
  domicilio_depto: string | null;
  domicilio_localidad: string | null;
  domicilio_provincia: string | null;
  domicilio_cp: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
};

const EMPTY: EstudioMetadata = {
  logoPath: null,
  domicilio: {
    calle: null,
    numero: null,
    piso: null,
    depto: null,
    localidad: null,
    provincia: null,
    cp: null,
  },
  cuit: null,
  telefono: null,
  email: null,
  web: null,
};

function mapRow(r: Row): EstudioMetadata {
  return {
    logoPath: r.logo_path,
    domicilio: {
      calle: r.domicilio_calle,
      numero: r.domicilio_numero,
      piso: r.domicilio_piso,
      depto: r.domicilio_depto,
      localidad: r.domicilio_localidad,
      provincia: r.domicilio_provincia,
      cp: r.domicilio_cp,
    },
    cuit: r.cuit,
    telefono: r.telefono,
    email: r.email,
    web: r.web,
  };
}

function emptyMetadata(): EstudioMetadata {
  return {
    logoPath: null,
    domicilio: { ...EMPTY.domicilio },
    cuit: null,
    telefono: null,
    email: null,
    web: null,
  };
}

export async function getEstudioMetadata(estudioId: string): Promise<EstudioMetadata | null> {
  const sql = await getSql();
  const rows = await sql<Row>`
    select
      logo_path, domicilio_calle, domicilio_numero, domicilio_piso,
      domicilio_depto, domicilio_localidad, domicilio_provincia, domicilio_cp,
      cuit, telefono, email, web
    from estudio_metadata
    where estudio_id = ${estudioId}
    limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getEstudioMetadataOrEmpty(estudioId: string): Promise<EstudioMetadata> {
  return (await getEstudioMetadata(estudioId)) ?? emptyMetadata();
}

export type EstudioMetadataInput = {
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  domicilio?: Partial<EstudioMetadata["domicilio"]>;
};

export async function updateEstudioMetadata(
  estudioId: string,
  data: EstudioMetadataInput,
): Promise<EstudioMetadata> {
  const sql = await getSql();
  const d = data.domicilio ?? {};
  // Logo is owned by uploadLogo/removeLogo, not by this upsert — we never
  // touch logo_path here so uploading then editing text doesn't wipe the logo.
  const rows = await sql<Row>`
    insert into estudio_metadata (
      estudio_id,
      domicilio_calle, domicilio_numero, domicilio_piso, domicilio_depto,
      domicilio_localidad, domicilio_provincia, domicilio_cp,
      cuit, telefono, email, web
    ) values (
      ${estudioId},
      ${d.calle ?? null}, ${d.numero ?? null}, ${d.piso ?? null}, ${d.depto ?? null},
      ${d.localidad ?? null}, ${d.provincia ?? null}, ${d.cp ?? null},
      ${data.cuit ?? null}, ${data.telefono ?? null}, ${data.email ?? null}, ${data.web ?? null}
    )
    on conflict (estudio_id) do update set
      domicilio_calle = excluded.domicilio_calle,
      domicilio_numero = excluded.domicilio_numero,
      domicilio_piso = excluded.domicilio_piso,
      domicilio_depto = excluded.domicilio_depto,
      domicilio_localidad = excluded.domicilio_localidad,
      domicilio_provincia = excluded.domicilio_provincia,
      domicilio_cp = excluded.domicilio_cp,
      cuit = excluded.cuit,
      telefono = excluded.telefono,
      email = excluded.email,
      web = excluded.web
    returning
      logo_path, domicilio_calle, domicilio_numero, domicilio_piso,
      domicilio_depto, domicilio_localidad, domicilio_provincia, domicilio_cp,
      cuit, telefono, email, web
  `;
  return mapRow(rows[0]);
}

const LOGOS_DIR = "public/uploads/logos";

function extForMime(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/svg+xml") return ".svg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return "";
}

export async function saveEstudioLogo(
  estudioId: string,
  file: File,
): Promise<{ path: string }> {
  const ext = extForMime(file.type);
  const filename = `${estudioId}${ext}`;
  const dir = join(process.cwd(), LOGOS_DIR);
  await mkdir(dir, { recursive: true });
  const fullPath = join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);
  // Public path served by Vite / Nitro at /uploads/logos/{filename}
  const publicPath = `/uploads/logos/${filename}`;
  const sql = await getSql();
  await sql`update estudio_metadata set logo_path = ${publicPath} where estudio_id = ${estudioId}`;
  return { path: publicPath };
}

export async function removeEstudioLogo(estudioId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ logo_path: string | null }>`
    select logo_path from estudio_metadata where estudio_id = ${estudioId}
  `;
  const path = rows[0]?.logo_path;
  if (path) {
    const filename = path.split("/").pop() ?? "";
    if (filename.startsWith(estudioId)) {
      try {
        await unlink(join(process.cwd(), LOGOS_DIR, filename));
      } catch {
        // File may already be gone; not an error.
      }
    }
  }
  await sql`update estudio_metadata set logo_path = null where estudio_id = ${estudioId}`;
}

export const __test = { EMPTY, mapRow };
