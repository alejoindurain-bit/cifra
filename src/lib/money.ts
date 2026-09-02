const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qty = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatARS(amount: number): string {
  return ars.format(amount);
}

export function formatUSD(amount: number): string {
  return usd.format(amount);
}

export function formatQty(amount: number): string {
  return qty.format(amount);
}

export function parseArgentineNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_ES[month - 1] ?? month} ${year}`;
}

export function honorariosConcept(year: number, month: number): string {
  return `Honorarios ${monthLabel(year, month)}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateAR(iso: string): string {
  if (!iso) return "—";
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export type FeeKind = "modules" | "amount" | "variable";

export function clientFeeKind(c: {
  fixedFee: boolean;
  monthlyAmount: number;
}): FeeKind {
  if (!c.fixedFee) return "variable";
  return c.monthlyAmount > 0 ? "amount" : "modules";
}

export function honorarioSummary(c: {
  fixedFee: boolean;
  monthlyModules: number;
  monthlyAmount: number;
}): { kind: FeeKind; label: string } {
  const kind = clientFeeKind(c);
  if (kind === "amount") return { kind, label: `${formatARS(c.monthlyAmount)} / mes` };
  if (kind === "modules") return { kind, label: `${formatQty(c.monthlyModules)} mód.` };
  return { kind, label: "Variable" };
}

export function monthlyHonorarioARS(
  c: { fixedFee: boolean; monthlyModules: number; monthlyAmount: number },
  moduleValue: number,
): number | null {
  const kind = clientFeeKind(c);
  if (kind === "amount" && c.monthlyAmount > 0) return c.monthlyAmount;
  if (kind === "modules" && c.monthlyModules > 0 && moduleValue > 0) {
    return Math.round(c.monthlyModules * moduleValue * 100) / 100;
  }
  return null;
}

export function monthsOfHonorario(balance: number, monthly: number | null): number | null {
  if (monthly == null || monthly <= 0 || !(balance > 0)) return null;
  return Math.round((balance / monthly) * 10) / 10;
}

export function formatMonths(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded.toLocaleString("es-AR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}
