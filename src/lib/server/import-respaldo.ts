import { readFileSync } from "node:fs";
import { BELTRAN_ESTUDIO_ID, MUESTRA_ESTUDIO_ID, ORIGINAL_ESTUDIO_ID } from "@/lib/constants";
import { getSql } from "@/lib/db";
import type { PaymentMethodKind } from "@/lib/fn/types";

const REAL_OWNER_EMAIL = "alejo.indurain@gmail.com";
const BACKUP_PATHS = [
  "/workspace/attachments/cifra-respaldo-2026-09-01.xls",
  "attachments/cifra-respaldo-2026-09-01.xls",
  "RESPALDO/cifra-respaldo-2026-09-01.xls",
];

export type ImportSkip = { sheet: string; row: number; reason: string };
export type ImportResult = {
  estudioId: string | null;
  clientsInserted: number;
  clientsReused: number;
  movementsInserted: number;
  skipped: ImportSkip[];
};

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function xmlUnescape(s: string): string {
  return s
    .replace(/"/g, '"')
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&/g, "&");
}

const CELL_RE =
  /<Cell(?<attrs>[^>]*)\/>|<Cell(?<attrs2>[^>]*)>(?<body>.*?)<\/Cell>/gs;

function parseSheet(xml: string, name: string): Array<Array<string | number | null>> {
  const block = xml.match(
    new RegExp(`<Worksheet ss:Name="${name}"><Table>([\\s\\S]*?)</Table></Worksheet>`),
  );
  if (!block) return [];
  const rows: Array<Array<string | number | null>> = [];
  const rowRe = /<Row>([\s\S]*?)<\/Row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(block[1]))) {
    const cells: Array<string | number | null> = [];
    let pos = 1;
    const chunk = rowMatch[1];
    CELL_RE.lastIndex = 0;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = CELL_RE.exec(chunk))) {
      const attrs = cellMatch.groups?.attrs || cellMatch.groups?.attrs2 || "";
      const inner = cellMatch.groups?.body || "";
      const idx = attrs.match(/ss:Index="(\d+)"/);
      if (idx) {
        const n = Number(idx[1]);
        while (pos < n) {
          cells.push(null);
          pos += 1;
        }
      }
      const data = inner.match(/<Data ss:Type="([^"]+)">([\s\S]*?)<\/Data>/);
      if (data) {
        const v = xmlUnescape(data[2]);
        if (data[1] === "Number") {
          const num = Number(v);
          cells.push(Number.isFinite(num) ? num : v);
        } else {
          cells.push(v);
        }
      } else {
        cells.push(null);
      }
      pos += 1;
    }
    rows.push(cells);
  }
  return rows;
}

function cellStr(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

function cellNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatCuit(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11) return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  return raw.trim() || null;
}

function parseDocs(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asDate(raw: string): string | null {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function honorariosPeriod(concept: string): { year: number; month: number } | null {
  const m = concept.match(/^Honorarios\s+(\S+)\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS[foldName(m[1])];
  const year = Number(m[2]);
  if (!month || !year) return null;
  return { year, month };
}

async function findTargetEstudioId(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ id: string; display_name: string; email: string | null }>`
    select e.id, e.display_name, s.email
    from estudios e
    left join staff s on s.estudio_id = e.id
    where e.id <> ${MUESTRA_ESTUDIO_ID} and e.id <> ${BELTRAN_ESTUDIO_ID}
  `;
  for (const r of rows) {
    if (r.email && r.email.toLowerCase() === REAL_OWNER_EMAIL) return r.id;
  }
  for (const r of rows) {
    const n = foldName(r.display_name);
    if (n.includes("beltran")) return r.id;
  }
  const original = rows.find((r) => r.id === ORIGINAL_ESTUDIO_ID);
  return original?.id ?? null;
}

function readBackupXml(): string | null {
  for (const p of BACKUP_PATHS) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  return null;
}

async function ensureBackupMedios(estudioId: string) {
  const sql = await getSql();
  const wanted: Array<{ name: string; kind: PaymentMethodKind; bank: string | null }> = [
    { name: "Efectivo", kind: "efectivo", bank: null },
    { name: "Cheque", kind: "cheque", bank: null },
    { name: "Dólares", kind: "dolares", bank: null },
    { name: "Cuenta DNI", kind: "transferencia", bank: "Banco Provincia" },
    { name: "Banco Provincia", kind: "transferencia", bank: "Banco Provincia" },
    { name: "Banco Galicia", kind: "transferencia", bank: "Banco Galicia" },
  ];
  const existing = await sql<{ name: string }>`
    select name from payment_methods where estudio_id = ${estudioId}
  `;
  const have = new Set(existing.map((r) => r.name));
  let order = existing.length;
  for (const m of wanted) {
    if (have.has(m.name)) continue;
    order += 1;
    await sql`
      insert into payment_methods (estudio_id, name, kind, bank, active, sort_order)
      values (${estudioId}, ${m.name}, ${m.kind}, ${m.bank}, true, ${order})
    `;
  }
}

async function importInto(estudioId: string, xml: string): Promise<ImportResult> {
  const skipped: ImportSkip[] = [];
  const clientRows = parseSheet(xml, "Clientes");
  const ledgerRows = parseSheet(xml, "Libro mayor");
  const sql = await getSql();

  await sql`
    update estudios
    set display_name = 'Estudio Contable Beltran'
    where id = ${estudioId} and display_name = 'Estudio'
  `;

  await ensureBackupMedios(estudioId);

  const existingClients = await sql<{ id: number; name: string }>`
    select id, name from clients where estudio_id = ${estudioId}
  `;
  const byName = new Map(existingClients.map((c) => [foldName(c.name), c.id]));
  const oldToNew = new Map<number, number>();
  let clientsInserted = 0;
  let clientsReused = 0;

  for (let i = 1; i < clientRows.length; i += 1) {
    const r = clientRows[i];
    const oldId = cellNum(r[0]);
    const name = cellStr(r[1]);
    if (!name) {
      skipped.push({ sheet: "Clientes", row: i + 1, reason: "sin nombre" });
      continue;
    }
    const contact = cellStr(r[2]) || null;
    const cuit = formatCuit(cellStr(r[3]));
    const companyType = cellStr(r[4]) || null;
    const ivaCondition = cellStr(r[5]) || null;
    const feeKind = cellStr(r[6]);
    const monthlyModules = cellNum(r[7]) ?? 0;
    const monthlyAmount = cellNum(r[8]) ?? 0;
    const ganancias = cellStr(r[9]);
    const activeRaw = cellStr(r[10]);
    const createdAt = cellStr(r[12]) || null;
    const updatedAt = cellStr(r[13]) || createdAt;

    const fixedFee = feeKind === "modules" || feeKind === "amount";
    const modules = feeKind === "modules" ? monthlyModules : 0;
    const amount = feeKind === "amount" ? monthlyAmount : 0;
    const gananciasInMonthly = ganancias === "En mensual";
    const active = activeRaw !== "No";

    try {
      const key = foldName(name);
      const already = byName.get(key);
      if (already) {
        if (oldId != null) oldToNew.set(oldId, already);
        clientsReused += 1;
        continue;
      }
      const inserted = await sql<{ id: number }>`
        insert into clients (
          estudio_id, name, contact, cuit, company_type, iva_condition,
          fixed_fee, monthly_modules, monthly_amount, ganancias_in_monthly, active,
          created_at, updated_at
        )
        values (
          ${estudioId}, ${name}, ${contact}, ${cuit}, ${companyType}, ${ivaCondition},
          ${fixedFee}, ${modules}, ${amount}, ${gananciasInMonthly}, ${active},
          ${createdAt ?? new Date().toISOString()}, ${updatedAt ?? new Date().toISOString()}
        )
        returning id
      `;
      const newId = inserted[0].id;
      byName.set(key, newId);
      if (oldId != null) oldToNew.set(oldId, newId);
      clientsInserted += 1;
    } catch (err) {
      skipped.push({
        sheet: "Clientes",
        row: i + 1,
        reason: `${name}: ${err instanceof Error ? err.message : "error"}`,
      });
    }
  }

  const existingTx = await sql<{
    client_id: number;
    date: string;
    concept: string;
    type: string;
    amount: unknown;
  }>`
    select client_id, date::text as date, concept, type, amount
    from transactions
    where estudio_id = ${estudioId}
  `;
  const txKeys = new Set(
    existingTx.map(
      (t) =>
        `${t.client_id}|${String(t.date).slice(0, 10)}|${t.concept}|${t.type}|${Number(t.amount)}`,
    ),
  );

  let movementsInserted = 0;
  const billed = new Map<string, number>();

  for (let i = 1; i < ledgerRows.length; i += 1) {
    const r = ledgerRows[i];
    const date = asDate(cellStr(r[1]));
    const oldClientId = cellNum(r[2]);
    const clientName = cellStr(r[3]);
    const concept = cellStr(r[4]);
    const tipoLabel = cellStr(r[5]);
    const amount = cellNum(r[6]);
    const createdBy = cellStr(r[7]) || "respaldo";
    const createdAt = cellStr(r[8]) || null;
    const medio = cellStr(r[9]);
    const cuenta = cellStr(r[10]) || null;
    const docs = parseDocs(cellStr(r[11]));
    const dollarRate = cellNum(r[12]);
    const observations = cellStr(r[13]) || null;

    const type = tipoLabel === "Cargo" ? "charge" : tipoLabel === "Pago" ? "payment" : null;
    if (!date) {
      skipped.push({ sheet: "Libro mayor", row: i + 1, reason: "fecha inválida" });
      continue;
    }
    if (!type) {
      skipped.push({
        sheet: "Libro mayor",
        row: i + 1,
        reason: `tipo desconocido (${tipoLabel || "vacío"})`,
      });
      continue;
    }
    if (!concept) {
      skipped.push({ sheet: "Libro mayor", row: i + 1, reason: "sin concepto" });
      continue;
    }
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      skipped.push({ sheet: "Libro mayor", row: i + 1, reason: `${concept}: importe inválido` });
      continue;
    }

    let newClientId =
      oldClientId != null ? oldToNew.get(oldClientId) : undefined;
    if (newClientId == null && clientName) newClientId = byName.get(foldName(clientName));
    if (newClientId == null) {
      skipped.push({
        sheet: "Libro mayor",
        row: i + 1,
        reason: `${concept}: cliente no encontrado (${clientName || oldClientId || "?"})`,
      });
      continue;
    }

    const key = `${newClientId}|${date}|${concept}|${type}|${amount}`;
    if (txKeys.has(key)) continue;

    try {
      const tx = await sql<{ id: number }>`
        insert into transactions (
          estudio_id, client_id, date, concept, type, amount, created_by, created_at
        )
        values (
          ${estudioId}, ${newClientId}, ${date}, ${concept}, ${type}, ${amount},
          ${createdBy}, ${createdAt ?? new Date().toISOString()}
        )
        returning id
      `;
      if (type === "payment") {
        await sql`
          insert into payment_details (
            estudio_id, transaction_id, documentation, payment_method, dollar_rate,
            observations, transfer_account
          )
          values (
            ${estudioId}, ${tx[0].id}, ${JSON.stringify(docs)},
            ${medio || "Efectivo"}, ${dollarRate}, ${observations}, ${cuenta}
          )
        `;
      }
      txKeys.add(key);
      movementsInserted += 1;
      const period = honorariosPeriod(concept);
      if (type === "charge" && period) {
        const pk = `${period.year}-${period.month}`;
        billed.set(pk, (billed.get(pk) ?? 0) + 1);
      }
    } catch (err) {
      skipped.push({
        sheet: "Libro mayor",
        row: i + 1,
        reason: `${concept}: ${err instanceof Error ? err.message : "error"}`,
      });
    }
  }

  for (const [pk, count] of billed) {
    const [year, month] = pk.split("-").map(Number);
    try {
      await sql`
        insert into billing_runs (estudio_id, year, month, module_value, clients_billed)
        values (${estudioId}, ${year}, ${month}, ${3693}, ${count})
        on conflict (estudio_id, year, month) do nothing
      `;
    } catch {
      /* unique index name may differ; ignore */
    }
  }

  return {
    estudioId,
    clientsInserted,
    clientsReused,
    movementsInserted,
    skipped,
  };
}

let lastResult: ImportResult | null = null;

export async function importRespaldoIfNeeded(): Promise<ImportResult> {
  const empty: ImportResult = {
    estudioId: null,
    clientsInserted: 0,
    clientsReused: 0,
    movementsInserted: 0,
    skipped: [],
  };
  const estudioId = await findTargetEstudioId();
  if (!estudioId) {
    lastResult = { ...empty, skipped: [{ sheet: "-", row: 0, reason: "Estudio Integral Beltran no encontrado" }] };
    return lastResult;
  }
  const xml = readBackupXml();
  if (!xml) {
    lastResult = {
      ...empty,
      estudioId,
      skipped: [{ sheet: "-", row: 0, reason: "archivo de respaldo no encontrado" }],
    };
    return lastResult;
  }
  lastResult = await importInto(estudioId, xml);
  return lastResult;
}
