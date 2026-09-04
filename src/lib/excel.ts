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
      "Ejemplo S.A.",
      "contacto@ejemplo.com",
      "+54 11 0000-0000",
      "20123456780",
      "Unipersonal",
      "Monotributo",
      "amount",
      0,
      45000,
      "Sí",
      "Sí",
      "Cliente de ejemplo",
      0,
      todayISO(),
      todayISO(),
    ];
  }
  if (sheet.name === "Libro mayor") {
    return [
      "EJEMPLO-1",
      todayISO(),
      "Ejemplo S.A.",
      "Honorario mes",
      "Cargo",
      45000,
      "Transferencia",
      "Banco Ejemplo",
      "Recibo",
      null,
      "Mes de ejemplo",
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

export async function downloadWorkbook(filename: string, sheets: Sheet[]) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cifra Multi";
  wb.created = new Date();

  const headerFill: import("exceljs").Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2D6A4F" },
  };
  const headerFont: Partial<import("exceljs").Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };

  for (const s of sheets) {
    const ws = wb.addWorksheet(sheetName(s.name));
    ws.columns = s.headers.map((h, i) => {
      const maxLen = s.rows.reduce((m, r) => {
        const v = r[i];
        const len = v != null ? String(v).length : 0;
        return Math.max(m, len);
      }, h.length);
      return { header: h, width: Math.min(Math.max(maxLen + 2, 14), 40) };
    });
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    headerRow.commit();
    for (const r of s.rows) {
      ws.addRow(r);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(prefix: string): string {
  return `${prefix}-${todayISO()}.xlsx`;
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
      ["Nombre / Razón social", "Nombre completo o razón social del cliente. Obligatorio.", "Ejemplo S.A."],
      ["Contacto", "Nombre de la persona de contacto.", "Juan Pérez"],
      ["Email", "Correo electrónico del cliente.", "contacto@ejemplo.com"],
      ["Teléfono", "Número de teléfono.", "+54 11 0000-0000"],
      ["CUIT", "11 dígitos sin guiones. Se formatea solo al importar.", "20123456780"],
      ["Tipo de empresa", "S.A., S.R.L., S.A.S., Unipersonal, Cooperativa, Otro.", "Unipersonal"],
      ["Condición frente al IVA", "Responsable Inscripto, Monotributo, Exento, Consumidor Final, No Responsable.", "Monotributo"],
      ["Tipo de honorario", "amount (monto fijo), modules (módulos CPCEBA), variable (sin cargo automático).", "amount"],
      ["Módulos por mes", "Si el tipo es modules, acá va la cantidad. Si es amount o variable, dejalo 0.", "0"],
      ["Monto mensual ($)", "Si el tipo es amount, acá va el importe fijo. Si es modules o variable, dejalo 0.", "40000"],
      ["¿Ganancias incluida?", "Sí si el honorario incluye el impuesto a las ganancias. No si se cobra aparte.", "Sí"],
      ["¿Cliente activo?", "Sí para clientes activos. No para inactivos.", "Sí"],
      ["Notas", "Texto libre. Opcional.", "Cliente de ejemplo"],
      ["Saldo (referencia)", "Saldo actual del cliente. Se ignora al importar.", "40000"],
      ["Creado", "Fecha de creación. Se ignora al importar.", "2026-08-25"],
      ["Actualizado", "Última modificación. Se ignora al importar.", "2026-08-25"],
      [],
      ["LIBRO MAYOR", "", ""],
      ["Fecha", "Fecha de la transacción. AAAA-MM-DD.", "2025-06-17"],
      ["Cliente", "Nombre del cliente. Debe coincidir con la hoja Clientes.", "Ejemplo S.A."],
      ["Concepto", "Descripción del movimiento. Obligatorio.", "Honorario mes"],
      ["Tipo (Cargo/Pago)", "Cargo o Pago. Obligatorio.", "Pago"],
      ["Monto ($)", "Importe numérico. Obligatorio.", "30000"],
      ["Medio de pago", "Efectivo, Transferencia, Cheque, Dólares.", "Efectivo"],
      ["Cuenta de acreditación", "Cuenta a la que llegó el dinero.", "Banco Ejemplo"],
      ["Documentación", "Recibo, Factura, etc. Pueden ir separados por coma.", "Recibo"],
      ["Cotización dólar", "Solo si el monto está en dólares. Si está en pesos, dejalo vacío.", ""],
      ["Observaciones", "Texto libre. Opcional.", ""],
    ],
  };
}
