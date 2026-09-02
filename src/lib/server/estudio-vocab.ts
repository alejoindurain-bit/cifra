import { getSql } from "@/lib/db";
import { requireOwner } from "./staff";
import { asBool } from "@/lib/utils";

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

type Row = {
  value: string;
  kind_label: string | null;
  active: unknown;
  sort_order: number;
};

function mapRow(r: Row): VocabEntry {
  return {
    value: r.value,
    kindLabel: r.kind_label,
    active: asBool(r.active),
    sortOrder: r.sort_order,
  };
}

function ensureKind(kind: string): VocabKind {
  if (!VALID_KINDS.includes(kind as VocabKind)) {
    throw new Error(`Tipo de vocabulario no soportado: ${kind}`);
  }
  return kind as VocabKind;
}

export async function listVocab(
  estudioId: string,
  kind: VocabKind,
): Promise<VocabEntry[]> {
  const k = ensureKind(kind);
  const sql = await getSql();
  const rows = await sql<Row>`
    select value, kind_label, active, sort_order
    from estudio_vocab
    where estudio_id = ${estudioId} and kind = ${k}
    order by sort_order, value
  `;
  return rows.map(mapRow);
}

export async function listAllVocab(
  estudioId: string,
): Promise<Record<VocabKind, VocabEntry[]>> {
  const sql = await getSql();
  const rows = await sql<Row & { kind: string }>`
    select value, kind_label, active, sort_order, kind
    from estudio_vocab
    where estudio_id = ${estudioId}
    order by kind, sort_order, value
  `;
  const out: Record<VocabKind, VocabEntry[]> = {
    payment_method: [],
    transfer_account: [],
    documentation: [],
    company_type: [],
    iva_condition: [],
    monotributo_category: [],
  };
  for (const r of rows) {
    const k = r.kind as VocabKind;
    out[k].push(mapRow(r));
  }
  return out;
}

export async function upsertVocabEntry(
  userId: string,
  kind: VocabKind,
  data: { value: string; kindLabel?: string | null; active?: boolean },
) {
  const staff = await requireOwner(userId);
  const k = ensureKind(kind);
  const value = data.value.trim();
  if (!value) throw new Error("Ingresá un valor");
  const sql = await getSql();
  const max = await sql<{ m: number }>`
    select coalesce(max(sort_order), 0)::int as m
    from estudio_vocab
    where estudio_id = ${staff.estudioId} and kind = ${k}
  `;
  const existing = await sql<{ sort_order: number; active: unknown }>`
    select sort_order, active
    from estudio_vocab
    where estudio_id = ${staff.estudioId} and kind = ${k} and value = ${value}
  `;
  if (existing[0]) {
    await sql`
      update estudio_vocab
      set kind_label = ${data.kindLabel || null},
          active = ${data.active ?? asBool(existing[0].active)}
      where estudio_id = ${staff.estudioId} and kind = ${k} and value = ${value}
    `;
    return { value, created: false };
  }
  await sql`
    insert into estudio_vocab (estudio_id, kind, value, kind_label, active, sort_order)
    values (
      ${staff.estudioId}, ${k}, ${value},
      ${data.kindLabel || null}, ${data.active ?? true}, ${(max[0]?.m ?? 0) + 1}
    )
  `;
  return { value, created: true };
}

export async function deleteVocabEntry(
  userId: string,
  kind: VocabKind,
  value: string,
) {
  const staff = await requireOwner(userId);
  const k = ensureKind(kind);
  const sql = await getSql();
  await sql`
    delete from estudio_vocab
    where estudio_id = ${staff.estudioId} and kind = ${k} and value = ${value}
  `;
  return { ok: true };
}

export async function toggleVocabEntry(
  userId: string,
  kind: VocabKind,
  value: string,
  active: boolean,
) {
  const staff = await requireOwner(userId);
  const k = ensureKind(kind);
  const sql = await getSql();
  await sql`
    update estudio_vocab
    set active = ${active}
    where estudio_id = ${staff.estudioId} and kind = ${k} and value = ${value}
  `;
  return { ok: true };
}

export async function reorderVocab(
  userId: string,
  kind: VocabKind,
  values: string[],
) {
  const staff = await requireOwner(userId);
  const k = ensureKind(kind);
  const sql = await getSql();
  for (let i = 0; i < values.length; i += 1) {
    await sql`
      update estudio_vocab
      set sort_order = ${i + 1}
      where estudio_id = ${staff.estudioId} and kind = ${k} and value = ${values[i]}
    `;
  }
  return { ok: true };
}
