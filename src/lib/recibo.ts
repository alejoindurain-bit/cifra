import { formatARS, formatDateAR, formatQty } from "@/lib/money";

export type ReciboData = {
  id: number;
  clientName: string;
  cuit: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  transferAccount: string | null;
  dollarAmount?: number | null;
  dollarRate?: number | null;
  firmName?: string | null;
};

const A4_W = 595.28;
const A4_H = 841.89;
const THIRD = A4_H / 3;
const CUT_Y = A4_H - THIRD;
const MARGIN = 36;

export function downloadRecibo(data: ReciboData) {
  const pdf = buildReciboPdf(data);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recibo-${data.id}-${data.date.slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildReciboPdf(data: ReciboData): string {
  const stream = receiptStream(data);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  return assemblePdf(objects);
}

function fromTop(offset: number): number {
  return A4_H - offset;
}

function receiptStream(data: ReciboData): string {
  const black = "0 0 0";
  const nro = String(data.id).padStart(5, "0");
  const firm = (data.firmName || "").trim() || "Estudio";
  const medio = data.transferAccount
    ? `${data.paymentMethod} · ${data.transferAccount}`
    : data.paymentMethod;
  const dollarLine =
    data.dollarAmount && data.dollarRate
      ? `USD ${formatQty(data.dollarAmount)}  x  cotización ${formatQty(data.dollarRate)}`
      : null;

  const ops: string[] = [];
  ops.push(`${black} rg`);
  ops.push(`${black} RG`);
  ops.push("0.4 w");

  ops.push(text(MARGIN, fromTop(28), 14, true, firm));
  ops.push(text(A4_W - MARGIN, fromTop(22), 9, false, `Recibo Nº ${nro}`, "right"));
  ops.push(text(A4_W - MARGIN, fromTop(34), 8, false, "Pago de honorarios", "right"));

  ops.push("0.5 w");
  ops.push(`${MARGIN} ${fromTop(44)} m ${A4_W - MARGIN} ${fromTop(44)} l S`);
  ops.push("0.25 w");
  ops.push(`${MARGIN} ${fromTop(47)} m ${A4_W - MARGIN} ${fromTop(47)} l S`);

  let y = 66;
  ops.push(text(MARGIN, fromTop(y), 8, false, "RECIBÍ DE"));
  y += 16;
  const names = wrap(data.clientName.trim() || "Cliente", 12, A4_W - MARGIN * 2);
  for (const lineText of names) {
    ops.push(text(MARGIN, fromTop(y), 12, true, lineText));
    y += 15;
  }
  if (data.cuit) {
    ops.push(text(MARGIN, fromTop(y), 9, false, `CUIT ${data.cuit}`));
    y += 13;
  }

  y += 10;
  ops.push(text(MARGIN, fromTop(y), 8, false, "LA SUMA DE"));
  y += 16;
  ops.push(text(MARGIN, fromTop(y), 16, true, formatARS(data.amount)));
  y += 14;
  ops.push(text(MARGIN, fromTop(y), 8, false, pesosEnLetras(data.amount)));
  y += 18;

  ops.push(text(MARGIN, fromTop(y), 10, false, `Fecha  ${formatDateAR(data.date)}`));
  ops.push(text(A4_W - MARGIN, fromTop(y), 10, false, medio, "right"));
  y += 14;
  ops.push(text(MARGIN, fromTop(y), 9, false, "Concepto: pago a cuenta de honorarios"));
  if (dollarLine) {
    y += 12;
    ops.push(text(MARGIN, fromTop(y), 8, false, dollarLine));
  }

  const firmaY = Math.max(CUT_Y + 22, fromTop(y + 26));
  ops.push("0.4 w");
  ops.push(`${MARGIN} ${firmaY} m ${MARGIN + 170} ${firmaY} l S`);
  ops.push(text(MARGIN, firmaY - 11, 7, false, "Firma y sello del estudio"));

  ops.push("0.4 w");
  ops.push(`0 ${CUT_Y} m ${A4_W} ${CUT_Y} l S`);

  return ops.join("\n");
}

function text(
  x: number,
  y: number,
  size: number,
  bold: boolean,
  value: string,
  align: "left" | "right" | "center" = "left",
): string {
  const font = bold ? "/F2" : "/F1";
  const w = estimateWidth(value, size);
  const tx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  return `BT ${font} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm ${pdfString(value)} Tj ET`;
}

function wrap(raw: string, size: number, maxWidth: number): string[] {
  const words = raw.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateWidth(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines.length ? lines : [raw];
  const extra = lines.slice(1).join(" ");
  return [lines[0], extra.length > 42 ? `${extra.slice(0, 41)}.` : extra];
}

function estimateWidth(s: string, size: number): number {
  return s.length * size * 0.52;
}

function pdfString(raw: string): string {
  const bytes = toWinAnsi(raw.replace(/\s+/g, " ").trim());
  let out = "(";
  for (const b of bytes) {
    if (b === 0x5c || b === 0x28 || b === 0x29) out += `\\${String.fromCharCode(b)}`;
    else if (b < 0x20 || b > 0x7e) out += `\\${b.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(b);
  }
  return `${out})`;
}

const WIN1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function toWinAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 63;
    if (c < 0x80) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (WIN1252[c] != null) out.push(WIN1252[c]);
    else out.push(0x3f);
  }
  return out;
}

function assemblePdf(bodies: string[]): string {
  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets = [0];
  let pos = chunks[0].length;
  bodies.forEach((body, i) => {
    const block = `${i + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(pos);
    chunks.push(block);
    pos += block.length;
  });
  const xrefPos = pos;
  const lines = [`xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i <= bodies.length; i += 1) {
    lines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(lines.join(""));
  chunks.push(
    `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
  );
  return chunks.join("");
}

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const DECENAS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function decena(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DIEZ[n - 10];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 2) {
    if (u === 0) return "veinte";
    if (u === 1) return "veintiuno";
    if (u === 2) return "veintidós";
    if (u === 3) return "veintitrés";
    if (u === 6) return "veintiséis";
    return `veinti${UNIDADES[u]}`;
  }
  return u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d];
}

function chunk999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const rest = n % 100;
  const h = c ? CENTENAS[c] : "";
  const d = rest ? decena(rest) : "";
  return [h, d].filter(Boolean).join(" ");
}

function apocope(s: string): string {
  if (s === "uno") return "un";
  if (s === "veintiuno") return "veintiún";
  if (s.endsWith(" uno")) return `${s.slice(0, -4)} un`;
  if (s.endsWith(" veintiuno")) return `${s.slice(0, -10)} veintiún`;
  return s;
}

function enteroEnLetras(n: number): string {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (millones === 1) parts.push("un millón");
  else if (millones > 1) parts.push(`${apocope(chunk999(millones))} millones`);
  if (miles === 1) parts.push("mil");
  else if (miles > 1) parts.push(`${apocope(chunk999(miles))} mil`);
  if (resto) parts.push(chunk999(resto));
  return parts.join(" ");
}

export function pesosEnLetras(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const entero = Math.floor(rounded);
  const centavos = Math.round((rounded - entero) * 100);
  return `Son pesos ${enteroEnLetras(entero)} con ${String(centavos).padStart(2, "0")}/100`;
}
