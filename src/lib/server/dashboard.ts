import { getSql } from "@/lib/db";
import { monthLabel, monthsOfHonorario, monthlyHonorarioARS } from "@/lib/money";
import { asBool, num, parseJsonArray } from "@/lib/utils";
import { requireOwner } from "./staff";
import { fetchModuleValue } from "./rates";
import { runMonthlyBillingIfDue } from "./billing";
import type { DashboardData, LedgerRow } from "@/lib/fn/types";
import { listUpcomingVencimientos } from "./vencimientos";

export async function getDashboardImpl(userId: string): Promise<DashboardData> {
  const staff = await requireOwner(userId);
  const billing = await runMonthlyBillingIfDue(staff.estudioId);
  const sql = await getSql();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(toDate).padStart(2, "0")}`;
  const flowStartDate = new Date(year, month - 6, 1);
  const flowFrom = `${flowStartDate.getFullYear()}-${String(flowStartDate.getMonth() + 1).padStart(2, "0")}-01`;
  const eid = staff.estudioId;

  const monthAgg = await sql<{ charges: unknown; payments: unknown }>`
    select
      coalesce(sum(case when type = 'charge' then amount else 0 end), 0) as charges,
      coalesce(sum(case when type = 'payment' then amount else 0 end), 0) as payments
    from transactions
    where estudio_id = ${eid} and date >= ${from} and date <= ${to}
  `;

  const debt = await sql<{ total: unknown }>`
    select coalesce(sum(balance), 0) as total from (
      select coalesce(sum(case when type = 'charge' then amount else -amount end), 0) as balance
      from transactions
      where estudio_id = ${eid}
      group by client_id
    ) s where balance > 0
  `;

  const counts = await sql<{ clients: number; fixed: number }>`
    select
      (select count(*)::int from clients where estudio_id = ${eid} and active = true) as clients,
      (select count(*)::int from clients where estudio_id = ${eid} and active = true and fixed_fee = true) as fixed
  `;

  const debtors = await sql<{
    id: number;
    name: string;
    balance: unknown;
    fixed_fee: unknown;
    monthly_modules: unknown;
    monthly_amount: unknown;
  }>`
    select c.id, c.name, c.fixed_fee, c.monthly_modules, c.monthly_amount,
      coalesce(sum(case when t.type = 'charge' then t.amount else -t.amount end), 0) as balance
    from clients c
    left join transactions t on t.client_id = c.id and t.estudio_id = c.estudio_id
    where c.active = true and c.estudio_id = ${eid}
    group by c.id, c.name, c.fixed_fee, c.monthly_modules, c.monthly_amount
    having coalesce(sum(case when t.type = 'charge' then t.amount else -t.amount end), 0) > 0
    order by balance desc
    limit 6
  `;

  const flow = await sql<{ ym: string; charges: unknown; payments: unknown }>`
    select
      substring(date::text, 1, 7) as ym,
      coalesce(sum(case when type = 'charge' then amount else 0 end), 0) as charges,
      coalesce(sum(case when type = 'payment' then amount else 0 end), 0) as payments
    from transactions
    where estudio_id = ${eid} and date >= ${flowFrom}
    group by 1
    order by 1
  `;

  const recent = await sql<{
    id: number;
    client_id: number;
    client_name: string;
    date: string;
    concept: string;
    type: "charge" | "payment";
    amount: unknown;
    created_by: string | null;
    created_at: string;
    documentation: string | null;
    payment_method: string | null;
    dollar_rate: unknown;
    observations: string | null;
    transfer_account: string | null;
  }>`
    select t.id, t.client_id, c.name as client_name, t.date::text as date, t.concept, t.type,
           t.amount, t.created_by, t.created_at::text as created_at,
           p.documentation, p.payment_method, p.dollar_rate, p.observations, p.transfer_account
    from transactions t
    join clients c on c.id = t.client_id and c.estudio_id = t.estudio_id
    left join payment_details p on p.transaction_id = t.id
    where t.estudio_id = ${eid}
    order by t.date desc, t.id desc
    limit 8
  `;

  const module = await fetchModuleValue(eid);
  const upcomingVencimientos = await listUpcomingVencimientos(eid);

  const cashflow = flow.map((r) => {
    const [ys, ms] = r.ym.split("-");
    const y = Number(ys);
    const m = Number(ms);
    return {
      year: y,
      month: m,
      label: monthLabel(y, m).slice(0, 3),
      charges: num(r.charges),
      payments: num(r.payments),
    };
  });

  const recentRows: LedgerRow[] = recent.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    date: String(r.date).slice(0, 10),
    concept: r.concept,
    type: r.type,
    amount: num(r.amount),
    createdBy: r.created_by,
    createdAt: r.created_at,
    payment: r.payment_method
      ? {
          documentation: parseJsonArray(r.documentation),
          paymentMethod: r.payment_method,
          dollarRate: r.dollar_rate == null ? null : num(r.dollar_rate),
          observations: r.observations,
          transferAccount: r.transfer_account,
        }
      : null,
  }));

  return {
    monthIncome: num(monthAgg[0]?.payments),
    monthCharges: num(monthAgg[0]?.charges),
    totalDebt: num(debt[0]?.total),
    clientCount: counts[0]?.clients ?? 0,
    activeFixed: counts[0]?.fixed ?? 0,
    module,
    topDebtors: debtors.map((d) => {
      const balance = num(d.balance);
      const monthly = monthlyHonorarioARS(
        {
          fixedFee: asBool(d.fixed_fee),
          monthlyModules: num(d.monthly_modules),
          monthlyAmount: num(d.monthly_amount),
        },
        module.value,
      );
      return {
        id: d.id,
        name: d.name,
        balance,
        monthsEquivalent: monthsOfHonorario(balance, monthly),
      };
    }),
    cashflow,
    recent: recentRows,
    lastBilling: billing,
    upcomingVencimientos,
  };
}
