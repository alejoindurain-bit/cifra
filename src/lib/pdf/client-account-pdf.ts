import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClientAccount } from "@/lib/fn/types";
import { APP_NAME } from "@/lib/constants";
import type { EstudioInfo } from "@/lib/fn/types";

interface PdfOptions {
  account: ClientAccount;
  estudio: EstudioInfo | null;
  money: {
    formatARS: (n: number) => string;
    maskName: (n: string) => string;
    maskCuit: (c: string, fallback?: string) => string;
  };
  // Logo del estudio ya cargado como data URL (image/png, image/jpeg) o
  // null si no hay. El caller debe resolverlo: jsPDF no puede fetchear URLs
  // por sí mismo en el browser.
  logoDataUrl?: string | null;
}

export function generateClientAccountPdf({ account, estudio, money, logoDataUrl }: PdfOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Colores del estudio o默认值
  const primaryColor = estudio?.accentColor ?? "#2a4a3c";
  const r = parseInt(primaryColor.slice(1, 3), 16);
  const g = parseInt(primaryColor.slice(3, 5), 16);
  const b = parseInt(primaryColor.slice(5, 7), 16);

  const estudioNombre = estudio?.displayName ?? APP_NAME;

  // ── Header ────────────────────────────────────────────────────────────────
  // Barra de color arriba
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Nombre del estudio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(estudioNombre, margin, 5.5);

  // Título de la cuenta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255, 0.8);
  doc.text("Cuenta Corriente", pageWidth - margin, 5.5, { align: "right" });

  let y = 18;

  // ── Datos del estudio (domicilio, CUIT, contacto, logo) ────────────────
  // Si el estudio tiene metadata cargada, la mostramos como una "ficha" a la
  // derecha de la primera página: logo arriba, debajo domicilio + contacto.
  // Si no hay metadata, no se dibuja nada (no agrega ruido al PDF).
  const meta = estudio?.metadata ?? null;
  const d = meta?.domicilio ?? null;
  const hasDomicilio = Boolean(
    d && (d.calle || d.numero || d.localidad || d.provincia),
  );
  const contactLines: string[] = [];
  if (meta?.cuit?.trim()) contactLines.push(`CUIT: ${meta.cuit.trim()}`);
  if (meta?.telefono?.trim()) contactLines.push(`Tel: ${meta.telefono.trim()}`);
  if (meta?.email?.trim()) contactLines.push(meta.email.trim());
  if (meta?.web?.trim()) contactLines.push(meta.web.trim());
  const addressLines: string[] = [];
  if (d) {
    const street = [d.calle?.trim(), d.numero?.trim()].filter(Boolean).join(" ");
    const extras = [
      d.piso?.trim() ? `Piso ${d.piso.trim()}` : null,
      d.depto?.trim() ? `Dto ${d.depto.trim()}` : null,
    ].filter(Boolean).join(" ");
    const line1 = [street, extras].filter(Boolean).join(", ");
    const cityParts = [
      d.localidad?.trim(),
      d.provincia?.trim(),
      d.cp?.trim() ? `(${d.cp.trim()})` : null,
    ].filter(Boolean);
    if (line1) addressLines.push(line1);
    if (cityParts.length) addressLines.push(cityParts.join(", "));
  }
  const hasMeta = hasDomicilio || contactLines.length > 0 || Boolean(meta?.logoPath);

  if (hasMeta) {
    const lineH = 3.6;
    const logoW = 22;
    const logoH = 14;
    const gap = 4;
    const textColW = 70;

    // Logo a la izquierda, domicilio + contacto a la derecha. Usamos el
    // mismo alto (la altura dominante) para que las dos columnas queden
    // alineadas visualmente.
    let leftY = 12;
    let rightY = 12;
    const hasLogo = Boolean(logoDataUrl);
    const hasRight = addressLines.length > 0 || contactLines.length > 0;

    // Logo: si el caller nos pasa el data URL, lo embebemos. jsPDF no puede
    // resolver URLs por sí mismo en el browser, así que la conversión a
    // base64 se hace del lado del caller.
    if (hasLogo) {
      const fmt = logoDataUrl!.startsWith("data:image/jpeg")
        ? "JPEG"
        : logoDataUrl!.startsWith("data:image/png")
          ? "PNG"
          : null;
      if (fmt) {
        try {
          doc.addImage(logoDataUrl!, fmt, margin, leftY, logoW, logoH);
          leftY += logoH;
        } catch {
          // Si la imagen es inválida seguimos sin logo.
        }
      }
    }

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const renderRight = (line: string) => {
      doc.text(line, pageWidth - margin, rightY, { align: "right" });
      rightY += lineH;
    };

    if (addressLines.length) {
      for (const line of addressLines) renderRight(line);
      rightY += 0.5;
    }
    for (const line of contactLines) renderRight(line);

    // Si hay una sola columna, la otra no descuenta alto. Calculamos la
    // altura efectiva del bloque para empujar el cursor del cliente.
    const blockBottom = hasLogo && hasRight
      ? Math.max(leftY, rightY) + 2
      : (hasLogo ? leftY : rightY) + 4;
    y = Math.max(y, blockBottom);
  }

  // ── Info del cliente ─────────────────────────────────────────────────────
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(money.maskName(account.client.name), margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  const clientInfo: string[] = [];
  if (account.client.cuit) clientInfo.push(`CUIT: ${money.maskCuit(account.client.cuit, "")}`);
  if (account.client.ivaCondition) clientInfo.push(account.client.ivaCondition);
  if (account.client.email) clientInfo.push(account.client.email);
  if (account.client.phone) clientInfo.push(account.client.phone);

  if (clientInfo.length > 0) {
    doc.text(clientInfo.join("  ·  "), margin, y);
    y += 5;
  }

  // Línea divisoria
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ── Saldo ────────────────────────────────────────────────────────────────
  const balanceLabel = account.balance > 0
    ? "Saldo Adeudado"
    : account.balance < 0
      ? "A Favor del Cliente"
      : "Al Día";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(balanceLabel.toUpperCase(), margin, y);

  const balanceFormatted = money.formatARS(Math.abs(account.balance));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(account.balance > 0 ? 143 : account.balance < 0 ? r : 60, account.balance > 0 ? 61 : account.balance < 0 ? g : 60, account.balance > 0 ? 50 : account.balance < 0 ? b : 60);
  doc.text(balanceFormatted, pageWidth - margin, y, { align: "right" });
  y += 10;

  // ── Extracto ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("Extracto de Cuenta Corriente", margin, y);
  y += 4;

  const rows = account.statement;
  let running = 0;
  const tableRows = rows.map((row) => {
    running += row.type === "charge" ? row.amount : -row.amount;
    running = Math.round(running * 100) / 100;
    return [
      row.date.slice(0, 10).split("-").reverse().join("/"),
      row.concept,
      row.type === "charge" ? money.formatARS(row.amount) : "—",
      row.type === "payment" ? money.formatARS(row.amount) : "—",
      money.formatARS(running),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Fecha", "Concepto", "Cargo", "Pago", "Saldo"]],
    body: tableRows,
    headStyles: {
      fillColor: [240, 238, 233],
      textColor: [80, 80, 80],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center", fontSize: 8 },
      1: { cellWidth: "auto", fontSize: 8 },
      2: { cellWidth: 28, halign: "right", fontSize: 8 },
      3: { cellWidth: 28, halign: "right", fontSize: 8 },
      4: { cellWidth: 32, halign: "right", fontSize: 8 },
    },
    alternateRowStyles: {
      fillColor: [252, 251, 248],
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: [220, 218, 213],
      lineWidth: 0.2,
    },
    didParseCell: (data) => {
      // Color para saldo negativo (a favor)
      if (data.column.index === 4 && data.section === "body") {
        const val = parseFloat(String(data.cell.raw).replace(/[^\d,-]/g, "").replace(",", "."));
        if (!isNaN(val) && val < 0) {
          data.cell.styles.textColor = [r, g, b];
        }
      }
      // Color para cargos
      if (data.column.index === 2 && data.section === "body" && data.cell.raw !== "—") {
        data.cell.styles.textColor = [143, 61, 50];
      }
      // Color para pagos
      if (data.column.index === 3 && data.section === "body" && data.cell.raw !== "—") {
        data.cell.styles.textColor = [r, g, b];
      }
    },
    didDrawPage: () => {},
  });

  // ── Footer ──────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  const footerCuit = meta?.cuit?.trim() ? ` · CUIT ${meta.cuit.trim()}` : "";
  const footerCity =
    d && (d.localidad?.trim() || d.provincia?.trim())
      ? ` · ${[d.localidad?.trim(), d.provincia?.trim()].filter(Boolean).join(", ")}`
      : "";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    const fecha = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    doc.text(`${APP_NAME} · ${fecha}`, margin, 290);
    if (footerCuit || footerCity) {
      doc.text(`${estudioNombre}${footerCity}${footerCuit}`, margin, 286);
    }
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 290, { align: "right" });
  }

  return doc;
}
