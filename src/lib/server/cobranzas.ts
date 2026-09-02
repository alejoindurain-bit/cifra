import { getSql } from "@/lib/db";
import { transferAccountNames } from "@/lib/medios";
import { requireOwner } from "./staff";
import { fetchEstudio } from "./estudio";
import { listTransferPaymentsImpl } from "./transactions";
import type { TransferReport } from "@/lib/fn/types";

function accountOf(row: { payment: { transferAccount: string | null } | null }): string {
  return row.payment?.transferAccount?.trim() || "Sin cuenta";
}

export async function getTransferReportImpl(
  userId: string,
  data: { year: number; month: number | null; account: string | null },
): Promise<TransferReport> {
  const staff = await requireOwner(userId);
  const estudio = await fetchEstudio(staff.estudioId);
  const known = transferAccountNames(estudio.paymentMethods);
  const sql = await getSql();
  const yearRows = await sql<{ y: number }>`
    select distinct extract(year from t.date)::int as y
    from transactions t
    join payment_details p on p.transaction_id = t.id
    where t.estudio_id = ${staff.estudioId}
      and t.type = 'payment' and p.payment_method = 'Transferencia'
    order by y desc
  `;
  const nowY = new Date().getFullYear();
  const years = Array.from(new Set([nowY, ...yearRows.map((r) => r.y)])).sort((a, b) => b - a);

  const period = await listTransferPaymentsImpl({
    estudioId: staff.estudioId,
    year: data.year,
    month: data.month,
    account: null,
  });
  const rows = data.account
    ? period.filter((r) => accountOf(r) === data.account)
    : period;

  const byName = new Map<string, { count: number; amount: number }>();
  for (const r of period) {
    const account = accountOf(r);
    const cur = byName.get(account) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount = Math.round((cur.amount + r.amount) * 100) / 100;
    byName.set(account, cur);
  }
  const extra = Array.from(byName.keys()).filter((a) => a === "Sin cuenta" || !known.includes(a));
  const names = Array.from(new Set([...known, ...extra]));
  const amount = period.reduce((s, r) => s + r.amount, 0);
  const totals = names
    .map((account) => {
      const hit = byName.get(account) ?? { count: 0, amount: 0 };
      return {
        account,
        count: hit.count,
        amount: hit.amount,
        share: amount > 0 ? hit.amount / amount : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.account.localeCompare(b.account, "es"));

  return {
    year: data.year,
    month: data.month,
    account: data.account,
    years,
    totals,
    count: period.length,
    amount,
    rows,
  };
}
