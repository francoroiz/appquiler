import * as XLSX from "@e965/xlsx";
import type { MonthlyPercents } from "@/lib/ipcAgreement";

/** Planilla pública de INDEC con el IPC de cobertura nacional (índices y variaciones mensuales). */
export const INDEC_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/sh_ipc_divisiones.xls";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Los encabezados de mes vienen como número de serie de Excel (días desde 1900). */
function serialToMonthKey(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** En una hoja, busca el bloque "Total nacional" y devuelve la fila "Nivel general" como mes -> valor. */
function nationalGeneralRow(rows: unknown[][]): Map<string, number> {
  const out = new Map<string, number>();
  const h = rows.findIndex((r) => norm(r?.[0]) === "total nacional");
  if (h < 0) return out;
  const r = rows.findIndex((row, i) => i > h && norm(row?.[0]) === "nivel general");
  if (r < 0) return out;
  const header = rows[h];
  const row = rows[r];
  for (let c = 1; c < header.length; c++) {
    const serial = header[c];
    const v = row[c];
    if (typeof serial === "number" && serial > 30000 && typeof v === "number" && Number.isFinite(v)) {
      out.set(serialToMonthKey(serial), v);
    }
  }
  return out;
}

function sheetRows(wb: XLSX.WorkBook, test: (normalizedName: string) => boolean): unknown[][] {
  const name = wb.SheetNames.find((n) => test(norm(n)));
  if (!name) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" });
}

/**
 * Lee la planilla de INDEC y devuelve, para el Nivel general nacional:
 * la variación mensual publicada (1 decimal) y el índice exacto (base dic 2016 = 100).
 */
export function parseIndecDivisiones(data: ArrayBuffer | Uint8Array): {
  percents: MonthlyPercents;
  index: Map<string, number>;
} {
  const wb = XLSX.read(data, { type: "array" });
  const index = nationalGeneralRow(sheetRows(wb, (n) => n.includes("indices") && n.includes("nacional")));
  const percents = nationalGeneralRow(sheetRows(wb, (n) => n.includes("variacion mensual") && n.includes("nacional")));
  return { percents, index };
}
