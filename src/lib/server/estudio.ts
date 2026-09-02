import { getSql } from "@/lib/db";
import { asBool } from "@/lib/utils";
import type {
  EstudioFlags,
  EstudioInfo,
  EstudioPaymentMethod,
  PaymentMethodKind,
} from "@/lib/fn/types";

export {
  mapMedioToPayment,
  transferAccountNames,
} from "@/lib/medios";

type EstudioRow = {
  id: string;
  slug: string;
  display_name: string;
  accent_color: string | null;
  mod_caja: unknown;
  mod_cuenta_corriente: unknown;
  mod_honorarios: unknown;
  mod_cpceba: unknown;
  mod_cobros_fijos: unknown;
  mod_honorarios_mensuales: unknown;
  mod_honorarios_extraordinarios: unknown;
  mod_pba_iibb: unknown;
  mod_vencimientos: unknown;
  dash_cobrado_mes: unknown;
  dash_pendiente: unknown;
  dash_vencimientos: unknown;
  dash_grafico: unknown;
  dash_iibb_pba: unknown;
};

type MethodRow = {
  id: number;
  name: string;
  kind: PaymentMethodKind;
  bank: string | null;
  cbu_alias: string | null;
  active: unknown;
  sort_order: number;
};

export function flagsFromRow(r: EstudioRow): EstudioFlags {
  return {
    caja: asBool(r.mod_caja),
    cuentaCorriente: asBool(r.mod_cuenta_corriente),
    honorarios: asBool(r.mod_honorarios),
    cpceba: asBool(r.mod_cpceba),
    cobrosFijos: asBool(r.mod_cobros_fijos),
    honorariosMensuales: asBool(r.mod_honorarios_mensuales),
    honorariosExtraordinarios: asBool(r.mod_honorarios_extraordinarios),
    pbaIibb: asBool(r.mod_pba_iibb),
    vencimientos: asBool(r.mod_vencimientos),
    dashCobradoMes: asBool(r.dash_cobrado_mes),
    dashPendiente: asBool(r.dash_pendiente),
    dashVencimientos: asBool(r.dash_vencimientos),
    dashGrafico: asBool(r.dash_grafico),
    dashIibbPba: asBool(r.dash_iibb_pba),
  };
}

function mapMethod(r: MethodRow): EstudioPaymentMethod {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    bank: r.bank,
    cbuAlias: r.cbu_alias,
    active: asBool(r.active),
    sortOrder: r.sort_order,
  };
}

export async function listPaymentMethods(
  estudioId: string,
  opts?: { activeOnly?: boolean },
): Promise<EstudioPaymentMethod[]> {
  const sql = await getSql();
  const rows = opts?.activeOnly
    ? await sql<MethodRow>`
        select id, name, kind, bank, cbu_alias, active, sort_order
        from payment_methods
        where estudio_id = ${estudioId} and active = true
        order by sort_order, id
      `
    : await sql<MethodRow>`
        select id, name, kind, bank, cbu_alias, active, sort_order
        from payment_methods
        where estudio_id = ${estudioId}
        order by sort_order, id
      `;
  return rows.map(mapMethod);
}

export async function fetchEstudio(estudioId: string): Promise<EstudioInfo> {
  const sql = await getSql();
  const rows = await sql<EstudioRow>`
    select
      id, slug, display_name, accent_color,
      mod_caja, mod_cuenta_corriente, mod_honorarios, mod_cpceba,
      mod_cobros_fijos, mod_honorarios_mensuales, mod_honorarios_extraordinarios, mod_pba_iibb,
      mod_vencimientos,
      dash_cobrado_mes, dash_pendiente, dash_vencimientos, dash_grafico, dash_iibb_pba
    from estudios
    where id = ${estudioId}
  `;
  const r = rows[0];
  if (!r) throw new Error("Estudio no encontrado");
  const { listAllVocab } = await import("./estudio-vocab");
  const { getEstudioMetadata } = await import("./estudio-metadata");
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    accentColor: r.accent_color,
    flags: flagsFromRow(r),
    paymentMethods: await listPaymentMethods(r.id),
    vocab: await listAllVocab(r.id),
    metadata: await getEstudioMetadata(r.id),
  };
}

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "estudio";
}

/** A real estudio: flags on, no clients, no movements, no toy seed. */
export async function createEmptyEstudio(displayName: string): Promise<string> {
  const sql = await getSql();
  const id = crypto.randomUUID();
  const name = displayName.trim() || "Estudio";
  const base = slugify(name);
  let slug = base;
  for (let n = 2; ; n += 1) {
    const clash = await sql<{ id: string }>`select id from estudios where slug = ${slug} limit 1`;
    if (!clash[0]) break;
    slug = `${base}-${n}`;
  }
  await sql`
    insert into estudios (
      id, slug, display_name,
      mod_caja, mod_cuenta_corriente, mod_honorarios, mod_cpceba,
      mod_cobros_fijos, mod_honorarios_mensuales, mod_honorarios_extraordinarios, mod_pba_iibb,
      mod_vencimientos,
      dash_cobrado_mes, dash_pendiente, dash_vencimientos, dash_grafico, dash_iibb_pba
    ) values (
      ${id}, ${slug}, ${name},
      true, true, true, true,
      true, true, true, true,
      true,
      true, true, true, true, true
    )
  `;
  return id;
}

export async function updateEstudioSettingsImpl(
  estudioId: string,
  data: {
    displayName: string;
    accentColor?: string | null;
    flags: EstudioFlags;
  },
) {
  const sql = await getSql();
  const name = data.displayName.trim();
  if (name.length < 2) throw new Error("Ingresá el nombre del estudio");
  const accent = data.accentColor?.replace("#", "").trim() || null;
  if (accent && !/^[0-9A-Fa-f]{6}$/.test(accent)) {
    throw new Error("El color tiene que ser un hex de 6 dígitos");
  }
  const f = data.flags;
  await sql`
    update estudios set
      display_name = ${name},
      accent_color = ${accent},
      mod_caja = ${f.caja},
      mod_cuenta_corriente = ${f.cuentaCorriente},
      mod_honorarios = ${f.honorarios},
      mod_cpceba = ${f.cpceba},
      mod_cobros_fijos = ${f.cobrosFijos},
      mod_honorarios_mensuales = ${f.honorariosMensuales},
      mod_honorarios_extraordinarios = ${f.honorariosExtraordinarios},
      mod_pba_iibb = ${f.pbaIibb},
      mod_vencimientos = ${f.vencimientos},
      dash_cobrado_mes = ${f.dashCobradoMes},
      dash_pendiente = ${f.dashPendiente},
      dash_vencimientos = ${f.dashVencimientos},
      dash_grafico = ${f.dashGrafico},
      dash_iibb_pba = ${f.dashIibbPba}
    where id = ${estudioId}
  `;
  return fetchEstudio(estudioId);
}

export async function upsertPaymentMethodImpl(
  estudioId: string,
  data: {
    id?: number;
    name: string;
    kind: PaymentMethodKind;
    bank?: string | null;
    cbuAlias?: string | null;
    active?: boolean;
  },
) {
  const sql = await getSql();
  const name = data.name.trim();
  if (!name) throw new Error("Ingresá el nombre del medio");
  if (data.id) {
    const owned = await sql<{ id: number }>`
      select id from payment_methods where id = ${data.id} and estudio_id = ${estudioId}
    `;
    if (!owned[0]) throw new Error("Medio no encontrado");
    await sql`
      update payment_methods set
        name = ${name},
        kind = ${data.kind},
        bank = ${data.bank || null},
        cbu_alias = ${data.cbuAlias || null},
        active = ${data.active ?? true}
      where id = ${data.id} and estudio_id = ${estudioId}
    `;
    return { id: data.id };
  }
  const max = await sql<{ m: number }>`
    select coalesce(max(sort_order), 0)::int as m from payment_methods where estudio_id = ${estudioId}
  `;
  const rows = await sql<{ id: number }>`
    insert into payment_methods (estudio_id, name, kind, bank, cbu_alias, active, sort_order)
    values (
      ${estudioId}, ${name}, ${data.kind}, ${data.bank || null}, ${data.cbuAlias || null},
      ${data.active ?? true}, ${(max[0]?.m ?? 0) + 1}
    )
    returning id
  `;
  return { id: rows[0].id };
}
