import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const exportClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listClientsImpl } = await import("@/lib/server/clients");
    const owner = await requireOwner(context.userId);
    return listClientsImpl(owner.estudioId, { includeInactive: true });
  });

export const exportLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listAllLedgerImpl } = await import("@/lib/server/transactions");
    const owner = await requireOwner(context.userId);
    return listAllLedgerImpl(owner.estudioId);
  });

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const { listClientsImpl } = await import("@/lib/server/clients");
    const { listAllLedgerImpl } = await import("@/lib/server/transactions");
    const owner = await requireOwner(context.userId);
    const [clients, ledger] = await Promise.all([
      listClientsImpl(owner.estudioId, { includeInactive: true }),
      listAllLedgerImpl(owner.estudioId),
    ]);
    return { clients, ledger };
  });

export const previewImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ base64: z.string() }))
  .handler(async ({ context, data }) => {
    const ExcelJS = await import("exceljs");
    const { getSql } = await import("@/lib/db");
    const { requireOwner } = await import("@/lib/server/staff");
    const {
      foldName,
      cellStr,
      asDate,
    } = await import("@/lib/server/import-respaldo");

    const owner = await requireOwner(context.userId);
    const sql = await getSql();

    const existingClients = await sql<{ id: number; name: string }>`
      select id, name from clients where estudio_id = ${owner.estudioId}
    `;
    const byName = new Map<string, number>();
    for (const c of existingClients) {
      byName.set(foldName(c.name), c.id);
    }

    type ClientData = {
      name: string;
      contact: string | null;
      email: string | null;
      phone: string | null;
      cuit: string | null;
      companyType: string | null;
      ivaCondition: string | null;
      feeKind: string;
      monthlyModules: string;
      monthlyAmount: string;
      ganancias: string | null;
      active: string;
    };
    type TxData = {
      date: string;
      clientName: string;
      concept: string;
      type: "charge" | "payment";
      amount: number;
      medio: string | null;
      cuenta: string | null;
      documentacion: string;
      cotizacionDolar: string | null;
      observaciones: string | null;
    };

    const clients: Array<{
      row: number;
      name: string;
      status: "new" | "exists";
      existingId?: number;
      data: ClientData;
    }> = [];
    const transactions: Array<{
      row: number;
      date: string;
      clientName: string;
      concept: string;
      amount: number;
      type: "charge" | "payment";
      status: "ok" | "client_missing";
      data: TxData;
    }> = [];
    const errors: Array<{ sheet: string; row: number; reason: string }> = [];

    const buffer = Buffer.from(data.base64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const findSheet = (name: string) => {
      const norm = foldName(name);
      return wb.worksheets.find((w) => foldName(w.name) === norm);
    };

    const clientWs = findSheet("Clientes");
    if (clientWs) {
      const headerMap = buildXlsxHeaderMap(clientWs);
      for (let i = 2; i <= clientWs.rowCount; i += 1) {
        const r = clientWs.getRow(i);
        const name = cellStr(getXlsxCell(r, headerMap, "nombre")) ||
                     cellStr(getXlsxCell(r, headerMap, "Nombre / Razón social"));
        if (!name) {
          if (rowHasAnyValue(r)) {
            errors.push({ sheet: "Clientes", row: i, reason: "sin nombre" });
          }
          continue;
        }
        const key = foldName(name);
        const existingId = byName.get(key);
        clients.push({
          row: i,
          name,
          status: existingId ? "exists" : "new",
          existingId,
          data: {
            name,
            contact: cellStr(getXlsxCell(r, headerMap, "contacto")) ||
                     cellStr(getXlsxCell(r, headerMap, "Contacto")) || null,
            email: cellStr(getXlsxCell(r, headerMap, "email")) ||
                   cellStr(getXlsxCell(r, headerMap, "Email")) || null,
            phone: cellStr(getXlsxCell(r, headerMap, "telefono")) ||
                   cellStr(getXlsxCell(r, headerMap, "Teléfono")) || null,
            cuit: cellStr(getXlsxCell(r, headerMap, "cuit")) ||
                  cellStr(getXlsxCell(r, headerMap, "CUIT")) || null,
            companyType: cellStr(getXlsxCell(r, headerMap, "tipo_sociedad")) ||
                        cellStr(getXlsxCell(r, headerMap, "Tipo de empresa")) || null,
            ivaCondition: cellStr(getXlsxCell(r, headerMap, "iva")) ||
                          cellStr(getXlsxCell(r, headerMap, "Condición frente al IVA")) || null,
            feeKind: cellStr(getXlsxCell(r, headerMap, "honorario_tipo")) ||
                     cellStr(getXlsxCell(r, headerMap, "Tipo de honorario")) || "variable",
            monthlyModules: cellStr(getXlsxCell(r, headerMap, "modulos_mensuales")) ||
                           cellStr(getXlsxCell(r, headerMap, "Módulos por mes")) || "0",
            monthlyAmount: cellStr(getXlsxCell(r, headerMap, "monto_mensual")) ||
                          cellStr(getXlsxCell(r, headerMap, "Monto mensual ($)")) || "0",
            ganancias: cellStr(getXlsxCell(r, headerMap, "ganancias")) ||
                       cellStr(getXlsxCell(r, headerMap, "¿Ganancias incluida?")) || null,
            active: cellStr(getXlsxCell(r, headerMap, "activo")) ||
                    cellStr(getXlsxCell(r, headerMap, "¿Cliente activo?")) || "Sí",
          },
        });
      }
    }

    const ledgerWs = findSheet("Libro mayor");
    if (ledgerWs) {
      const headerMap = buildXlsxHeaderMap(ledgerWs);
      for (let i = 2; i <= ledgerWs.rowCount; i += 1) {
        const r = ledgerWs.getRow(i);
        const date = asDate(cellStr(getXlsxCell(r, headerMap, "fecha")) ||
                            cellStr(getXlsxCell(r, headerMap, "Fecha")));
        const clientName = cellStr(getXlsxCell(r, headerMap, "cliente")) ||
                           cellStr(getXlsxCell(r, headerMap, "Cliente"));
        const concept = cellStr(getXlsxCell(r, headerMap, "concepto")) ||
                        cellStr(getXlsxCell(r, headerMap, "Concepto"));
        const tipoLabel = cellStr(getXlsxCell(r, headerMap, "tipo")) ||
                          cellStr(getXlsxCell(r, headerMap, "Tipo (Cargo/Pago)"));
        const amountStr = cellStr(getXlsxCell(r, headerMap, "monto")) ||
                          cellStr(getXlsxCell(r, headerMap, "Monto ($)"));
        const amount = Number(String(amountStr).replace(",", "."));

        if (!date || !clientName || !concept || !tipoLabel) {
          if (rowHasAnyValue(r)) {
            errors.push({ sheet: "Libro mayor", row: i, reason: "datos incompletos" });
          }
          continue;
        }

        const type: "charge" | "payment" | null =
          tipoLabel === "Cargo" ? "charge" :
          tipoLabel === "Pago" ? "payment" : null;
        if (!type) {
          errors.push({ sheet: "Libro mayor", row: i, reason: `tipo desconocido: ${tipoLabel}` });
          continue;
        }

        const key = foldName(clientName);
        const clientId = byName.get(key);
        transactions.push({
          row: i,
          date,
          clientName,
          concept,
          amount: Number.isFinite(amount) ? amount : 0,
          type,
          status: clientId ? "ok" : "client_missing",
          data: {
            date,
            clientName,
            concept,
            type,
            amount,
            medio: cellStr(getXlsxCell(r, headerMap, "medio_pago")) ||
                   cellStr(getXlsxCell(r, headerMap, "Medio de pago")) || null,
            cuenta: cellStr(getXlsxCell(r, headerMap, "cuenta_acreditacion")) ||
                    cellStr(getXlsxCell(r, headerMap, "Cuenta de acreditación")) || null,
            documentacion: cellStr(getXlsxCell(r, headerMap, "documentacion")) ||
                           cellStr(getXlsxCell(r, headerMap, "Documentación")) || "",
            cotizacionDolar: cellStr(getXlsxCell(r, headerMap, "cotizacion_dolar")) ||
                            cellStr(getXlsxCell(r, headerMap, "Cotización dólar")) || null,
            observaciones: cellStr(getXlsxCell(r, headerMap, "observaciones")) ||
                           cellStr(getXlsxCell(r, headerMap, "Observaciones")) || null,
          },
        });
      }
    }

    return { clients, transactions, errors };
  });

export const commitImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    base64: z.string(),
    clientDecisions: z.record(z.string(), z.enum(["update", "skip"])),
    txDecisions: z.record(z.string(), z.enum(["create", "skip"])),
  }))
  .handler(async ({ context, data }) => {
    const ExcelJS = await import("exceljs");
    const { requireOwner } = await import("@/lib/server/staff");
    const {
      foldName,
      cellStr,
      cellNum,
      asDate,
      formatCuit,
      parseDocs,
    } = await import("@/lib/server/import-respaldo");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const owner = await requireOwner(context.userId);
    const estudioId = owner.estudioId;

    const existingClients = await sql<{ id: number; name: string }>`
      select id, name from clients where estudio_id = ${estudioId}
    `;
    const byName = new Map<string, number>();
    for (const c of existingClients) byName.set(foldName(c.name), c.id);

    let clientsInserted = 0;
    let clientsUpdated = 0;
    let clientsSkipped = 0;
    let transactionsInserted = 0;
    let transactionsSkipped = 0;
    const errors: Array<{ sheet: string; row: number; reason: string }> = [];

    const buffer = Buffer.from(data.base64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const findSheet = (name: string) => {
      const norm = foldName(name);
      return wb.worksheets.find((w) => foldName(w.name) === norm);
    };

    const clientWs = findSheet("Clientes");
    if (clientWs) {
      const headerMap = buildXlsxHeaderMap(clientWs);
      for (let i = 2; i <= clientWs.rowCount; i += 1) {
        const r = clientWs.getRow(i);
        const rowNum = i;
        const name = cellStr(getXlsxCell(r, headerMap, "nombre")) ||
                     cellStr(getXlsxCell(r, headerMap, "Nombre / Razón social"));
        if (!name) continue;

        const key = foldName(name);
        const existingId = byName.get(key);
        const rawDecision = data.clientDecisions[String(rowNum)] ?? (existingId ? "skip" : "update");
        const decision = rawDecision === "update" ? "update" : "skip";

        if (decision === "skip") {
          clientsSkipped += 1;
          continue;
        }

        const feeKindRaw = cellStr(getXlsxCell(r, headerMap, "honorario_tipo")) ||
                           cellStr(getXlsxCell(r, headerMap, "Tipo de honorario"));
        let feeKind = feeKindRaw;
        if (feeKindRaw === "amount" || feeKindRaw === "monto fijo") feeKind = "amount";
        else if (feeKindRaw === "modules" || feeKindRaw === "módulos cpceba") feeKind = "modules";
        else if (feeKindRaw === "variable" || feeKindRaw === "sin cargo automático") feeKind = "variable";

        const fixedFee = feeKind === "modules" || feeKind === "amount";
        const modules = feeKind === "modules"
          ? (cellNum(getXlsxCell(r, headerMap, "modulos_mensuales")) ??
             cellNum(getXlsxCell(r, headerMap, "Módulos por mes")) ?? 0)
          : 0;
        const amount = feeKind === "amount"
          ? (cellNum(getXlsxCell(r, headerMap, "monto_mensual")) ??
             cellNum(getXlsxCell(r, headerMap, "Monto mensual ($)")) ?? 0)
          : 0;
        const gananciasRaw = cellStr(getXlsxCell(r, headerMap, "ganancias")) ??
                             cellStr(getXlsxCell(r, headerMap, "¿Ganancias incluida?"));
        const gananciasInMonthly = gananciasRaw === "En mensual" || gananciasRaw === "Sí";
        const activeRaw = cellStr(getXlsxCell(r, headerMap, "activo")) ??
                          cellStr(getXlsxCell(r, headerMap, "¿Cliente activo?"));
        const active = activeRaw !== "No" && activeRaw !== "no";

        try {
          if (existingId && decision === "update") {
            await sql`
              update clients set
                contact = ${cellStr(getXlsxCell(r, headerMap, "contacto")) ?? cellStr(getXlsxCell(r, headerMap, "Contacto"))},
                company_type = ${cellStr(getXlsxCell(r, headerMap, "tipo_sociedad")) ?? cellStr(getXlsxCell(r, headerMap, "Tipo de empresa"))},
                iva_condition = ${cellStr(getXlsxCell(r, headerMap, "iva")) ?? cellStr(getXlsxCell(r, headerMap, "Condición frente al IVA"))},
                fixed_fee = ${fixedFee},
                monthly_modules = ${modules},
                monthly_amount = ${amount},
                ganancias_in_monthly = ${gananciasInMonthly},
                active = ${active},
                updated_at = now()
              where id = ${existingId} and estudio_id = ${estudioId}
            `;
            clientsUpdated += 1;
          } else if (!existingId) {
            const inserted = await sql<{ id: number }>`
              insert into clients (
                estudio_id, name, contact, cuit, company_type, iva_condition,
                fixed_fee, monthly_modules, monthly_amount, ganancias_in_monthly, active
              ) values (
                ${estudioId}, ${name},
                ${cellStr(getXlsxCell(r, headerMap, "contacto")) ?? cellStr(getXlsxCell(r, headerMap, "Contacto"))},
                ${formatCuit(cellStr(getXlsxCell(r, headerMap, "cuit")) ?? cellStr(getXlsxCell(r, headerMap, "CUIT")))},
                ${cellStr(getXlsxCell(r, headerMap, "tipo_sociedad")) ?? cellStr(getXlsxCell(r, headerMap, "Tipo de empresa"))},
                ${cellStr(getXlsxCell(r, headerMap, "iva")) ?? cellStr(getXlsxCell(r, headerMap, "Condición frente al IVA"))},
                ${fixedFee}, ${modules}, ${amount}, ${gananciasInMonthly}, ${active}
              )
              returning id
            `;
            byName.set(key, inserted[0].id);
            clientsInserted += 1;
          }
        } catch (err) {
          errors.push({
            sheet: "Clientes",
            row: rowNum,
            reason: err instanceof Error ? err.message : "error",
          });
        }
      }
    }

    const ledgerWs = findSheet("Libro mayor");
    if (ledgerWs) {
      const headerMap = buildXlsxHeaderMap(ledgerWs);
      for (let i = 2; i <= ledgerWs.rowCount; i += 1) {
        const r = ledgerWs.getRow(i);
        const rowNum = i;
        const date = asDate(cellStr(getXlsxCell(r, headerMap, "fecha")) ??
                            cellStr(getXlsxCell(r, headerMap, "Fecha")));
        const clientName = cellStr(getXlsxCell(r, headerMap, "cliente")) ??
                           cellStr(getXlsxCell(r, headerMap, "Cliente"));
        const concept = cellStr(getXlsxCell(r, headerMap, "concepto")) ??
                        cellStr(getXlsxCell(r, headerMap, "Concepto"));
        const tipoLabel = cellStr(getXlsxCell(r, headerMap, "tipo")) ??
                          cellStr(getXlsxCell(r, headerMap, "Tipo (Cargo/Pago)"));
        const amount = cellNum(getXlsxCell(r, headerMap, "monto")) ??
                       cellNum(getXlsxCell(r, headerMap, "Monto ($)"));
        const medio = cellStr(getXlsxCell(r, headerMap, "medio_pago")) ??
                      cellStr(getXlsxCell(r, headerMap, "Medio de pago"));
        const cuenta = (cellStr(getXlsxCell(r, headerMap, "cuenta_acreditacion")) ??
                       cellStr(getXlsxCell(r, headerMap, "Cuenta de acreditación"))) || null;
        const docs = parseDocs(
          cellStr(getXlsxCell(r, headerMap, "documentacion")) ??
          cellStr(getXlsxCell(r, headerMap, "Documentación")) ?? "",
        );
        const dollarRate = cellNum(getXlsxCell(r, headerMap, "cotizacion_dolar")) ??
                           cellNum(getXlsxCell(r, headerMap, "Cotización dólar"));
        const observations = (cellStr(getXlsxCell(r, headerMap, "observaciones")) ??
                             cellStr(getXlsxCell(r, headerMap, "Observaciones"))) || null;

        const type = tipoLabel === "Cargo" ? "charge" :
                     tipoLabel === "Pago" ? "payment" : null;
        if (!date || !clientName || !concept || !type || amount == null || amount <= 0) {
          transactionsSkipped += 1;
          continue;
        }

        const rawDecision = data.txDecisions[String(rowNum)] ?? "create";
        const decision = rawDecision === "skip" ? "skip" : "create";
        if (decision === "skip") {
          transactionsSkipped += 1;
          continue;
        }

        const clientId = byName.get(foldName(clientName));
        if (!clientId) {
          errors.push({
            sheet: "Libro mayor",
            row: rowNum,
            reason: `cliente no encontrado: ${clientName}`,
          });
          continue;
        }

        try {
          const existing = await sql<{ id: number }>`
            select id from transactions
            where client_id = ${clientId}
              and date = ${date}
              and concept = ${concept}
              and type = ${type}
              and amount = ${amount}
              and estudio_id = ${estudioId}
            limit 1
          `;
          if (existing.length > 0) {
            transactionsSkipped += 1;
            continue;
          }

          const tx = await sql<{ id: number }>`
            insert into transactions (
              estudio_id, client_id, date, concept, type, amount, created_by
            ) values (
              ${estudioId}, ${clientId}, ${date}, ${concept}, ${type}, ${amount},
              ${"importacion"}
            )
            returning id
          `;
          if (type === "payment" || medio) {
            await sql`
              insert into payment_details (
                estudio_id, transaction_id, documentation, payment_method,
                dollar_rate, observations, transfer_account
              ) values (
                ${estudioId}, ${tx[0].id}, ${JSON.stringify(docs)},
                ${medio || "Efectivo"}, ${dollarRate}, ${observations}, ${cuenta}
              )
            `;
          }
          transactionsInserted += 1;
        } catch (err) {
          errors.push({
            sheet: "Libro mayor",
            row: rowNum,
            reason: err instanceof Error ? err.message : "error",
          });
        }
      }
    }

    return {
      clientsInserted,
      clientsUpdated,
      clientsSkipped,
      transactionsInserted,
      transactionsSkipped,
      errors,
    };
  });

export const downloadTemplate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const ExcelJS = await import("exceljs");
    const { instructionsSheet, clientsSheet, ledgerSheet } = await import("@/lib/excel");
    const sheets = [clientsSheet([]), ledgerSheet([]), instructionsSheet()];

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
      const ws = wb.addWorksheet(s.name.slice(0, 31).replace(/[:\\/?*\[\]]/g, " "));
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
    const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
    return {
      filename: "cifra-plantilla-importar.xlsx",
      base64,
    };
  });

function parseXmlRows(tableXml: string): Array<Array<string | number | null>> {
  // Legacy SpreadsheetML parser kept for backward compatibility with any
  // older code paths that still pass an XML string. New code uses ExcelJS
  // and the buildXlsxHeaderMap / getXlsxCell helpers below.
  const rows: Array<Array<string | number | null>> = [];
  const rowRe = /<Row>([\s\S]*?)<\/Row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableXml))) {
    const cells: Array<string | number | null> = [];
    let pos = 1;
    const chunk = rowMatch[1];
    const cellRe = /<Cell(?<attrs>[^>]*?)\/>(?:[^<]*<[^>]+>[^<]*)*?|<Cell(?<attrs2>[^>]*)>(?<body>[\s\S]*?)<\/Cell>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(chunk))) {
      const attrs = cellMatch.groups?.attrs || cellMatch.groups?.attrs2 || "";
      const inner = cellMatch.groups?.body || "";
      const idxMatch = attrs.match(/ss:Index="(\d+)"/);
      if (idxMatch) {
        const n = Number(idxMatch[1]);
        while (pos < n) {
          cells.push(null);
          pos += 1;
        }
      }
      const data = inner.match(/<Data ss:Type="([^"]+)">([\s\S]*?)<\/Data>/);
      if (data) {
        const v = data[2]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"');
        if (data[1] === "Number") {
          const num = Number(v);
          cells.push(Number.isFinite(num) ? num : v);
        } else {
          cells.push(v);
        }
      } else {
        cells.push(null);
      }
      pos += 1;
    }
    rows.push(cells);
  }
  return rows;
}

// ExcelJS helpers: a worksheet's getCell(n) is 1-indexed. The header row
// sits in row 1, data starts at row 2. The header map is a normalized
// "column-name → 1-indexed column number" lookup so we can resolve headers
// in either snake_case (legacy) or Spanish (current format).

type ExcelWS = {
  getRow: (n: number) => {
    getCell: (n: number) => { value: unknown };
  };
  rowCount: number;
};

function buildXlsxHeaderMap(ws: ExcelWS): Map<string, number> {
  const map = new Map<string, number>();
  const row = ws.getRow(1);
  let col = 1;
  while (true) {
    const cell = row.getCell(col);
    const v = cell.value;
    if (v == null) break;
    const text = typeof v === "object" && v && "text" in v
      ? String((v as { text: unknown }).text)
      : String(v);
    if (text) map.set(text.trim().toLowerCase(), col);
    col += 1;
    if (col > 50) break;
  }
  return map;
}

function getXlsxCell(
  row: { getCell: (n: number) => { value: unknown } },
  headerMap: Map<string, number>,
  headerName: string,
): string | number | null | undefined {
  const col = headerMap.get(headerName.toLowerCase());
  if (col == null) return undefined;
  const cell = row.getCell(col);
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "object" && v && "result" in v) {
    const result = (v as { result: unknown }).result;
    return result == null ? null : typeof result === "object" ? String(result) : (result as string | number);
  }
  if (typeof v === "object" && v && "text" in v) {
    return String((v as { text: unknown }).text);
  }
  if (typeof v === "number") return v;
  return typeof v === "string" ? v : String(v);
}

function rowHasAnyValue(row: { getCell: (n: number) => { value: unknown } }): boolean {
  for (let c = 1; c <= 12; c += 1) {
    const v = row.getCell(c).value;
    if (v != null && v !== "") return true;
  }
  return false;
}
