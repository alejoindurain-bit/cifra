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

function estimateColumnWidth(header: string, rows: Array<Array<string | number | null>>, colIdx: number): number {
  let maxLen = header.length;
  for (const row of rows) {
    const val = row[colIdx];
    if (val != null) maxLen = Math.max(maxLen, String(val).length);
  }
  return Math.min(Math.max(maxLen * 8 + 50, 80), 300);
}

function buildExampleRow(sheet: Sheet): Array<string | number | null> {
  if (sheet.name === " Clientes" || sheet.name === "Clients") {
    return [
      "EJEMPLO-1",
      "Juan Pérez",
      "juan@ejemplo.com",
      "+54 11 1234-5678",
      "20370302678",
      "Unipersonal",
      "Monotributo",
      "amount",
      0,
      45000,
      "Sí",
      "Sí",
      "Cliente de prueba",
      0,
      todayISO(),
      todayISO(),
    ];
  }
  if (sheet.name === "Libro mayor") {
    return [
      "EJEMPLO-1",
      todayISO(),
      "Pérez Juan",
      "Honorario mes",
      "Cargo",
      45000,
      "Transferencia",
      "Banco Galicia",
      "Factura",
      null,
      "Primer mes",
    ];
  }
  return [];
}

function sheetXml(sheet: Sheet): string {
  const colWidths = sheet.headers
    .map(
      (_, i) =>
        `<Column ss:Index="${i + 1}" ss:Width="${estimateColumnWidth(sheet.headers[i], sheet.rows, i)}"/>`,
    )
    .join("");
  const header = `<Row>${sheet.headers
    .map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join("")}</Row>`;
  const exampleRow = buildExampleRow(sheet);
  const body = [exampleRow, ...sheet.rows]
    .map((row) => `<Row>${row.map(cellXml).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(sheetName(sheet.name))}"><Table>${colWidths}${header}${body}</Table></Worksheet>`;
}

export function downloadWorkbook(filename: string, sheets: Sheet[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="2D6A4F" ss:Pattern="Solid"/><Font ss:Color="FFFFFF"/></Style>
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
      "Nombre / Razón social",
      "Contacto",
      "Email",
      "Teléfono",
      "CUIT",
      "Tipo de empresa",
      "Condición frente al IVA",
      "Tipo de honorario",
      "Módulos por mes",
      "Monto mensual ($)",
      "¿Ganancias incluida?",
      "¿Cliente activo?",
      "Notas",
      "Saldo (referencia)",
      "Creado",
      "Actualizado",
    ],
    rows: rows.map((c) => [
      c.name,
      c.contact,
      c.email,
      c.phone,
      c.cuit,
      c.companyType,
      c.ivaCondition,
      clientFeeKind(c),
      c.monthlyModules,
      c.monthlyAmount,
      c.gananciasInMonthly ? "Sí" : "No",
      c.active ? "Sí" : "No",
      c.notes,
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
      "Fecha",
      "Cliente",
      "Concepto",
      "Tipo (Cargo/Pago)",
      "Monto ($)",
      "Medio de pago",
      "Cuenta de acreditación",
      "Documentación",
      "Cotización dólar",
      "Observaciones",
    ],
    rows: rows.map((r) => [
      r.id,
      r.date,
      r.clientName,
      r.concept,
      r.type === "charge" ? "Cargo" : "Pago",
      r.amount,
      r.payment?.paymentMethod ?? null,
      r.payment?.transferAccount ?? null,
      r.payment?.documentation.length ? r.payment.documentation.join(", ") : null,
      r.payment?.dollarRate ?? null,
      r.payment?.observations ?? null,
    ]),
  };
}

/**
 * Hoja de instrucciones que va al Excel de respaldo y a la plantilla vacía.
 */
export function instructionsSheet(): Sheet {
  return {
    name: "Instrucciones",
    headers: ["Columna", "Qué va acá", "Ejemplo"],
    rows: [
      ["Nombre / Razón social", "Nombre completo o razón social del cliente. Obligatorio.", "Alvarez Vanesa"],
      ["Contacto", "Nombre de la persona de contacto.", "Guido"],
      ["Email", "Correo electrónico del cliente.", "guido@example.com"],
      ["Teléfono", "Número de teléfono.", "+54 11 1234-5678"],
      ["CUIT", "11 dígitos sin guiones. Se formatea solo al importar.", "20370302678"],
      ["Tipo de empresa", "S.A., S.R.L., S.A.S., Unipersonal, Cooperativa, Otro.", "Unipersonal"],
      ["Condición frente al IVA", "Responsable Inscripto, Monotributo, Exento, Consumidor Final, No Responsable.", "Monotributo"],
      ["Tipo de honorario", "amount (monto fijo), modules (módulos CPCEBA), variable (sin cargo automático).", "amount"],
      ["Módulos por mes", "Si el tipo es modules, acá va la cantidad. Si es amount o variable, dejalo 0.", "0"],
      ["Monto mensual ($)", "Si el tipo es amount, acá va el importe fijo. Si es modules o variable, dejalo 0.", "40000"],
      ["¿Ganancias incluida?", "Sí si el honorario incluye el impuesto a las ganancias. No si se cobra aparte.", "Sí"],
      ["¿Cliente activo?", "Sí para clientes activos. No para inactivos.", "Sí"],
      ["Notas", "Texto libre. Opcional.", "Cliente nuevo"],
      ["Saldo (referencia)", "Saldo actual del cliente. Se ignora al importar.", "40000"],
      ["Creado", "Fecha de creación. Se ignora al importar.", "2026-08-25"],
      ["Actualizado", "Última modificación. Se ignora al importar.", "2026-08-25"],
      [],
      ["LIBRO MAYOR", "", ""],
      ["Fecha", "Fecha de la transacción. AAAA-MM-DD.", "2025-06-17"],
      ["Cliente", "Nombre del cliente. Debe coincidir con la hoja Clientes.", "Luchini Jeronimo"],
      ["Concepto", "Descripción del movimiento. Obligatorio.", "Pago a cuenta"],
      ["Tipo (Cargo/Pago)", "Cargo o Pago. Obligatorio.", "Pago"],
      ["Monto ($)", "Importe numérico. Obligatorio.", "30000"],
      ["Medio de pago", "Efectivo, Transferencia, Cheque, Dólares.", "Efectivo"],
      ["Cuenta de acreditación", "Cuenta a la que llegó el dinero.", "Cobra Mónica"],
      ["Documentación", "Recibo, Factura, Cobra Mónica. Pueden ir separados por coma.", "Cobra Mónica"],
      ["Cotización dólar", "Solo si el monto está en dólares. Si está en pesos, dejalo vacío.", ""],
      ["Observaciones", "Texto libre. Opcional.", ""],
    ],
  };
}
