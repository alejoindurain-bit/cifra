import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sheetName(raw: string): string {
  return raw.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31) || "Hoja";
}

function cellXml(value: string | number | null): string {
  if (value == null || value === "") return "<Cell/>";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell ss:StyleID="num"><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

function buildSheetXml(sheet: { name: string; headers: string[]; rows: Array<Array<string | number | null>> }): string {
  const colWidths = sheet.headers.map((h, i) => {
    const maxLen = Math.max(h.length, 15);
    const width = Math.min(Math.max(maxLen * 9 + 50, 90), 350);
    return `<Column ss:Index="${i + 1}" ss:Width="${width}"/>`;
  }).join("");
  const header = `<Row>${sheet.headers.map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join("")}</Row>`;
  const body = sheet.rows.map((row) => `<Row>${row.map(cellXml).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${xmlEscape(sheetName(sheet.name))}"><Table>${colWidths}${header}${body}</Table></Worksheet>`;
}

function buildWorkbookXml(sheets: Array<{ name: string; headers: string[]; rows: Array<Array<string | number | null>> }>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Default" ss:Name="Normal">
  <Font ss:FontName="Calibri" ss:Size="11"/>
</Style>
<Style ss:ID="hdr">
  <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
  <Interior ss:Color="#2D6A4F" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="num">
  <Font ss:FontName="Calibri" ss:Size="11"/>
  <NumberFormat ss:Format="#,##0.00"/>
</Style>
</Styles>
${sheets.map(buildSheetXml).join("\n")}
</Workbook>`;
}

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
  .validator(z.object({ xml: z.string() }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireOwner } = await import("@/lib/server/staff");
    const {
      foldName,
      buildHeaderMap,
      getCellByHeader,
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

    const clientSheetMatch = data.xml.match(
      /<Worksheet ss:Name="Clientes"><Table>([\s\S]*?)<\/Table><\/Worksheet>/,
    );
    if (clientSheetMatch) {
      const rows = parseXmlRows(clientSheetMatch[1]);
      if (rows.length > 0) {
        const headerMap = buildHeaderMap(rows[0] || []);
        for (let i = 1; i < rows.length; i += 1) {
          const r = rows[i];
          const name = cellStr(getCellByHeader(r, headerMap, "nombre")) ||
                       cellStr(getCellByHeader(r, headerMap, "Nombre / Razón social"));
          if (!name) {
            errors.push({ sheet: "Clientes", row: i + 1, reason: "sin nombre" });
            continue;
          }
          const key = foldName(name);
          const existingId = byName.get(key);
          clients.push({
            row: i + 1,
            name,
            status: existingId ? "exists" : "new",
            existingId,
            data: {
              name,
              contact: cellStr(getCellByHeader(r, headerMap, "contacto")) ||
                       cellStr(getCellByHeader(r, headerMap, "Contacto")) || null,
              email: cellStr(getCellByHeader(r, headerMap, "email")) ||
                     cellStr(getCellByHeader(r, headerMap, "Email")) || null,
              phone: cellStr(getCellByHeader(r, headerMap, "telefono")) ||
                     cellStr(getCellByHeader(r, headerMap, "Teléfono")) || null,
              cuit: cellStr(getCellByHeader(r, headerMap, "cuit")) ||
                    cellStr(getCellByHeader(r, headerMap, "CUIT")) || null,
              companyType: cellStr(getCellByHeader(r, headerMap, "tipo_sociedad")) ||
                          cellStr(getCellByHeader(r, headerMap, "Tipo de empresa")) || null,
              ivaCondition: cellStr(getCellByHeader(r, headerMap, "iva")) ||
                          cellStr(getCellByHeader(r, headerMap, "Condición frente al IVA")) || null,
              feeKind: cellStr(getCellByHeader(r, headerMap, "honorario_tipo")) ||
                       cellStr(getCellByHeader(r, headerMap, "Tipo de honorario")) || "variable",
              monthlyModules: cellStr(getCellByHeader(r, headerMap, "modulos_mensuales")) ||
                             cellStr(getCellByHeader(r, headerMap, "Módulos por mes")) || "0",
              monthlyAmount: cellStr(getCellByHeader(r, headerMap, "monto_mensual")) ||
                            cellStr(getCellByHeader(r, headerMap, "Monto mensual ($)")) || "0",
              ganancias: cellStr(getCellByHeader(r, headerMap, "ganancias")) ||
                         cellStr(getCellByHeader(r, headerMap, "¿Ganancias incluida?")) || null,
              active: cellStr(getCellByHeader(r, headerMap, "activo")) ||
                      cellStr(getCellByHeader(r, headerMap, "¿Cliente activo?")) || "Sí",
            },
          });
        }
      }
    }

    const ledgerSheetMatch = data.xml.match(
      /<Worksheet ss:Name="Libro mayor"><Table>([\s\S]*?)<\/Table><\/Worksheet>/,
    );
    if (ledgerSheetMatch) {
      const rows = parseXmlRows(ledgerSheetMatch[1]);
      if (rows.length > 0) {
        const headerMap = buildHeaderMap(rows[0] || []);
        for (let i = 1; i < rows.length; i += 1) {
          const r = rows[i];
          const date = asDate(cellStr(getCellByHeader(r, headerMap, "fecha")) ||
                              cellStr(getCellByHeader(r, headerMap, "Fecha")));
          const clientName = cellStr(getCellByHeader(r, headerMap, "cliente")) ||
                             cellStr(getCellByHeader(r, headerMap, "Cliente"));
          const concept = cellStr(getCellByHeader(r, headerMap, "concepto")) ||
                          cellStr(getCellByHeader(r, headerMap, "Concepto"));
          const tipoLabel = cellStr(getCellByHeader(r, headerMap, "tipo")) ||
                            cellStr(getCellByHeader(r, headerMap, "Tipo (Cargo/Pago)"));
          const amountStr = cellStr(getCellByHeader(r, headerMap, "monto")) ||
                            cellStr(getCellByHeader(r, headerMap, "Monto ($)"));
          const amount = Number(amountStr.replace(",", "."));

          if (!date || !clientName || !concept || !tipoLabel) {
            errors.push({ sheet: "Libro mayor", row: i + 1, reason: "datos incompletos" });
            continue;
          }

          const type: "charge" | "payment" | null =
            tipoLabel === "Cargo" ? "charge" :
            tipoLabel === "Pago" ? "payment" : null;
          if (!type) {
            errors.push({ sheet: "Libro mayor", row: i + 1, reason: `tipo desconocido: ${tipoLabel}` });
            continue;
          }

          const key = foldName(clientName);
          const clientId = byName.get(key);
          transactions.push({
            row: i + 1,
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
              medio: cellStr(getCellByHeader(r, headerMap, "medio_pago")) ||
                     cellStr(getCellByHeader(r, headerMap, "Medio de pago")) || null,
              cuenta: cellStr(getCellByHeader(r, headerMap, "cuenta_acreditacion")) ||
                      cellStr(getCellByHeader(r, headerMap, "Cuenta de acreditación")) || null,
              documentacion: cellStr(getCellByHeader(r, headerMap, "documentacion")) ||
                             cellStr(getCellByHeader(r, headerMap, "Documentación")) || "",
              cotizacionDolar: cellStr(getCellByHeader(r, headerMap, "cotizacion_dolar")) ||
                              cellStr(getCellByHeader(r, headerMap, "Cotización dólar")) || null,
              observaciones: cellStr(getCellByHeader(r, headerMap, "observaciones")) ||
                             cellStr(getCellByHeader(r, headerMap, "Observaciones")) || null,
            },
          });
        }
      }
    }

    return { clients, transactions, errors };
  });

export const commitImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    xml: z.string(),
    clientDecisions: z.record(z.string(), z.enum(["update", "skip"])),
    txDecisions: z.record(z.string(), z.enum(["create", "skip"])),
  }))
  .handler(async ({ context, data }) => {
    const { requireOwner } = await import("@/lib/server/staff");
    const {
      foldName,
      buildHeaderMap,
      getCellByHeader,
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
    const errors: Array<{ sheet: string; row: number; reason: string }> = [];

    const clientSheetMatch = data.xml.match(
      /<Worksheet ss:Name="Clientes"><Table>([\s\S]*?)<\/Table><\/Worksheet>/,
    );
    if (clientSheetMatch) {
      const rows = parseXmlRows(clientSheetMatch[1]);
      if (rows.length > 0) {
        const headerMap = buildHeaderMap(rows[0] || []);
        for (let i = 1; i < rows.length; i += 1) {
          const r = rows[i];
          const rowNum = i + 1;
          const name = cellStr(getCellByHeader(r, headerMap, "nombre")) ||
                       cellStr(getCellByHeader(r, headerMap, "Nombre / Razón social"));
          if (!name) continue;

          const key = foldName(name);
          const existingId = byName.get(key);
          const rawDecision = data.clientDecisions[String(rowNum)] ?? (existingId ? "skip" : "update");
          const decision = rawDecision === "update" ? "update" : "skip";

          if (decision === "skip") {
            clientsSkipped += 1;
            continue;
          }

          const feeKindRaw = cellStr(getCellByHeader(r, headerMap, "honorario_tipo")) ||
                             cellStr(getCellByHeader(r, headerMap, "Tipo de honorario"));
          let feeKind = feeKindRaw;
          if (feeKindRaw === "amount" || feeKindRaw === "monto fijo") feeKind = "amount";
          else if (feeKindRaw === "modules" || feeKindRaw === "módulos cpceba") feeKind = "modules";
          else if (feeKindRaw === "variable" || feeKindRaw === "sin cargo automático") feeKind = "variable";

          const fixedFee = feeKind === "modules" || feeKind === "amount";
          const modules = feeKind === "modules"
            ? (cellNum(getCellByHeader(r, headerMap, "modulos_mensuales")) ??
               cellNum(getCellByHeader(r, headerMap, "Módulos por mes")) ?? 0)
            : 0;
          const amount = feeKind === "amount"
            ? (cellNum(getCellByHeader(r, headerMap, "monto_mensual")) ??
               cellNum(getCellByHeader(r, headerMap, "Monto mensual ($)")) ?? 0)
            : 0;
          const gananciasRaw = cellStr(getCellByHeader(r, headerMap, "ganancias")) ??
                               cellStr(getCellByHeader(r, headerMap, "¿Ganancias incluida?"));
          const gananciasInMonthly = gananciasRaw === "En mensual" || gananciasRaw === "Sí";
          const activeRaw = cellStr(getCellByHeader(r, headerMap, "activo")) ??
                            cellStr(getCellByHeader(r, headerMap, "¿Cliente activo?"));
          const active = activeRaw !== "No" && activeRaw !== "no";

          try {
            if (existingId && decision === "update") {
              await sql`
                update clients set
                  contact = ${cellStr(getCellByHeader(r, headerMap, "contacto")) ?? cellStr(getCellByHeader(r, headerMap, "Contacto"))},
                  company_type = ${cellStr(getCellByHeader(r, headerMap, "tipo_sociedad")) ?? cellStr(getCellByHeader(r, headerMap, "Tipo de empresa"))},
                  iva_condition = ${cellStr(getCellByHeader(r, headerMap, "iva")) ?? cellStr(getCellByHeader(r, headerMap, "Condición frente al IVA"))},
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
                  ${cellStr(getCellByHeader(r, headerMap, "contacto")) ?? cellStr(getCellByHeader(r, headerMap, "Contacto"))},
                  ${formatCuit(cellStr(getCellByHeader(r, headerMap, "cuit")) ?? cellStr(getCellByHeader(r, headerMap, "CUIT")))},
                  ${cellStr(getCellByHeader(r, headerMap, "tipo_sociedad")) ?? cellStr(getCellByHeader(r, headerMap, "Tipo de empresa"))},
                  ${cellStr(getCellByHeader(r, headerMap, "iva")) ?? cellStr(getCellByHeader(r, headerMap, "Condición frente al IVA"))},
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
    }

    const ledgerSheetMatch = data.xml.match(
      /<Worksheet ss:Name="Libro mayor"><Table>([\s\S]*?)<\/Table><\/Worksheet>/,
    );
    let transactionsInserted = 0;
    let transactionsSkipped = 0;
    if (ledgerSheetMatch) {
      const rows = parseXmlRows(ledgerSheetMatch[1]);
      if (rows.length > 0) {
        const headerMap = buildHeaderMap(rows[0] || []);
        for (let i = 1; i < rows.length; i += 1) {
          const r = rows[i];
          const rowNum = i + 1;
          const date = asDate(cellStr(getCellByHeader(r, headerMap, "fecha")) ??
                              cellStr(getCellByHeader(r, headerMap, "Fecha")));
          const clientName = cellStr(getCellByHeader(r, headerMap, "cliente")) ??
                             cellStr(getCellByHeader(r, headerMap, "Cliente"));
          const concept = cellStr(getCellByHeader(r, headerMap, "concepto")) ??
                          cellStr(getCellByHeader(r, headerMap, "Concepto"));
          const tipoLabel = cellStr(getCellByHeader(r, headerMap, "tipo")) ??
                            cellStr(getCellByHeader(r, headerMap, "Tipo (Cargo/Pago)"));
          const amount = cellNum(getCellByHeader(r, headerMap, "monto")) ??
                         cellNum(getCellByHeader(r, headerMap, "Monto ($)"));
          const medio = cellStr(getCellByHeader(r, headerMap, "medio_pago")) ??
                        cellStr(getCellByHeader(r, headerMap, "Medio de pago"));
          const cuenta = (cellStr(getCellByHeader(r, headerMap, "cuenta_acreditacion")) ??
                         cellStr(getCellByHeader(r, headerMap, "Cuenta de acreditación"))) || null;
          const docs = parseDocs(
            cellStr(getCellByHeader(r, headerMap, "documentacion")) ??
            cellStr(getCellByHeader(r, headerMap, "Documentación")) ?? "",
          );
          const dollarRate = cellNum(getCellByHeader(r, headerMap, "cotizacion_dolar")) ??
                             cellNum(getCellByHeader(r, headerMap, "Cotización dólar"));
          const observations = (cellStr(getCellByHeader(r, headerMap, "observaciones")) ??
                               cellStr(getCellByHeader(r, headerMap, "Observaciones"))) || null;

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
    const { instructionsSheet, clientsSheet, ledgerSheet } = await import("@/lib/excel");
    const sheets = [
      clientsSheet([]),
      ledgerSheet([]),
      instructionsSheet(),
    ];
    const xml = buildWorkbookXml(sheets);
    return {
      filename: "cifra-plantilla-importar.xls",
      xml: "﻿" + xml,
    };
  });

function parseXmlRows(tableXml: string): Array<Array<string | number | null>> {
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
