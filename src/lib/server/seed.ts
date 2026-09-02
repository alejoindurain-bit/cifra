import { getSql } from "@/lib/db";
import {
  BELTRAN_ESTUDIO_ID,
  DEMO_ACCOUNTS,
  MUESTRA_ESTUDIO_ID,
  ORIGINAL_ESTUDIO_ID,
} from "@/lib/constants";
import { honorariosConcept } from "@/lib/money";
import type { PaymentMethodKind } from "@/lib/fn/types";
import { PAYMENT_METHODS, TRANSFER_ACCOUNTS, DOCUMENTATION_OPTIONS, COMPANY_TYPES, IVA_CONDITIONS, MONOTRIBUTO_CATEGORIES } from "@/lib/constants";

const MODULE = 3693;

type SeedClient = {
  name: string;
  contact: string;
  cuit: string;
  companyType: string;
  ivaCondition: string;
  email?: string;
  phone?: string;
  monotributoCategory?: string;
  fixedFee: boolean;
  monthlyModules: number;
  gananciasInMonthly: boolean;
  monthlyAmount?: number;
};

const ORIGINAL_CLIENTS: SeedClient[] = [
  {
    name: "Distribuidora San Martín S.A.",
    contact: "Ana López · 011 4567-2210",
    cuit: "30-71588210-4",
    companyType: "S.A.",
    ivaCondition: "Responsable Inscripto",
    email: "ana@sanmartin.example",
    phone: "011 4567-2210",
    fixedFee: true,
    monthlyModules: 8,
    gananciasInMonthly: true,
  },
  {
    name: "Pérez Hermanos S.R.L.",
    contact: "Carlos Pérez · 011 4788-0091",
    cuit: "30-69844112-8",
    companyType: "S.R.L.",
    ivaCondition: "Responsable Inscripto",
    email: "carlos@perezhnos.example",
    phone: "011 4788-0091",
    fixedFee: true,
    monthlyModules: 5,
    gananciasInMonthly: false,
  },
  {
    name: "María Elena Gómez",
    contact: "María Gómez · 011 15-5321-8890",
    cuit: "27-28441902-3",
    companyType: "Unipersonal",
    ivaCondition: "Monotributo",
    monotributoCategory: "C",
    email: "maria.gomez@example.com",
    phone: "011 15-5321-8890",
    fixedFee: true,
    monthlyModules: 2,
    gananciasInMonthly: false,
  },
  {
    name: "Agropecuaria La Pampa S.A.",
    contact: "Ricardo Funes · 02342 42-1180",
    cuit: "30-54110987-1",
    companyType: "S.A.",
    ivaCondition: "Responsable Inscripto",
    fixedFee: true,
    monthlyModules: 12,
    gananciasInMonthly: true,
  },
  {
    name: "Taller Mecánico El Puente",
    contact: "Hugo Díaz · 011 4221-7765",
    cuit: "20-22344198-6",
    companyType: "Unipersonal",
    ivaCondition: "Responsable Inscripto",
    fixedFee: false,
    monthlyModules: 0,
    gananciasInMonthly: false,
  },
  {
    name: "Farmacia del Centro S.R.L.",
    contact: "Laura Méndez · 0221 421-3344",
    cuit: "30-71220981-5",
    companyType: "S.R.L.",
    ivaCondition: "Responsable Inscripto",
    fixedFee: true,
    monthlyModules: 4,
    gananciasInMonthly: true,
  },
  {
    name: "Estudio Jurídico Rivas",
    contact: "Martín Rivas · 011 4812-0098",
    cuit: "20-25998110-7",
    companyType: "Unipersonal",
    ivaCondition: "Monotributo",
    monotributoCategory: "E",
    fixedFee: true,
    monthlyModules: 3,
    gananciasInMonthly: false,
  },
  {
    name: "Constructora Norte S.A.S.",
    contact: "Sofía Alvarez · 011 5277-4410",
    cuit: "30-71776002-9",
    companyType: "S.A.S.",
    ivaCondition: "Responsable Inscripto",
    fixedFee: false,
    monthlyModules: 0,
    gananciasInMonthly: false,
  },
];

const MUESTRA_CLIENTS: SeedClient[] = [
  {
    name: "Panadería Los Andes",
    contact: "Rosa Varela · 011 4300-1122",
    cuit: "20-18440011-3",
    companyType: "Unipersonal",
    ivaCondition: "Monotributo",
    monotributoCategory: "B",
    email: "rosa@losandes.example",
    phone: "011 4300-1122",
    fixedFee: true,
    monthlyModules: 3,
    gananciasInMonthly: false,
  },
  {
    name: "Diseño Sur S.A.S.",
    contact: "Julián Costa · 011 5199-4400",
    cuit: "30-71660021-8",
    companyType: "S.A.S.",
    ivaCondition: "Responsable Inscripto",
    email: "julian@disenosur.example",
    fixedFee: true,
    monthlyModules: 6,
    gananciasInMonthly: true,
  },
  {
    name: "Kiosco 24 del Parque",
    contact: "Nora Paz · 011 15-4001-7788",
    cuit: "27-31200918-6",
    companyType: "Unipersonal",
    ivaCondition: "Monotributo",
    monotributoCategory: "A",
    fixedFee: true,
    monthlyAmount: 28000,
    monthlyModules: 0,
    gananciasInMonthly: false,
  },
];

const BELTRAN_CLIENTS: SeedClient[] = [
  {
    name: "Café Palermo S.A.",
    contact: "Lucía Ferreyra · 011 4833-2201",
    cuit: "30-70991880-2",
    companyType: "S.A.",
    ivaCondition: "Responsable Inscripto",
    email: "lucia@cafepalermo.example",
    phone: "011 4833-2201",
    fixedFee: true,
    monthlyAmount: 85000,
    monthlyModules: 0,
    gananciasInMonthly: true,
  },
  {
    name: "Estudio López & Asoc.",
    contact: "Diego López · 011 4372-0090",
    cuit: "20-26771904-5",
    companyType: "Unipersonal",
    ivaCondition: "Responsable Inscripto",
    email: "diego@lopez.example",
    fixedFee: true,
    monthlyAmount: 42000,
    monthlyModules: 0,
    gananciasInMonthly: false,
  },
  {
    name: "Atelier Recoleta",
    contact: "Marina Soto · 011 4807-6611",
    cuit: "27-33100218-9",
    companyType: "Unipersonal",
    ivaCondition: "Monotributo",
    monotributoCategory: "D",
    phone: "011 4807-6611",
    fixedFee: false,
    monthlyModules: 0,
    gananciasInMonthly: false,
  },
];

type MedioSeed = {
  name: string;
  kind: PaymentMethodKind;
  bank?: string;
  cbuAlias?: string;
};

const ORIGINAL_MEDIOS: MedioSeed[] = [
  { name: "Efectivo", kind: "efectivo" },
  { name: "Cheque", kind: "cheque" },
  { name: "Dólares", kind: "dolares" },
  { name: "Cuenta DNI", kind: "transferencia", bank: "Banco Provincia" },
  { name: "Banco Provincia", kind: "transferencia", bank: "Banco Provincia" },
  { name: "Banco Galicia", kind: "transferencia", bank: "Banco Galicia" },
  { name: "Mercado Pago", kind: "mercado_pago", cbuAlias: "estudio.original.mp" },
];

const MUESTRA_MEDIOS: MedioSeed[] = [
  { name: "Efectivo", kind: "efectivo" },
  { name: "Cheque", kind: "cheque" },
  { name: "Dólares", kind: "dolares" },
  { name: "Cuenta DNI", kind: "transferencia" },
  { name: "Banco Provincia", kind: "transferencia", bank: "Banco Provincia" },
  { name: "Mercado Pago", kind: "mercado_pago", cbuAlias: "muestra.mp" },
];

const BELTRAN_MEDIOS: MedioSeed[] = [
  { name: "Mercado Pago", kind: "mercado_pago", cbuAlias: "beltran.mp" },
  { name: "Provincia", kind: "transferencia", bank: "Banco Provincia" },
  { name: "Cheque", kind: "cheque" },
];

let seeded = false;

type VocabSeed = { kind: string; value: string; label?: string };

const DEFAULT_VOCAB: VocabSeed[] = [
  // payment_method
  ...PAYMENT_METHODS.map((v) => ({ kind: "payment_method", value: v })),
  // transfer_account
  ...TRANSFER_ACCOUNTS.map((v) => ({ kind: "transfer_account", value: v })),
  // documentation
  ...DOCUMENTATION_OPTIONS.map((v) => ({ kind: "documentation", value: v })),
  // company_type
  ...COMPANY_TYPES.map((v) => ({ kind: "company_type", value: v })),
  // iva_condition
  ...IVA_CONDITIONS.map((v) => ({ kind: "iva_condition", value: v })),
  // monotributo_category
  ...MONOTRIBUTO_CATEGORIES.map((v) => ({ kind: "monotributo_category", value: v })),
];

async function insertVocab(estudioId: string) {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from estudio_vocab where estudio_id = ${estudioId}
  `;
  if ((existing[0]?.c ?? 0) > 0) return;
  let order = 0;
  for (const v of DEFAULT_VOCAB) {
    order += 1;
    await sql`
      insert into estudio_vocab (estudio_id, kind, value, kind_label, active, sort_order)
      values (${estudioId}, ${v.kind}, ${v.value}, ${v.label ?? null}, true, ${order})
    `;
  }
}

type MetadataSeed = {
  cuit?: string;
  telefono?: string;
  email?: string;
  web?: string;
  domicilio: {
    calle: string;
    numero: string;
    piso?: string;
    depto?: string;
    localidad: string;
    provincia: string;
    cp: string;
  };
};

async function insertEstudioMetadata(estudioId: string, data: MetadataSeed) {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from estudio_metadata where estudio_id = ${estudioId}
  `;
  if ((existing[0]?.c ?? 0) > 0) return;
  await sql`
    insert into estudio_metadata (
      estudio_id,
      cuit, telefono, email, web,
      domicilio_calle, domicilio_numero, domicilio_piso, domicilio_depto,
      domicilio_localidad, domicilio_provincia, domicilio_cp
    ) values (
      ${estudioId},
      ${data.cuit ?? null}, ${data.telefono ?? null}, ${data.email ?? null}, ${data.web ?? null},
      ${data.domicilio.calle}, ${data.domicilio.numero},
      ${data.domicilio.piso ?? null}, ${data.domicilio.depto ?? null},
      ${data.domicilio.localidad}, ${data.domicilio.provincia}, ${data.domicilio.cp}
    )
  `;
}

const MUESTRA_METADATA: MetadataSeed = {
  cuit: "30-71234567-8",
  telefono: "011 4321-0000",
  email: "estudio.lapaz@cifra.demo",
  web: "estudiolapaz.demo.com.ar",
  domicilio: {
    calle: "Av. Rivadavia",
    numero: "1234",
    piso: "3",
    depto: "B",
    localidad: "CABA",
    provincia: "Buenos Aires",
    cp: "1407",
  },
};

const BELTRAN_METADATA: MetadataSeed = {
  cuit: "30-71234567-9",
  telefono: "0221 555-1100",
  email: "beltran@cifra.demo",
  domicilio: {
    calle: "Calle 50",
    numero: "320",
    localidad: "La Plata",
    provincia: "Buenos Aires",
    cp: "1900",
  },
};

async function insertMedios(estudioId: string, medios: MedioSeed[]) {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from payment_methods where estudio_id = ${estudioId}
  `;
  if ((existing[0]?.c ?? 0) > 0) return;
  let order = 0;
  for (const m of medios) {
    order += 1;
    await sql`
      insert into payment_methods (estudio_id, name, kind, bank, cbu_alias, active, sort_order)
      values (
        ${estudioId}, ${m.name}, ${m.kind}, ${m.bank ?? null}, ${m.cbuAlias ?? null}, true, ${order}
      )
    `;
  }
}

async function insertClients(estudioId: string, clients: SeedClient[]): Promise<number[]> {
  const sql = await getSql();
  const ids: number[] = [];
  for (const c of clients) {
    const rows = await sql<{ id: number }>`
      insert into clients (
        estudio_id, name, contact, email, phone, notes, cuit, company_type, iva_condition,
        monotributo_category, fixed_fee, monthly_modules, monthly_amount, ganancias_in_monthly
      )
      values (
        ${estudioId}, ${c.name}, ${c.contact}, ${c.email ?? null}, ${c.phone ?? null}, ${null},
        ${c.cuit}, ${c.companyType}, ${c.ivaCondition}, ${c.monotributoCategory ?? null},
        ${c.fixedFee}, ${c.monthlyModules}, ${c.monthlyAmount ?? 0}, ${c.gananciasInMonthly}
      )
      returning id
    `;
    ids.push(rows[0].id);
  }
  return ids;
}

async function charge(
  estudioId: string,
  clientId: number,
  date: string,
  concept: string,
  amount: number,
) {
  const sql = await getSql();
  await sql`
    insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
    values (${estudioId}, ${clientId}, ${date}, ${concept}, 'charge', ${amount}, 'sistema')
  `;
}

async function payment(
  estudioId: string,
  clientId: number,
  date: string,
  amount: number,
  method: string,
  docs: string[],
  obs: string | null,
  account: string | null = null,
) {
  const sql = await getSql();
  const tx = await sql<{ id: number }>`
    insert into transactions (estudio_id, client_id, date, concept, type, amount, created_by)
    values (${estudioId}, ${clientId}, ${date}, ${"Pago a cuenta"}, 'payment', ${amount}, 'sistema')
    returning id
  `;
  await sql`
    insert into payment_details (
      estudio_id, transaction_id, documentation, payment_method, dollar_rate, observations, transfer_account
    )
    values (
      ${estudioId}, ${tx[0].id}, ${JSON.stringify(docs)}, ${method}, ${null}, ${obs}, ${account}
    )
  `;
}

async function seedOriginalIfEmpty() {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from clients where estudio_id = ${ORIGINAL_ESTUDIO_ID}
  `;
  if ((existing[0]?.c ?? 0) > 0) {
    const marked = await sql<{ t: number }>`
      select count(*)::int as t from clients
      where estudio_id = ${ORIGINAL_ESTUDIO_ID} and ganancias_in_monthly = true
    `;
    if ((marked[0]?.t ?? 0) === 0) {
      for (const c of ORIGINAL_CLIENTS) {
        if (c.gananciasInMonthly) {
          await sql`
            update clients set ganancias_in_monthly = true
            where estudio_id = ${ORIGINAL_ESTUDIO_ID} and cuit = ${c.cuit}
          `;
        }
      }
    }
    return;
  }

  const ids = await insertClients(ORIGINAL_ESTUDIO_ID, ORIGINAL_CLIENTS);
  const [sm, ph, mg, ap, taller, farm, rivas, constN] = ids;
  const jun = honorariosConcept(2026, 6);
  const jul = honorariosConcept(2026, 7);
  const eid = ORIGINAL_ESTUDIO_ID;

  await charge(eid, sm, "2026-06-01", `${jun} (8 × $3.693)`, 8 * MODULE);
  await charge(eid, sm, "2026-07-01", `${jul} (8 × $3.693)`, 8 * MODULE);
  await payment(eid, sm, "2026-06-18", 29544, "Transferencia", ["Recibo"], "Pago junio", "Banco Galicia");
  await payment(eid, sm, "2026-08-12", 15000, "Transferencia", ["Recibo"], "Pago a cuenta agosto", "Cuenta DNI");

  await charge(eid, ph, "2026-06-01", `${jun} (5 × $3.693)`, 5 * MODULE);
  await charge(eid, ph, "2026-07-01", `${jul} (5 × $3.693)`, 5 * MODULE);
  await payment(eid, ph, "2026-06-10", 18465, "Transferencia", ["Factura", "Recibo"], null, "Banco Provincia");
  await payment(eid, ph, "2026-07-12", 18465, "Transferencia", ["Factura", "Recibo"], null, "Banco Provincia");

  await charge(eid, mg, "2026-06-01", `${jun} (2 × $3.693)`, 2 * MODULE);
  await charge(eid, mg, "2026-07-01", `${jul} (2 × $3.693)`, 2 * MODULE);
  await payment(eid, mg, "2026-07-28", 5000, "Efectivo", ["Recibo", "Cobra Mónica"], "Parcial");

  await charge(eid, ap, "2026-06-01", `${jun} (12 × $3.693)`, 12 * MODULE);
  await charge(eid, ap, "2026-07-01", `${jul} (12 × $3.693)`, 12 * MODULE);
  await payment(eid, ap, "2026-06-22", 20000, "Cheque", ["Recibo"], "Cheque 30 días");

  await charge(eid, taller, "2026-05-14", "Balance 2025 y DDJJ Ganancias", 85000);
  await payment(eid, taller, "2026-06-03", 40000, "Efectivo", ["Recibo"], "Seña");
  await payment(eid, taller, "2026-08-05", 45000, "Transferencia", ["Factura"], "Saldo balance", "Mercado Pago");

  await charge(eid, farm, "2026-06-01", `${jun} (4 × $3.693)`, 4 * MODULE);
  await charge(eid, farm, "2026-07-01", `${jul} (4 × $3.693)`, 4 * MODULE);
  await payment(eid, farm, "2026-06-08", 14772, "Transferencia", ["Factura"], null, "Cuenta DNI");
  await payment(eid, farm, "2026-07-09", 20000, "Transferencia", ["Factura", "Recibo"], "Adelanto", "Mercado Pago");

  await charge(eid, rivas, "2026-06-01", `${jun} (3 × $3.693)`, 3 * MODULE);
  await charge(eid, rivas, "2026-07-01", `${jul} (3 × $3.693)`, 3 * MODULE);

  await charge(eid, constN, "2026-04-20", "Constitución de S.A.S. e inscripción AFIP", 120000);
  await payment(eid, constN, "2026-04-22", 120000, "Transferencia", ["Factura"], "Honorarios constitución", "Banco Galicia");
  await charge(eid, constN, "2026-08-08", "Asesoramiento impositivo obra 3", 45000);

  await sql`
    insert into billing_runs (estudio_id, year, month, module_value, clients_billed, run_at)
    values
      (${eid}, 2026, 6, ${MODULE}, 6, '2026-06-01 08:00:00+00'),
      (${eid}, 2026, 7, ${MODULE}, 6, '2026-07-01 08:00:00+00')
    on conflict (estudio_id, year, month) do nothing
  `;
  await sql`
    insert into module_values (estudio_id, value, vigencia, fetched_at)
    values (${eid}, ${MODULE}, '01/08/2026', now())
  `;
}

async function seedMuestraIfEmpty() {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from clients where estudio_id = ${MUESTRA_ESTUDIO_ID}
  `;
  if ((existing[0]?.c ?? 0) > 0) return;
  const ids = await insertClients(MUESTRA_ESTUDIO_ID, MUESTRA_CLIENTS);
  const [pan, dis, kiosco] = ids;
  const eid = MUESTRA_ESTUDIO_ID;
  const jun = honorariosConcept(2026, 6);
  const jul = honorariosConcept(2026, 7);
  await charge(eid, pan, "2026-06-01", `${jun} (3 × $3.693)`, 3 * MODULE);
  await charge(eid, pan, "2026-07-01", `${jul} (3 × $3.693)`, 3 * MODULE);
  await payment(eid, pan, "2026-06-20", 11079, "Efectivo", ["Recibo"], "Junio");
  await charge(eid, dis, "2026-06-01", `${jun} (6 × $3.693)`, 6 * MODULE);
  await charge(eid, dis, "2026-07-01", `${jul} (6 × $3.693)`, 6 * MODULE);
  await payment(eid, dis, "2026-07-05", 22158, "Transferencia", ["Factura"], null, "Banco Provincia");
  await charge(eid, kiosco, "2026-06-01", `${jun} (monto fijo $28.000,00)`, 28000);
  await charge(eid, kiosco, "2026-07-01", `${jul} (monto fijo $28.000,00)`, 28000);
  await payment(eid, kiosco, "2026-07-18", 15000, "Transferencia", ["Recibo"], "Parcial", "Mercado Pago");
  await charge(eid, dis, "2026-08-04", "DDJJ IVA y Ganancias 2025", 62000);
  await sql`
    insert into billing_runs (estudio_id, year, month, module_value, clients_billed, run_at)
    values
      (${eid}, 2026, 6, ${MODULE}, 3, '2026-06-01 08:00:00+00'),
      (${eid}, 2026, 7, ${MODULE}, 3, '2026-07-01 08:00:00+00')
    on conflict (estudio_id, year, month) do nothing
  `;
  await sql`
    insert into module_values (estudio_id, value, vigencia, fetched_at)
    values (${eid}, ${MODULE}, '01/08/2026', now())
  `;
}

async function seedBeltranIfEmpty() {
  const sql = await getSql();
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from clients where estudio_id = ${BELTRAN_ESTUDIO_ID}
  `;
  if ((existing[0]?.c ?? 0) > 0) return;
  const ids = await insertClients(BELTRAN_ESTUDIO_ID, BELTRAN_CLIENTS);
  const [cafe, lopez, atelier] = ids;
  const eid = BELTRAN_ESTUDIO_ID;
  const jun = honorariosConcept(2026, 6);
  const jul = honorariosConcept(2026, 7);
  await charge(eid, cafe, "2026-06-01", `${jun} (monto fijo $85.000,00)`, 85000);
  await charge(eid, cafe, "2026-07-01", `${jul} (monto fijo $85.000,00)`, 85000);
  await payment(eid, cafe, "2026-06-15", 85000, "Transferencia", ["Factura"], "Honorarios junio", "Mercado Pago");
  await payment(eid, cafe, "2026-07-14", 40000, "Transferencia", ["Factura"], "A cuenta julio", "Provincia");
  await charge(eid, lopez, "2026-06-01", `${jun} (monto fijo $42.000,00)`, 42000);
  await charge(eid, lopez, "2026-07-01", `${jul} (monto fijo $42.000,00)`, 42000);
  await payment(eid, lopez, "2026-07-02", 42000, "Cheque", ["Recibo"], "Cheque diferido");
  await charge(eid, atelier, "2026-07-22", "Constitución SAS y alta AFIP", 95000);
  await payment(eid, atelier, "2026-08-01", 50000, "Transferencia", ["Recibo"], "Seña constitución", "Mercado Pago");
  await sql`
    insert into billing_runs (estudio_id, year, month, module_value, clients_billed, run_at)
    values
      (${eid}, 2026, 6, 0, 2, '2026-06-01 08:00:00+00'),
      (${eid}, 2026, 7, 0, 2, '2026-07-01 08:00:00+00')
    on conflict (estudio_id, year, month) do nothing
  `;
}

async function ensureDemoUsers() {
  const sql = await getSql();

  type DemoAuthCtx = {
    password: { hash: (password: string) => Promise<string> };
    internalAdapter: {
      createUser: (data: {
        email: string;
        name: string;
        emailVerified?: boolean;
      }) => Promise<{ id: string }>;
      linkAccount: (data: {
        userId: string;
        providerId: string;
        accountId: string;
        password: string;
      }) => Promise<unknown>;
    };
  };

  let ctx: DemoAuthCtx | null = null;
  try {
    const mod = await import("@/lib/auth/server");
    ctx = (await mod.auth.$context) as unknown as DemoAuthCtx;
  } catch {
    ctx = null;
  }

  for (const demo of DEMO_ACCOUNTS) {
    let rows = await sql<{ id: string }>`
      select id from "user" where email = ${demo.email} limit 1
    `;
    let createdNow = false;
    if (!rows[0] && ctx) {
      try {
        const hash = await ctx.password.hash(demo.password);
        const created = await ctx.internalAdapter.createUser({
          email: demo.email.toLowerCase(),
          name: demo.name,
          emailVerified: true,
        });
        await ctx.internalAdapter.linkAccount({
          userId: created.id,
          providerId: "credential",
          accountId: created.id,
          password: hash,
        });
        createdNow = true;
        rows = [{ id: created.id }];
      } catch {
        rows = await sql<{ id: string }>`
          select id from "user" where email = ${demo.email} limit 1
        `;
      }
    }
    if (!rows[0]) continue;
    const userId = rows[0].id;
    if (createdNow) {
      // Seed must never leave a session (or Set-Cookie) for the new user.
      await sql`delete from "session" where "userId" = ${userId}`;
    }
    if (ctx) {
      const acc = await sql<{ id: string }>`
        select id from "account"
        where "userId" = ${userId} and "providerId" = 'credential'
        limit 1
      `;
      if (!acc[0]) {
        try {
          const hash = await ctx.password.hash(demo.password);
          await ctx.internalAdapter.linkAccount({
            userId,
            providerId: "credential",
            accountId: userId,
            password: hash,
          });
        } catch {
          /* already linked */
        }
      }
    }
    const staff = await sql<{ user_id: string }>`
      select user_id from staff where user_id = ${userId}
    `;
    if (staff[0]) {
      await sql`
        update staff
        set estudio_id = ${demo.estudioId}, role = 'owner', name = ${demo.name}, email = ${demo.email}
        where user_id = ${userId}
      `;
    } else {
      await sql`
        insert into staff (user_id, role, name, email, estudio_id)
        values (${userId}, 'owner', ${demo.name}, ${demo.email}, ${demo.estudioId})
      `;
    }
  }
}

export async function seedPreviewData(): Promise<void> {
  if (!seeded) {
    const sql = await getSql();
    await sql`select id from estudios limit 1`;
    await insertMedios(ORIGINAL_ESTUDIO_ID, ORIGINAL_MEDIOS);
    await insertMedios(MUESTRA_ESTUDIO_ID, MUESTRA_MEDIOS);
    await insertMedios(BELTRAN_ESTUDIO_ID, BELTRAN_MEDIOS);
    // Seed default vocab for each demo estudio
    await insertVocab(ORIGINAL_ESTUDIO_ID);
    await insertVocab(MUESTRA_ESTUDIO_ID);
    await insertVocab(BELTRAN_ESTUDIO_ID);
    // Seed display metadata for the demo estudios (address/CUIT/contact on
    // the receipt header). The "original" estudio stays empty on purpose.
    await insertEstudioMetadata(MUESTRA_ESTUDIO_ID, MUESTRA_METADATA);
    await insertEstudioMetadata(BELTRAN_ESTUDIO_ID, BELTRAN_METADATA);
    // Pérez / San Martín stay on the unused original row only if already there.
    // New real estudios never inherit that seed. Demo box = Muestra + Beltrán.
    await seedMuestraIfEmpty();
    await seedBeltranIfEmpty();
    await ensureDemoUsers();
    seeded = true;
  }
  await emptyLeakedToyFromRealEstudios();
  const { importRespaldoIfNeeded } = await import("./import-respaldo");
  await importRespaldoIfNeeded();
}

const REAL_OWNER_EMAIL = "alejo.indurain1@gmail.com";

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const TOY_CUITS = new Set(
  [...ORIGINAL_CLIENTS, ...MUESTRA_CLIENTS, ...BELTRAN_CLIENTS].map((c) => c.cuit),
);
const TOY_NAMES = new Set(
  [...ORIGINAL_CLIENTS, ...MUESTRA_CLIENTS, ...BELTRAN_CLIENTS].map((c) => foldName(c.name)),
);

async function wipeOperationalData(estudioId: string) {
  if (estudioId === MUESTRA_ESTUDIO_ID || estudioId === BELTRAN_ESTUDIO_ID) return;
  const sql = await getSql();
  await sql`
    delete from payment_details
    where estudio_id = ${estudioId}
       or transaction_id in (select id from transactions where estudio_id = ${estudioId})
  `;
  await sql`delete from transactions where estudio_id = ${estudioId}`;
  await sql`delete from clients where estudio_id = ${estudioId}`;
  await sql`delete from billing_runs where estudio_id = ${estudioId}`;
}

async function emptyLeakedToyFromRealEstudios() {
  const sql = await getSql();
  const rows = await sql<{ id: string; display_name: string; email: string | null }>`
    select e.id, e.display_name, s.email
    from estudios e
    left join staff s on s.estudio_id = e.id
    where e.id <> ${MUESTRA_ESTUDIO_ID} and e.id <> ${BELTRAN_ESTUDIO_ID}
  `;
  const targets = new Set<string>();
  for (const r of rows) {
    if (r.email && r.email.toLowerCase() === REAL_OWNER_EMAIL) targets.add(r.id);
    const n = foldName(r.display_name);
    if (n.includes("integral") && n.includes("beltran")) targets.add(r.id);
  }
  for (const id of targets) {
    const clients = await sql<{ name: string; cuit: string | null }>`
      select name, cuit from clients where estudio_id = ${id}
    `;
    if (clients.length === 0) continue;
    const hasToy = clients.some(
      (c) =>
        (c.cuit && TOY_CUITS.has(c.cuit)) || TOY_NAMES.has(foldName(c.name)),
    );
    // Born with the toy seed — empty the whole operational ledger, keep Ajustes.
    if (hasToy) await wipeOperationalData(id);
  }
}
