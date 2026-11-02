/**
 * Lógica pura (sin base de datos ni red) para aceptar la variación mensual del IPC
 * a partir de varias fuentes independientes. Se separa para poder probarla sola.
 */

/** "YYYY-MM" -> variación mensual en % (INDEC publica con 1 decimal) */
export type MonthlyPercents = Map<string, number>;

/** `index` (opcional): índice exacto por mes, para las fuentes que lo publican (INDEC). */
export type SourceResult = { name: string; data: MonthlyPercents; index?: Map<string, number> };

/** Dos valores "coinciden" si son iguales al decimal que publica INDEC. */
const TOLERANCE = 0.05;

function isMonthKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])/.test(s);
}

/** api.argentinadatos.com/v1/finanzas/indices/inflacion -> [{ fecha: "2026-09-30", valor: 1.9 }] */
export function parseArgentinaDatos(json: unknown): MonthlyPercents {
  const out: MonthlyPercents = new Map();
  if (!Array.isArray(json)) return out;
  for (const row of json as Array<{ fecha?: unknown; valor?: unknown }>) {
    const v = Number(row?.valor);
    if (isMonthKey(row?.fecha) && Number.isFinite(v)) out.set((row.fecha as string).slice(0, 7), v);
  }
  return out;
}

/** api.bcra.gob.ar/estadisticas/v4.0/monetarias/27 -> { results: [{ detalle: [{ fecha, valor }] }] } */
export function parseBcra(json: unknown): MonthlyPercents {
  const out: MonthlyPercents = new Map();
  const detalle = (json as { results?: Array<{ detalle?: Array<{ fecha?: unknown; valor?: unknown }> }> })
    ?.results?.[0]?.detalle;
  if (!Array.isArray(detalle)) return out;
  for (const row of detalle) {
    const v = Number(row?.valor);
    if (isMonthKey(row?.fecha) && Number.isFinite(v)) out.set((row.fecha as string).slice(0, 7), v);
  }
  return out;
}

export type Decision =
  | { ok: true; percent: number; sources: string[] }
  | { ok: false; reason: string };

/**
 * Decide si un mes se puede dar por bueno: hacen falta al menos 2 fuentes que tengan el mes
 * y TODAS las que lo tienen deben coincidir. Si alguna discrepa, no se acepta nada.
 */
export function decideMonth(month: string, results: SourceResult[]): Decision {
  const found = results
    .map((r) => ({ name: r.name, value: r.data.get(month) }))
    .filter((r): r is { name: string; value: number } => typeof r.value === "number");

  if (found.length < 2) {
    return { ok: false, reason: `${month}: solo ${found.length} fuente(s) lo publicaron (se necesitan 2)` };
  }
  const min = Math.min(...found.map((f) => f.value));
  const max = Math.max(...found.map((f) => f.value));
  if (max - min > TOLERANCE) {
    return {
      ok: false,
      reason: `${month}: las fuentes no coinciden (${found.map((f) => `${f.name} ${f.value}%`).join(", ")})`,
    };
  }
  if (min < -10 || max > 50) {
    return { ok: false, reason: `${month}: valor fuera de rango (${min}% a ${max}%)` };
  }
  return { ok: true, percent: found[0].value, sources: found.map((f) => f.name) };
}

/**
 * Si alguna fuente publica el índice exacto del mes (INDEC), lo devuelve, pero solo si es coherente:
 *  - su índice del mes anterior coincide con el que ya tenemos guardado (misma serie), y
 *  - su variación calculada coincide con la variación acordada, dentro del redondeo a 1 decimal.
 * Si algo no cierra, devuelve undefined y se usa la variación redondeada.
 */
export function exactIndexFor(
  month: string,
  prevMonth: string,
  storedPrevIndex: number,
  agreedPercent: number,
  results: SourceResult[]
): number | undefined {
  for (const r of results) {
    const cur = r.index?.get(month);
    const prev = r.index?.get(prevMonth);
    if (cur === undefined || prev === undefined) continue;
    if (Math.abs(prev - storedPrevIndex) > 0.001) continue;
    const computed = (cur / prev - 1) * 100;
    if (Math.abs(computed - agreedPercent) > 0.06) continue;
    return cur;
  }
  return undefined;
}
