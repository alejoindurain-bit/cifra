import type { PAYMENT_METHOD_KINDS, Role, VENCIMIENTO_KINDS, VENCIMIENTO_STATUSES } from "@/lib/constants";

export type StaffMember = {
  userId: string;
  role: Role;
  name: string | null;
  email: string | null;
  createdAt: string;
  estudioId: string;
  active: boolean;
};

export type SessionInfo = {
  userId: string;
  role: Role;
  name: string | null;
  email: string | null;
  estudioId: string;
};

export type EstudioFlags = {
  caja: boolean;
  cuentaCorriente: boolean;
  honorarios: boolean;
  cpceba: boolean;
  cobrosFijos: boolean;
  honorariosMensuales: boolean;
  honorariosExtraordinarios: boolean;
  pbaIibb: boolean;
  vencimientos: boolean;
  dashCobradoMes: boolean;
  dashPendiente: boolean;
  dashVencimientos: boolean;
  dashGrafico: boolean;
  dashIibbPba: boolean;
};

export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export type EstudioPaymentMethod = {
  id: number;
  name: string;
  kind: PaymentMethodKind;
  bank: string | null;
  cbuAlias: string | null;
  active: boolean;
  sortOrder: number;
};

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

export type EstudioMetadata = {
  logoPath: string | null;
  domicilio: {
    calle: string | null;
    numero: string | null;
    piso: string | null;
    depto: string | null;
    localidad: string | null;
    provincia: string | null;
    cp: string | null;
  };
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
};

export type EstudioInfo = {
  id: string;
  slug: string;
  displayName: string;
  accentColor: string | null;
  flags: EstudioFlags;
  paymentMethods: EstudioPaymentMethod[];
  vocab: Record<VocabKind, VocabEntry[]>;
  metadata: EstudioMetadata | null;
};

export type FeeKind = "modules" | "amount" | "variable";

export type Client = {
  id: number;
  estudioId: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  cuit: string | null;
  companyType: string | null;
  ivaCondition: string | null;
  monotributoCategory: string | null;
  fixedFee: boolean;
  monthlyModules: number;
  monthlyAmount: number;
  gananciasInMonthly: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  balance: number;
};

export type PaymentDetail = {
  documentation: string[];
  paymentMethod: string;
  dollarRate: number | null;
  observations: string | null;
  transferAccount: string | null;
};

export type LedgerRow = {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  concept: string;
  type: "charge" | "payment";
  amount: number;
  createdBy: string | null;
  createdAt: string;
  payment: PaymentDetail | null;
};

export type ClientAccount = {
  client: Client;
  balance: number;
  lastCharges: LedgerRow[];
  lastPayments: LedgerRow[];
  statement: LedgerRow[];
};

export type ModuleQuote = {
  value: number;
  vigencia: string | null;
  fetchedAt: string;
  source: "live" | "cache" | "fallback";
};

export type DollarQuote = {
  compra: number;
  venta: number;
  updatedAt: string | null;
};

export type BillingResult = {
  ran: boolean;
  year: number;
  month: number;
  moduleValue: number;
  clientsBilled: number;
  alreadyDone: boolean;
};

export type BackfillMonth = {
  year: number;
  month: number;
  label: string;
  kind: "modules" | "amount";
  moduleValue: number;
  modules: number;
  amount: number;
  skipped: boolean;
};

export type BackfillPreview = {
  months: BackfillMonth[];
  toCharge: number;
  skipped: number;
  totalAmount: number;
};

export type BackfillResult = {
  billed: number;
  skipped: number;
  totalAmount: number;
};

export type VencimientoKind = (typeof VENCIMIENTO_KINDS)[number];
export type VencimientoStatus = (typeof VENCIMIENTO_STATUSES)[number];

export type Vencimiento = {
  id: number;
  estudioId: string;
  title: string;
  dueDate: string;
  kind: VencimientoKind;
  clientId: number | null;
  clientName: string | null;
  status: VencimientoStatus;
  createdAt: string;
};

export type DashboardData = {
  monthIncome: number;
  monthCharges: number;
  totalDebt: number;
  clientCount: number;
  activeFixed: number;
  module: ModuleQuote;
  topDebtors: Array<{
    id: number;
    name: string;
    balance: number;
    monthsEquivalent: number | null;
  }>;
  cashflow: Array<{
    year: number;
    month: number;
    label: string;
    charges: number;
    payments: number;
  }>;
  recent: LedgerRow[];
  lastBilling: BillingResult | null;
  upcomingVencimientos: Vencimiento[];
};

export type TransferBucket = {
  account: string;
  count: number;
  amount: number;
  share: number;
};

export type TransferReport = {
  year: number;
  month: number | null;
  account: string | null;
  years: number[];
  totals: TransferBucket[];
  count: number;
  amount: number;
  rows: LedgerRow[];
};
