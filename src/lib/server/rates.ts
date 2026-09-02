import { getSql } from "@/lib/db";
import {
  DOLLAR_API_URL,
  MODULE_FALLBACK_VALUE,
  MODULE_SOURCE_URL,
} from "@/lib/constants";
import { parseArgentineNumber } from "@/lib/money";
import { asBool, num } from "@/lib/utils";
import type { DollarQuote, ModuleQuote } from "@/lib/fn/types";
import {
  extractModuleHistoryFromHtml,
  fallbackHistory,
  persistModuleHistory,
} from "./module-history";

function extractModuleFromHtml(html: string): { value: number; vigencia: string | null } {
  const history = extractModuleHistoryFromHtml(html);
  if (history[0]) return history[0];

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;/gi, " ");
  const valRe = /\$\s*([\d.]+,\d{2})/;
  const match = stripped.match(valRe);
  if (match?.[1]) {
    const value = parseArgentineNumber(match[1]);
    if (value && value > 0) return { value, vigencia: null };
  }

  throw new Error("No se encontró el valor del módulo en CPCEBA");
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CifraHonorarios/1.0; +https://cifra.estudio)",
        Accept: "text/html,application/json",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function cachedOrFallback(estudioId: string): Promise<ModuleQuote> {
  const sql = await getSql();
  const cached = await sql<{
    value: unknown;
    vigencia: string | null;
    fetched_at: string;
  }>`
    select value, vigencia, fetched_at::text
    from module_values
    where estudio_id = ${estudioId}
    order by fetched_at desc
    limit 1
  `;
  if (cached[0]) {
    return {
      value: num(cached[0].value),
      vigencia: cached[0].vigencia,
      fetchedAt: cached[0].fetched_at,
      source: "cache",
    };
  }
  return {
    value: MODULE_FALLBACK_VALUE,
    vigencia: "01/08/2026",
    fetchedAt: new Date().toISOString(),
    source: "fallback",
  };
}

async function estudioUsesCpceba(estudioId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ mod_cpceba: unknown }>`
    select mod_cpceba from estudios where id = ${estudioId}
  `;
  if (!rows[0]) return true;
  return asBool(rows[0].mod_cpceba);
}

export async function syncModuleHistoryFromCpceba(estudioId: string): Promise<void> {
  if (!(await estudioUsesCpceba(estudioId))) {
    await persistModuleHistory(fallbackHistory(), estudioId);
    return;
  }
  try {
    const res = await fetchWithTimeout(MODULE_SOURCE_URL, 8000);
    if (!res.ok) throw new Error(`CPCEBA ${res.status}`);
    const html = await res.text();
    const history = extractModuleHistoryFromHtml(html);
    await persistModuleHistory(history.length ? history : fallbackHistory(), estudioId);
  } catch {
    await persistModuleHistory(fallbackHistory(), estudioId);
  }
}

export async function fetchModuleValue(estudioId: string): Promise<ModuleQuote> {
  if (!(await estudioUsesCpceba(estudioId))) {
    return cachedOrFallback(estudioId);
  }
  const sql = await getSql();
  try {
    const res = await fetchWithTimeout(MODULE_SOURCE_URL, 6000);
    if (!res.ok) throw new Error(`CPCEBA ${res.status}`);
    const html = await res.text();
    const parsed = extractModuleFromHtml(html);
    const history = extractModuleHistoryFromHtml(html);
    if (history.length) {
      await persistModuleHistory(history, estudioId);
    } else if (parsed.vigencia) {
      await persistModuleHistory([{ value: parsed.value, vigencia: parsed.vigencia }], estudioId);
    } else {
      await sql`
        insert into module_values (estudio_id, value, vigencia)
        values (${estudioId}, ${parsed.value}, ${null})
      `;
    }
    return {
      value: parsed.value,
      vigencia: parsed.vigencia,
      fetchedAt: new Date().toISOString(),
      source: "live",
    };
  } catch {
    await persistModuleHistory(fallbackHistory(), estudioId);
    return cachedOrFallback(estudioId);
  }
}

export async function fetchDollarRate(): Promise<DollarQuote> {
  try {
    const res = await fetchWithTimeout(DOLLAR_API_URL, 5000);
    if (!res.ok) throw new Error("dolarapi");
    const data = (await res.json()) as {
      compra?: number;
      venta?: number;
      fechaActualizacion?: string;
    };
    return {
      compra: Number(data.compra) || 0,
      venta: Number(data.venta) || 0,
      updatedAt: data.fechaActualizacion ?? null,
    };
  } catch {
    return { compra: 0, venta: 0, updatedAt: null };
  }
}
