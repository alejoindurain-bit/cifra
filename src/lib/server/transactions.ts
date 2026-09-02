import { getSql } from "@/lib/db";
import { mapMedioToPayment, transferAccountNames } from "@/lib/medios";
import type { ClientAccount, EstudioPaymentMethod, LedgerRow, PaymentDetail } from "@/lib/fn/types";
import { num, parseJsonArray } from "@/lib/utils";
import { fetchClientById } from "./clients";
import { fetchEstudio } from "./estudio";
import { ensureStaff, requireOwner } from "./staff";

type TxRow = {
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
};

function resolveTransferAccount(
  method: string,
  account: string | null | undefined,
  methods: EstudioPaymentMethod[],
): string | null {
  if (method !== "Transferencia") return null;
  const allowed = transferAccountNames(methods);
  if (!account) {
    throw new Error("Elegí la cuenta donde se acreditó la transferencia");
  }
  if (allowed.length > 0 && !allowed.includes(account)) {
    throw new Error("Elegí la cuenta donde se acreditó la transferencia");
  }
  return account;
}

function resolveMedio(
  methods: EstudioPaymentMethod[],
  paymentMethod: string,
  transferAccount?: string | null,
  medioId?: number | null,
): { paymentMethod: string; transferAccount: string | null; isDolares: boolean } {
  const active = methods.filter((m) => m.active);
  if (medioId) {
    const medio = active.find((m) => m.id === medioId);
    if (!medio) throw new Error("Elegí un medio de cobro activo");
    const mapped = mapMedioToPayment(medio);
    return {
      ...mapped,
      isDolares: medio.kind === "dolares" || medio.name === "Dólares",
    };
  }
  if (paymentMethod === "Transferencia") {
    return {
      paymentMethod: "Transferencia",
      transferAccount: resolveTransferAccount(paymentMethod, transferAccount, active),
      isDolares: false,
    };
  }
  const byName = active.find((m) => m.name === paymentMethod);
  if (byName) {
    const mapped = mapMedioToPayment(byName);
    return {
      ...mapped,
      isDolares: byName.kind === "dolares" || byName.name === "Dólares",
    };
  }
  if (["Efectivo", "Cheque", "Dólares"].includes(paymentMethod)) {
    return {
      paymentMethod,
      transferAccount: null,
      isDolares: paymentMethod === "Dólares",
    };
  }
  throw new Error("Elegí un medio de cobro activo");
}

function mapTx(r: TxRow): LedgerRow {
  const payment: PaymentDetail | null = r.payment_method
    ? {
        documentation: parseJsonArray(r.documentation),
        paymentMethod: r.payment_method,
        dollarRate: r.dollar_rate == null ? null : num(r.dollar_rate),
        observations: r.observations,
        transferAccount: r.transfer_account,
      }
    : null;
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    date: String(r.date).slice(0, 10),
    concept: r.concept,
    type: r.type,
    amount: num(r.amount),
    createdBy: r.created_by,
    createdAt: r.created_at,
    payment,
  };
}

const TX_SELECT = `
  t.id, t.client_id, c.name as client_name, t.date::text as date, t.concept, t.type,
  t.amount, t.created_by, t.created_at::text as created_at,
  p.documentation, p.payment_method, p.dollar_rate, p.observations, p.transfer_account
`;

const TX_JOIN = `
  from transactions t
  join clients c on c.id = t.client_id and c.estudio_id = t.estudio_id
  left join payment_details p on p.transaction_id = t.id
`;

export async function recordPaymentImpl(
  userId: string,
  data: {
    clientId: number;
    amount: number;
    date: string;
    documentation: string[];
    paymentMethod: string;
    dollarRate?: number | null;
    observations?: string | null;
    transferAccount?: string | null;
  },
) {
  const staff = await ensureStaff(userId);
  await fetchClientById(data.clientId, staff.estudioId);
  const estudio = await fetchEstudio(staff.estudioId);
  const resolved = resolveMedio(
    estudio.paymentMethods,
    data.paymentMethod,
    data.transferAccount,
  );
  if (resolved.isDolares && !data.dollarRate) {
    throw new Error("Ingresá la cotización del dólar");
  }
  const arsAmount =
    resolved.isDolares && data.dollarRate
      ? Math.round(data.amount * data.dollarRate * 100) / 100
      : data.amount;
  const sql = await getSql();
  const tx = await sql<{ id: number }>`
    insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
    values (
      ${staff.estudioId}, ${data.clientId}, ${data.date}, 'Pago a cuenta', 'payment',
      ${arsAmount}, ${staff.userId}
    )
    returning id
  `;
  await sql`
    insert into payment_details (
      estudio_id, transaction_id, documentation, payment_method, dollar_rate, observations, transfer_account
    )
    values (
      ${staff.estudioId},
      ${tx[0].id},
      ${JSON.stringify(data.documentation)},
      ${resolved.paymentMethod},
      ${resolved.isDolares ? data.dollarRate ?? null : null},
      ${data.observations || null},
      ${resolved.transferAccount}
    )
  `;
  return { id: tx[0].id, amount: arsAmount };
}

export async function recordExtraordinaryChargeImpl(
  userId: string,
  data: { clientId: number; concept: string; amount: number; date: string },
) {
  const staff = await requireOwner(userId);
  await fetchClientById(data.clientId, staff.estudioId);
  const sql = await getSql();
  const tx = await sql<{ id: number }>`
    insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
    values (
      ${staff.estudioId}, ${data.clientId}, ${data.date}, ${data.concept}, 'charge',
      ${data.amount}, ${staff.userId}
    )
    returning id
  `;
  return { id: tx[0].id };
}

export async function getClientAccountImpl(
  userId: string,
  clientId: number,
): Promise<ClientAccount> {
  const staff = await ensureStaff(userId);
  const client = await fetchClientById(clientId, staff.estudioId);
  const sql = await getSql();
  const charges = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN}
     where t.estudio_id = $1 and t.client_id = $2 and t.type = 'charge'
     order by t.date desc, t.id desc limit 5`,
    [staff.estudioId, clientId],
  );
  const payments = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN}
     where t.estudio_id = $1 and t.client_id = $2 and t.type = 'payment'
     order by t.date desc, t.id desc limit 5`,
    [staff.estudioId, clientId],
  );
  const statement = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN}
     where t.estudio_id = $1 and t.client_id = $2
     order by t.date asc, t.id asc`,
    [staff.estudioId, clientId],
  );
  return {
    client,
    balance: client.balance,
    lastCharges: charges.map(mapTx),
    lastPayments: payments.map(mapTx),
    statement: statement.map(mapTx),
  };
}

export async function listLedgerImpl(
  estudioId: string,
  data?: {
    clientId?: number;
    type?: "charge" | "payment" | "all";
    from?: string;
    to?: string;
    q?: string;
  },
) {
  const params: unknown[] = [estudioId];
  const where: string[] = ["t.estudio_id = $1"];
  if (data?.clientId) {
    params.push(data.clientId);
    where.push(`t.client_id = $${params.length}`);
  }
  if (data?.type && data.type !== "all") {
    params.push(data.type);
    where.push(`t.type = $${params.length}`);
  }
  if (data?.from) {
    params.push(data.from);
    where.push(`t.date >= $${params.length}`);
  }
  if (data?.to) {
    params.push(data.to);
    where.push(`t.date <= $${params.length}`);
  }
  if (data?.q?.trim()) {
    params.push(`%${data.q.trim().toLowerCase()}%`);
    where.push(
      `(lower(t.concept) like $${params.length} or lower(c.name) like $${params.length})`,
    );
  }
  const whereSql = `where ${where.join(" and ")}`;
  const sql = await getSql();
  const rows = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN} ${whereSql} order by t.date desc, t.id desc limit 500`,
    params,
  );
  const totals = await sql.query<{ charges: unknown; payments: unknown }>(
    `select
       coalesce(sum(case when t.type = 'charge' then t.amount else 0 end), 0) as charges,
       coalesce(sum(case when t.type = 'payment' then t.amount else 0 end), 0) as payments
     ${TX_JOIN} ${whereSql}`,
    params,
  );
  return {
    rows: rows.map(mapTx),
    charges: num(totals[0]?.charges),
    payments: num(totals[0]?.payments),
  };
}

export async function listAllLedgerImpl(estudioId: string): Promise<LedgerRow[]> {
  const sql = await getSql();
  const rows = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN}
     where t.estudio_id = $1
     order by t.date asc, t.id asc`,
    [estudioId],
  );
  return rows.map(mapTx);
}

export async function listTransferPaymentsImpl(data: {
  estudioId: string;
  year: number;
  month: number | null;
  account: string | null;
}): Promise<LedgerRow[]> {
  const params: unknown[] = [data.estudioId, data.year];
  const where = [
    "t.estudio_id = $1",
    "t.type = 'payment'",
    "p.payment_method = 'Transferencia'",
    "extract(year from t.date) = $2",
  ];
  if (data.month) {
    params.push(data.month);
    where.push(`extract(month from t.date) = $${params.length}`);
  }
  if (data.account === "Sin cuenta") {
    where.push("(p.transfer_account is null or btrim(p.transfer_account) = '')");
  } else if (data.account) {
    params.push(data.account);
    where.push(`p.transfer_account = $${params.length}`);
  }
  const sql = await getSql();
  const rows = await sql.query<TxRow>(
    `select ${TX_SELECT} ${TX_JOIN} where ${where.join(" and ")} order by t.date desc, t.id desc`,
    params,
  );
  return rows.map(mapTx);
}

export async function updateTransactionImpl(
  userId: string,
  data: {
    id: number;
    clientId: number;
    date: string;
    concept: string;
    amount: number;
    documentation?: string[];
    paymentMethod?: string | null;
    dollarRate?: number | null;
    observations?: string | null;
    transferAccount?: string | null;
  },
) {
  const staff = await requireOwner(userId);
  await fetchClientById(data.clientId, staff.estudioId);
  const sql = await getSql();
  const existing = await sql<{ id: number; type: "charge" | "payment" }>`
    select id, type from transactions
    where id = ${data.id} and estudio_id = ${staff.estudioId}
  `;
  if (!existing[0]) throw new Error("Asiento no encontrado");

  if (existing[0].type === "charge") {
    await sql`
      update transactions
      set client_id = ${data.clientId},
          date = ${data.date},
          concept = ${data.concept},
          amount = ${data.amount}
      where id = ${data.id} and estudio_id = ${staff.estudioId}
    `;
    return { id: data.id, amount: data.amount };
  }

  const estudio = await fetchEstudio(staff.estudioId);
  if (!data.paymentMethod) throw new Error("Elegí el medio de pago");
  const resolved = resolveMedio(
    estudio.paymentMethods,
    data.paymentMethod,
    data.transferAccount,
  );
  if (resolved.isDolares && !data.dollarRate) {
    throw new Error("Ingresá la cotización del dólar");
  }
  const docs = data.documentation ?? [];
  if (docs.length === 0) throw new Error("Elegí al menos un comprobante");

  const arsAmount =
    resolved.isDolares && data.dollarRate
      ? Math.round(data.amount * data.dollarRate * 100) / 100
      : data.amount;

  await sql`
    update transactions
    set client_id = ${data.clientId},
        date = ${data.date},
        concept = ${data.concept || "Pago a cuenta"},
        amount = ${arsAmount}
    where id = ${data.id} and estudio_id = ${staff.estudioId}
  `;

  const detail = await sql<{ id: number }>`
    select id from payment_details where transaction_id = ${data.id}
  `;
  const rate = resolved.isDolares ? data.dollarRate ?? null : null;
  if (detail[0]) {
    await sql`
      update payment_details
      set documentation = ${JSON.stringify(docs)},
          payment_method = ${resolved.paymentMethod},
          dollar_rate = ${rate},
          observations = ${data.observations || null},
          transfer_account = ${resolved.transferAccount},
          estudio_id = ${staff.estudioId}
      where transaction_id = ${data.id}
    `;
  } else {
    await sql`
      insert into payment_details (
        estudio_id, transaction_id, documentation, payment_method, dollar_rate, observations, transfer_account
      )
      values (
        ${staff.estudioId},
        ${data.id},
        ${JSON.stringify(docs)},
        ${resolved.paymentMethod},
        ${rate},
        ${data.observations || null},
        ${resolved.transferAccount}
      )
    `;
  }
  return { id: data.id, amount: arsAmount };
}

export async function deleteTransactionImpl(userId: string, id: number) {
  const staff = await requireOwner(userId);
  const sql = await getSql();
  const existing = await sql<{ id: number }>`
    select id from transactions where id = ${id} and estudio_id = ${staff.estudioId}
  `;
  if (!existing[0]) throw new Error("Asiento no encontrado");
  await sql`delete from transactions where id = ${id} and estudio_id = ${staff.estudioId}`;
  return { ok: true };
}
