import { getSql } from "@/lib/db";
import { asBool, num } from "@/lib/utils";
import { ensureStaff, requireOwner } from "./staff";
import type { Client, FeeKind } from "@/lib/fn/types";

type ClientRow = {
  id: number;
  estudio_id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  cuit: string | null;
  company_type: string | null;
  iva_condition: string | null;
  monotributo_category: string | null;
  fixed_fee: unknown;
  monthly_modules: unknown;
  monthly_amount: unknown;
  ganancias_in_monthly: unknown;
  active: unknown;
  created_at: string;
  updated_at: string;
  balance: unknown;
};

function mapClient(r: ClientRow): Client {
  return {
    id: r.id,
    estudioId: r.estudio_id,
    name: r.name,
    contact: r.contact,
    email: r.email,
    phone: r.phone,
    notes: r.notes,
    cuit: r.cuit,
    companyType: r.company_type,
    ivaCondition: r.iva_condition,
    monotributoCategory: r.monotributo_category,
    fixedFee: asBool(r.fixed_fee),
    monthlyModules: num(r.monthly_modules),
    monthlyAmount: num(r.monthly_amount),
    gananciasInMonthly: asBool(r.ganancias_in_monthly),
    active: asBool(r.active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    balance: num(r.balance),
  };
}

const CLIENT_SELECT = `
  c.id, c.estudio_id, c.name, c.contact, c.email, c.phone, c.notes, c.cuit, c.company_type, c.iva_condition,
  c.monotributo_category, c.fixed_fee, c.monthly_modules, c.monthly_amount, c.ganancias_in_monthly, c.active,
  c.created_at::text as created_at, c.updated_at::text as updated_at,
  coalesce((
    select sum(case when t.type = 'charge' then t.amount else -t.amount end)
    from transactions t where t.client_id = c.id
  ), 0) as balance
`;

function feeColumns(kind: FeeKind, monthlyModules: number, monthlyAmount: number) {
  if (kind === "modules") {
    if (monthlyModules <= 0) throw new Error("Indicá los módulos mensuales");
    return { fixedFee: true, monthlyModules, monthlyAmount: 0 };
  }
  if (kind === "amount") {
    if (monthlyAmount <= 0) throw new Error("Indicá el importe mensual");
    return { fixedFee: true, monthlyModules: 0, monthlyAmount };
  }
  return { fixedFee: false, monthlyModules: 0, monthlyAmount: 0 };
}

export async function fetchClientById(id: number, estudioId: string): Promise<Client> {
  const sql = await getSql();
  const rows = await sql.query<ClientRow>(
    `select ${CLIENT_SELECT} from clients c where c.id = $1 and c.estudio_id = $2`,
    [id, estudioId],
  );
  if (!rows[0]) throw new Error("Cliente no encontrado");
  return mapClient(rows[0]);
}

export async function listClientsImpl(
  estudioId: string,
  opts?: {
    q?: string;
    includeInactive?: boolean;
    ganancias?: "monthly" | "ddjj";
  },
) {
  const sql = await getSql();
  const q = opts?.q?.trim() ?? "";
  const includeInactive = opts?.includeInactive ?? false;
  const params: unknown[] = [estudioId];
  const where: string[] = ["c.estudio_id = $1"];
  if (!includeInactive) where.push("c.active = true");
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(
      `(lower(c.name) like $${params.length} or lower(coalesce(c.cuit, '')) like $${params.length})`,
    );
  }
  if (opts?.ganancias === "monthly") where.push("c.ganancias_in_monthly = true");
  if (opts?.ganancias === "ddjj") where.push("c.ganancias_in_monthly = false");
  const whereSql = `where ${where.join(" and ")}`;
  const result = await sql.query<ClientRow>(
    `select ${CLIENT_SELECT} from clients c ${whereSql} order by c.name`,
    params,
  );
  return result.map(mapClient);
}

export async function searchClientsImpl(estudioId: string, qRaw: string) {
  const sql = await getSql();
  const q = qRaw.trim();
  if (!q) {
    const rows = await sql.query<ClientRow>(
      `select ${CLIENT_SELECT} from clients c
       where c.estudio_id = $1 and c.active = true
       order by c.name limit 12`,
      [estudioId],
    );
    return rows.map(mapClient);
  }
  const like = `%${q.toLowerCase()}%`;
  const rows = await sql.query<ClientRow>(
    `select ${CLIENT_SELECT} from clients c
     where c.estudio_id = $1
       and c.active = true
       and (lower(c.name) like $2 or lower(coalesce(c.cuit, '')) like $2)
     order by c.name
     limit 20`,
    [estudioId, like],
  );
  return rows.map(mapClient);
}

type ClientWrite = {
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  cuit?: string | null;
  companyType?: string | null;
  ivaCondition?: string | null;
  monotributoCategory?: string | null;
  feeKind: FeeKind;
  monthlyModules: number;
  monthlyAmount: number;
  gananciasInMonthly: boolean;
  active?: boolean;
};

export async function createClientImpl(userId: string, data: ClientWrite) {
  const staff = await requireOwner(userId);
  const sql = await getSql();
  const fee = feeColumns(data.feeKind, data.monthlyModules, data.monthlyAmount);
  const category =
    data.ivaCondition === "Monotributo" ? data.monotributoCategory || null : null;
  const rows = await sql<{ id: number }>`
    insert into clients (
      estudio_id, name, contact, email, phone, notes, cuit, company_type, iva_condition,
      monotributo_category, fixed_fee, monthly_modules, monthly_amount, ganancias_in_monthly, active
    )
    values (
      ${staff.estudioId},
      ${data.name},
      ${data.contact || null},
      ${data.email || null},
      ${data.phone || null},
      ${data.notes || null},
      ${data.cuit || null},
      ${data.companyType || null},
      ${data.ivaCondition || null},
      ${category},
      ${fee.fixedFee},
      ${fee.monthlyModules},
      ${fee.monthlyAmount},
      ${data.gananciasInMonthly},
      ${data.active ?? true}
    )
    returning id
  `;
  return { id: rows[0].id };
}

export async function updateClientImpl(userId: string, data: ClientWrite & { id: number }) {
  const staff = await requireOwner(userId);
  const sql = await getSql();
  const fee = feeColumns(data.feeKind, data.monthlyModules, data.monthlyAmount);
  const category =
    data.ivaCondition === "Monotributo" ? data.monotributoCategory || null : null;
  const updated = await sql<{ id: number }>`
    update clients set
      name = ${data.name},
      contact = ${data.contact || null},
      email = ${data.email || null},
      phone = ${data.phone || null},
      notes = ${data.notes || null},
      cuit = ${data.cuit || null},
      company_type = ${data.companyType || null},
      iva_condition = ${data.ivaCondition || null},
      monotributo_category = ${category},
      fixed_fee = ${fee.fixedFee},
      monthly_modules = ${fee.monthlyModules},
      monthly_amount = ${fee.monthlyAmount},
      ganancias_in_monthly = ${data.gananciasInMonthly},
      active = ${data.active ?? true},
      updated_at = now()
    where id = ${data.id} and estudio_id = ${staff.estudioId}
    returning id
  `;
  if (!updated[0]) throw new Error("Cliente no encontrado");
  return { ok: true };
}

export { ensureStaff };
