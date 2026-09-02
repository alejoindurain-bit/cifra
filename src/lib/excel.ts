import { clientFeeKind, todayISO } from "@/lib/money";
import type { Client, LedgerRow } from "@/lib/fn/types";

export type Sheet = {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
};

const ENT: Record<string, string> = {
  "&": "&" + "amp;",
  "<": "&" + "lt;",
  ">": "&" + "gt;",
  '"': "&" + "quot;",
};

function xmlEscape(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ENT[ch] ?? ch);
}

function sheetName(raw: string): string {
  return raw.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31) || "Hoja";
}

function cellXml(value: string | number | null): string {
  if (value == null || value === "") {
    return "<Cell/>";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell ss:StyleID="num"><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

function sheetXml(sheet: Sheet): string {
  const header = `<Row>${sheet.headers
    .map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join("")}</Row>`;
  const body = sheet.rows
    .map((row) => `<Row>${row.map(cellXml).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(sheetName(sheet.name))}"><Table>${header}${body}</Table></Worksheet>`;
}

export function downloadWorkbook(filename: string, sheets: Sheet[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="hdr"><Font ss:Bold="1"/></Style>
<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>
</Styles>
${sheets.map(sheetXml).join("\n")}
</Workbook>`;
  const blob = new Blob(["\uFEFF" + xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(prefix: string): string {
  return `${prefix}-${todayISO()}.xls`;
}

export function clientsSheet(rows: Client[]): Sheet {
  return {
    name: "Clientes",
    headers: [
      "id",
      "nombre",
      "contacto",
      "cuit",
      "tipo_sociedad",
      "iva",
      "honorario_tipo",
      "modulos_mensuales",
      "monto_mensual",
      "ganancias",
      "activo",
      "saldo",
      "creado",
      "actualizado",
    ],
    rows: rows.map((c) => [
      c.id,
      c.name,
      c.contact,
      c.cuit,
      c.companyType,
      c.ivaCondition,
      clientFeeKind(c),
      c.monthlyModules,
      c.monthlyAmount,
      c.gananciasInMonthly ? "En mensual" : "En DDJJ",
      c.active ? "Sí" : "No",
      c.balance,
      c.createdAt,
      c.updatedAt,
    ]),
  };
}

export function ledgerSheet(rows: LedgerRow[]): Sheet {
  return {
    name: "Libro mayor",
    headers: [
      "id",
      "fecha",
      "cliente_id",
      "cliente",
      "concepto",
      "tipo",
      "monto",
      "creado_por",
      "creado_el",
      "medio_pago",
      "cuenta_acreditacion",
      "documentacion",
      "cotizacion_dolar",
      "observaciones",
    ],
    rows: rows.map((r) => [
      r.id,
      r.date,
      r.clientId,
      r.clientName,
      r.concept,
      r.type === "charge" ? "Cargo" : "Pago",
      r.amount,
      r.createdBy,
      r.createdAt,
      r.payment?.paymentMethod ?? null,
      r.payment?.transferAccount ?? null,
      r.payment?.documentation.length ? r.payment.documentation.join(", ") : null,
      r.payment?.dollarRate ?? null,
      r.payment?.observations ?? null,
    ]),
  };
}
