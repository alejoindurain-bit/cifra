import { getSql } from "@/lib/db";
import { honorariosConcept, monthLabel } from "@/lib/money";
import { num } from "@/lib/utils";
import { fetchModuleValue, syncModuleHistoryFromCpceba } from "./rates";
import { loadModuleHistory, moduleValueForMonth } from "./module-history";
import { requireOwner } from "./staff";
import type { BackfillMonth, BackfillPreview, BackfillResult, BillingResult } from "@/lib/fn/types";

function currentYearMonth(now = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function padMonth(month: number) {
  return String(month).padStart(2, "0");
}

function monthsInclusive(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
) {
  const out: Array<{ year: number; month: number }> = [];
  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function honorarioCharge(modules: number, moduleValue: number, year: number, month: number) {
  const concept = honorariosConcept(year, month);
  const qtyLabel = modules.toLocaleString("es-AR");
  const valueLabel = moduleValue.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    concept,
    fullConcept: `${concept} (${qtyLabel} × $${valueLabel})`,
    amount: Math.round(modules * moduleValue * 100) / 100,
    firstDay: `${year}-${padMonth(month)}-01`,
  };
}

function amountHonorarioCharge(amount: number, year: number, month: number) {
  const concept = honorariosConcept(year, month);
  const amountLabel = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    concept,
    fullConcept: `${concept} (monto fijo $${amountLabel})`,
    amount: Math.round(amount * 100) / 100,
    firstDay: `${year}-${padMonth(month)}-01`,
  };
}

export async function runMonthlyBillingIfDue(estudioId: string, force = false): Promise<BillingResult> {
  const { year, month } = currentYearMonth();
  const sql = await getSql();
  const existing = await sql<{
    module_value: unknown;
    clients_billed: number;
  }>`
    select module_value, clients_billed from billing_runs
    where estudio_id = ${estudioId} and year = ${year} and month = ${month}
  `;

  if (existing[0] && !force) {
    return {
      ran: false,
      year,
      month,
      moduleValue: num(existing[0].module_value),
      clientsBilled: existing[0].clients_billed,
      alreadyDone: true,
    };
  }

  const quote = await fetchModuleValue(estudioId);
  const moduleValue = quote.value;
  const concept = honorariosConcept(year, month);
  const firstDay = `${year}-${padMonth(month)}-01`;

  const clients = await sql<{
    id: number;
    monthly_modules: unknown;
    monthly_amount: unknown;
  }>`
    select id, monthly_modules, monthly_amount
    from clients
    where estudio_id = ${estudioId}
      and active = true and fixed_fee = true
      and (monthly_modules > 0 or monthly_amount > 0)
  `;

  let billed = 0;
  for (const client of clients) {
    const modules = num(client.monthly_modules);
    const pesos = num(client.monthly_amount);
    const dup = await sql<{ c: number }>`
      select count(*)::int as c from transactions
      where client_id = ${client.id} and type = 'charge' and concept like ${concept + "%"}
    `;
    if ((dup[0]?.c ?? 0) > 0) continue;

    const row =
      pesos > 0
        ? amountHonorarioCharge(pesos, year, month)
        : honorarioCharge(modules, moduleValue, year, month);
    await sql`
      insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
      values (
        ${estudioId},
        ${client.id},
        ${firstDay},
        ${row.fullConcept},
        'charge',
        ${row.amount},
        'sistema'
      )
    `;
    billed += 1;
  }

  if (existing[0]) {
    await sql`
      update billing_runs
      set clients_billed = clients_billed + ${billed}, module_value = ${moduleValue}, run_at = now()
      where estudio_id = ${estudioId} and year = ${year} and month = ${month}
    `;
  } else {
    await sql`
      insert into billing_runs (estudio_id, year, month, module_value, clients_billed)
      values (${estudioId}, ${year}, ${month}, ${moduleValue}, ${billed})
    `;
  }

  return {
    ran: billed > 0,
    year,
    month,
    moduleValue,
    clientsBilled: billed,
    alreadyDone: billed === 0 && Boolean(existing[0]),
  };
}

function parseFromMonth(from: string): { year: number; month: number } {
  const m = from.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("Elegí un mes de inicio válido");
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error("Elegí un mes de inicio válido");
  return { year, month };
}

type BackfillInput = {
  clientId?: number;
  monthlyModules?: number;
  monthlyAmount?: number;
  from: string;
};

async function buildBackfillPlan(
  data: BackfillInput,
  estudioId: string,
): Promise<BackfillPreview & { modules: number; pesos: number }> {
  const { year: fromYear, month: fromMonth } = parseFromMonth(data.from);
  const now = currentYearMonth();
  if (fromYear > now.year || (fromYear === now.year && fromMonth > now.month)) {
    throw new Error("El mes de inicio no puede ser posterior al actual");
  }
  const span = monthsInclusive(fromYear, fromMonth, now.year, now.month);
  if (span.length > 240) {
    throw new Error("El rango no puede superar 20 años");
  }

  let modules = data.monthlyModules ?? 0;
  let pesos = data.monthlyAmount ?? 0;
  const sql = await getSql();
  if (data.clientId) {
    const client = await sql<{
      monthly_modules: unknown;
      monthly_amount: unknown;
      fixed_fee: boolean;
      estudio_id: string;
    }>`
      select monthly_modules, monthly_amount, fixed_fee, estudio_id
      from clients where id = ${data.clientId}
    `;
    if (!client[0]) throw new Error("Cliente no encontrado");
    if (estudioId && client[0].estudio_id !== estudioId) throw new Error("Cliente no encontrado");
    const hasFormFee = (data.monthlyModules ?? 0) > 0 || (data.monthlyAmount ?? 0) > 0;
    if (!client[0].fixed_fee && !hasFormFee) {
      throw new Error("El cliente no tiene honorario fijo");
    }
    if (!modules) modules = num(client[0].monthly_modules);
    if (!pesos) pesos = num(client[0].monthly_amount);
  }
  if (pesos <= 0 && modules <= 0) {
    throw new Error("Indicá el honorario mensual");
  }

  const months: BackfillMonth[] = [];
  if (pesos > 0) {
    for (const { year, month } of span) {
      const row = amountHonorarioCharge(pesos, year, month);
      let skipped = false;
      if (data.clientId) {
        const dup = await sql<{ c: number }>`
          select count(*)::int as c from transactions
          where client_id = ${data.clientId} and type = 'charge' and concept like ${row.concept + "%"}
        `;
        skipped = (dup[0]?.c ?? 0) > 0;
      }
      months.push({
        year,
        month,
        label: monthLabel(year, month),
        kind: "amount",
        moduleValue: 0,
        modules: 0,
        amount: row.amount,
        skipped,
      });
    }
  } else {
    await syncModuleHistoryFromCpceba(estudioId);
    const history = await loadModuleHistory(estudioId);
    for (const { year, month } of span) {
      const moduleValue = moduleValueForMonth(history, year, month);
      const row = honorarioCharge(modules, moduleValue, year, month);
      let skipped = false;
      if (data.clientId) {
        const dup = await sql<{ c: number }>`
          select count(*)::int as c from transactions
          where client_id = ${data.clientId} and type = 'charge' and concept like ${row.concept + "%"}
        `;
        skipped = (dup[0]?.c ?? 0) > 0;
      }
      months.push({
        year,
        month,
        label: monthLabel(year, month),
        kind: "modules",
        moduleValue,
        modules,
        amount: row.amount,
        skipped,
      });
    }
  }

  const pending = months.filter((m) => !m.skipped);
  return {
    months,
    modules,
    pesos,
    toCharge: pending.length,
    skipped: months.length - pending.length,
    totalAmount: pending.reduce((s, m) => s + m.amount, 0),
  };
}

export async function previewHonorariosBackfillImpl(
  userId: string,
  data: BackfillInput,
): Promise<BackfillPreview> {
  const staff = await requireOwner(userId);
  const plan = await buildBackfillPlan(data, staff.estudioId);
  return {
    months: plan.months,
    toCharge: plan.toCharge,
    skipped: plan.skipped,
    totalAmount: plan.totalAmount,
  };
}

export async function runHonorariosBackfillImpl(
  userId: string,
  data: { clientId: number; from: string },
): Promise<BackfillResult> {
  const staff = await requireOwner(userId);
  const plan = await buildBackfillPlan({ clientId: data.clientId, from: data.from }, staff.estudioId);
  const sql = await getSql();
  let billed = 0;
  let totalAmount = 0;
  for (const month of plan.months) {
    if (month.skipped) continue;
    const row =
      month.kind === "amount"
        ? amountHonorarioCharge(month.amount, month.year, month.month)
        : honorarioCharge(month.modules, month.moduleValue, month.year, month.month);
    await sql`
      insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
      values (
        ${staff.estudioId},
        ${data.clientId},
        ${row.firstDay},
        ${row.fullConcept},
        'charge',
        ${row.amount},
        ${staff.userId}
      )
    `;
    billed += 1;
    totalAmount += row.amount;
  }
  return {
    billed,
    skipped: plan.skipped,
    totalAmount,
  };
}
