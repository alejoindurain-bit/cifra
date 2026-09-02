import { getSql } from "@/lib/db";
import { VENCIMIENTO_KINDS, VENCIMIENTO_STATUSES } from "@/lib/constants";
import type { Vencimiento, VencimientoKind, VencimientoStatus } from "@/lib/fn/types";

type Row = {
  id: number;
  estudio_id: string;
  title: string;
  due_date: string;
  kind: VencimientoKind;
  client_id: number | null;
  client_name: string | null;
  status: VencimientoStatus;
  created_at: string;
};

const SELECT = `
  v.id, v.estudio_id, v.title, v.due_date::text as due_date, v.kind,
  v.client_id, c.name as client_name, v.status, v.created_at::text as created_at
`;

function mapVencimiento(r: Row): Vencimiento {
  return {
    id: r.id,
    estudioId: r.estudio_id,
    title: r.title,
    dueDate: String(r.due_date).slice(0, 10),
    kind: r.kind,
    clientId: r.client_id,
    clientName: r.client_name,
    status: r.status,
    createdAt: r.created_at,
  };
}

function assertKind(kind: string): VencimientoKind {
  if ((VENCIMIENTO_KINDS as readonly string[]).includes(kind)) return kind as VencimientoKind;
  throw new Error("Tipo de vencimiento inválido");
}

function assertStatus(status: string): VencimientoStatus {
  if ((VENCIMIENTO_STATUSES as readonly string[]).includes(status)) {
    return status as VencimientoStatus;
  }
  throw new Error("Estado inválido");
}

function assertDate(date: string): string {
  const d = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Ingresá una fecha");
  return d;
}

async function assertClient(estudioId: string, clientId: number | null): Promise<number | null> {
  if (clientId == null) return null;
  const sql = await getSql();
  const rows = await sql<{ id: number }>`
    select id from clients where id = ${clientId} and estudio_id = ${estudioId}
  `;
  if (!rows[0]) throw new Error("Cliente no encontrado");
  return rows[0].id;
}

export async function listVencimientosImpl(
  estudioId: string,
  filter?: { status?: VencimientoStatus | "all" },
): Promise<Vencimiento[]> {
  const sql = await getSql();
  const status = filter?.status && filter.status !== "all" ? filter.status : null;
  const rows = status
    ? await sql.query<Row>(
        `select ${SELECT}
         from vencimientos v
         left join clients c on c.id = v.client_id and c.estudio_id = v.estudio_id
         where v.estudio_id = $1 and v.status = $2
         order by v.due_date asc, v.id asc`,
        [estudioId, status],
      )
    : await sql.query<Row>(
        `select ${SELECT}
         from vencimientos v
         left join clients c on c.id = v.client_id and c.estudio_id = v.estudio_id
         where v.estudio_id = $1
         order by case when v.status = 'pendiente' then 0 else 1 end, v.due_date asc, v.id asc`,
        [estudioId],
      );
  return rows.map(mapVencimiento);
}

export async function listUpcomingVencimientos(
  estudioId: string,
  limit = 8,
): Promise<Vencimiento[]> {
  const sql = await getSql();
  const rows = await sql.query<Row>(
    `select ${SELECT}
     from vencimientos v
     left join clients c on c.id = v.client_id and c.estudio_id = v.estudio_id
     where v.estudio_id = $1 and v.status = 'pendiente'
     order by v.due_date asc, v.id asc
     limit $2`,
    [estudioId, limit],
  );
  return rows.map(mapVencimiento);
}

export async function upsertVencimientoImpl(
  estudioId: string,
  data: {
    id?: number;
    title: string;
    dueDate: string;
    kind: string;
    clientId?: number | null;
    status?: string;
  },
): Promise<{ id: number }> {
  const title = data.title.trim();
  if (title.length < 2) throw new Error("Ingresá el título");
  const dueDate = assertDate(data.dueDate);
  const kind = assertKind(data.kind);
  const status = assertStatus(data.status ?? "pendiente");
  const clientId = await assertClient(estudioId, data.clientId ?? null);
  const sql = await getSql();
  if (data.id) {
    const owned = await sql<{ id: number }>`
      select id from vencimientos where id = ${data.id} and estudio_id = ${estudioId}
    `;
    if (!owned[0]) throw new Error("Vencimiento no encontrado");
    await sql`
      update vencimientos set
        title = ${title},
        due_date = ${dueDate},
        kind = ${kind},
        client_id = ${clientId},
        status = ${status},
        updated_at = now()
      where id = ${data.id} and estudio_id = ${estudioId}
    `;
    return { id: data.id };
  }
  const rows = await sql<{ id: number }>`
    insert into vencimientos (estudio_id, title, due_date, kind, client_id, status)
    values (${estudioId}, ${title}, ${dueDate}, ${kind}, ${clientId}, ${status})
    returning id
  `;
  return { id: rows[0].id };
}

export async function setVencimientoStatusImpl(
  estudioId: string,
  id: number,
  status: string,
): Promise<{ id: number }> {
  const next = assertStatus(status);
  const sql = await getSql();
  const owned = await sql<{ id: number }>`
    select id from vencimientos where id = ${id} and estudio_id = ${estudioId}
  `;
  if (!owned[0]) throw new Error("Vencimiento no encontrado");
  await sql`
    update vencimientos set status = ${next}, updated_at = now()
    where id = ${id} and estudio_id = ${estudioId}
  `;
  return { id };
}
