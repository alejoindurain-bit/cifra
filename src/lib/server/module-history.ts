import { getSql } from "@/lib/db";
import { MODULE_FALLBACK_VALUE, ORIGINAL_ESTUDIO_ID } from "@/lib/constants";
import { parseArgentineNumber } from "@/lib/money";
import { num } from "@/lib/utils";

/** CPCEBA published vigencias (Res. CD / MD). Used if the live table can't be fetched. */
const FALLBACK_HISTORY: Array<[string, number]> = [
  ["01/08/2026", 3693],
  ["01/06/2026", 3548],
  ["01/04/2026", 3345],
  ["01/02/2026", 3160],
  ["01/12/2025", 2998],
  ["01/10/2025", 2870],
  ["01/08/2025", 2765],
  ["01/06/2025", 2681],
  ["01/04/2025", 2515],
  ["01/02/2025", 2403],
  ["01/12/2024", 2284],
  ["01/10/2024", 2150],
  ["01/08/2024", 1984],
  ["01/06/2024", 1821],
  ["01/04/2024", 1507],
  ["01/02/2024", 1103],
  ["01/12/2023", 779],
  ["01/09/2023", 567],
  ["01/06/2023", 467],
  ["01/03/2023", 375],
  ["01/12/2022", 321],
  ["01/09/2022", 266],
  ["01/06/2022", 224],
  ["01/03/2022", 189],
  ["01/12/2021", 171],
  ["01/09/2021", 156],
  ["01/06/2021", 142],
  ["01/03/2021", 126],
  ["01/12/2020", 113],
  ["01/09/2020", 103],
  ["01/03/2020", 91],
  ["01/12/2019", 82],
  ["01/08/2019", 74.3],
  ["01/05/2019", 61.92],
  ["01/02/2019", 58.8],
  ["01/08/2018", 55.7],
  ["01/02/2018", 49.15],
  ["01/08/2017", 46.7],
  ["01/05/2017", 41.3],
  ["01/02/2017", 39],
  ["01/08/2016", 36.5],
  ["01/05/2016", 31.28],
  ["01/02/2016", 28.91],
  ["01/08/2015", 26.54],
  ["01/05/2015", 23.7],
  ["01/02/2015", 21.9],
  ["01/08/2014", 20],
  ["01/05/2014", 18.2],
  ["01/02/2014", 16.55],
  ["01/08/2013", 15.3],
  ["01/05/2013", 14.3],
  ["01/02/2013", 13.5],
  ["01/08/2012", 12.5],
  ["01/05/2012", 11.39],
  ["01/02/2012", 10.51],
  ["01/08/2011", 9.63],
  ["01/05/2011", 8.75],
  ["01/02/2011", 8.14],
  ["01/11/2010", 7.58],
  ["01/08/2010", 7.08],
  ["01/02/2010", 6.59],
  ["01/08/2009", 5.73],
  ["01/02/2009", 5.3],
  ["01/08/2008", 4.78],
  ["01/01/2008", 4.43],
  ["01/08/2006", 3.85],
  ["01/01/2006", 3.5],
  ["01/07/2004", 3],
  ["01/01/2004", 2.75],
  ["01/01/1992", 2.41],
];

export type ModuleVigencia = { value: number; vigencia: string; iso: string };

export function vigenciaToIso(vigencia: string): string | null {
  const m = vigencia.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function extractModuleHistoryFromHtml(html: string): Array<{ value: number; vigencia: string }> {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const rowRe = /(\d{2}\/\d{2}\/\d{4})\s*\$\s*([\d.]+,\d{2})/g;
  const out: Array<{ value: number; vigencia: string }> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(stripped))) {
    const vigencia = match[1];
    if (seen.has(vigencia)) continue;
    const value = parseArgentineNumber(match[2]);
    if (!value || value <= 0) continue;
    seen.add(vigencia);
    out.push({ value, vigencia });
  }
  return out;
}

export function fallbackHistory(): Array<{ value: number; vigencia: string }> {
  return FALLBACK_HISTORY.map(([vigencia, value]) => ({ vigencia, value }));
}

export async function persistModuleHistory(
  rows: Array<{ value: number; vigencia: string }>,
  estudioId: string = ORIGINAL_ESTUDIO_ID,
): Promise<void> {
  if (rows.length === 0) return;
  const sql = await getSql();
  const existing = await sql<{ vigencia: string | null }>`
    select vigencia from module_values
    where estudio_id = ${estudioId} and vigencia is not null
  `;
  const have = new Set(existing.map((r) => r.vigencia).filter(Boolean));
  for (const row of rows) {
    if (have.has(row.vigencia)) continue;
    await sql`
      insert into module_values (estudio_id, value, vigencia)
      values (${estudioId}, ${row.value}, ${row.vigencia})
    `;
    have.add(row.vigencia);
  }
}

export async function loadModuleHistory(
  estudioId: string = ORIGINAL_ESTUDIO_ID,
): Promise<ModuleVigencia[]> {
  const sql = await getSql();
  const rows = await sql<{ value: unknown; vigencia: string | null }>`
    select value, vigencia from module_values
    where estudio_id = ${estudioId} and vigencia is not null
  `;
  let parsed: ModuleVigencia[] = [];
  for (const r of rows) {
    if (!r.vigencia) continue;
    const iso = vigenciaToIso(r.vigencia);
    if (!iso) continue;
    parsed.push({ value: num(r.value), vigencia: r.vigencia, iso });
  }
  if (parsed.length < 8) {
    await persistModuleHistory(fallbackHistory(), estudioId);
    const again = await sql<{ value: unknown; vigencia: string | null }>`
      select value, vigencia from module_values
      where estudio_id = ${estudioId} and vigencia is not null
    `;
    parsed = [];
    for (const r of again) {
      if (!r.vigencia) continue;
      const iso = vigenciaToIso(r.vigencia);
      if (!iso) continue;
      parsed.push({ value: num(r.value), vigencia: r.vigencia, iso });
    }
  }
  parsed.sort((a, b) => (a.iso < b.iso ? 1 : -1));
  return parsed;
}

export function moduleValueForMonth(history: ModuleVigencia[], year: number, month: number): number {
  const asOf = `${year}-${String(month).padStart(2, "0")}-01`;
  const hit = history.find((h) => h.iso <= asOf);
  return hit?.value ?? MODULE_FALLBACK_VALUE;
}
