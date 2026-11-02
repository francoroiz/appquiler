/**
 * IPC automático y verificado (solo servidor).
 * Consulta INDEC (planilla oficial), ArgentinaDatos y BCRA. Un mes se acepta solo si al menos
 * 2 fuentes lo publicaron y todas coinciden al decimal. Si INDEC publicó el índice exacto y es
 * coherente con la variación acordada, también se devuelve el índice (permite calcular el
 * acumulado exacto en vez de componer porcentajes redondeados).
 */
import {
  decideMonth,
  parseArgentinaDatos,
  parseBcra,
  type SourceResult,
} from '@/lib/ipcAgreement'
import { INDEC_URL, parseIndecDivisiones } from '@/lib/ipcIndec'

const ARGENTINADATOS_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion'
const BCRA_URL = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/27'

/** Primer mes que se verifica (cubre la base de cualquier ventana reciente). */
const FROM_MONTH = '2025-10'

export type IpcAuto = {
  /** variación mensual verificada, % (ej. 1.9) */
  monthly: Record<string, number>
  /** índice exacto INDEC, solo de meses cuya variación coincide con la acordada */
  index: Record<string, number>
  /** qué fuentes confirmaron cada mes */
  sources: Record<string, string[]>
  /** fuentes que no respondieron o meses sin acuerdo */
  log: string[]
  fetchedAt: string
}

function monthKeyOf(y: number, m0: number): string {
  const d = new Date(Date.UTC(y, m0, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** m viene en base 1 ("2026-09" -> 9); monthKeyOf espera base 0. */
function prevMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(y, m - 2)
}

function nextMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(y, m)
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function loadSources(log: string[]): Promise<SourceResult[]> {
  const since = `${new Date().getUTCFullYear() - 1}-01-01`
  const attempts: Array<{ name: string; run: () => Promise<Omit<SourceResult, 'name'>> }> = [
    {
      name: 'INDEC',
      run: async () => {
        const res = await fetch(INDEC_URL, { cache: 'no-store', signal: AbortSignal.timeout(25000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { percents, index } = parseIndecDivisiones(await res.arrayBuffer())
        return { data: percents, index }
      },
    },
    {
      name: 'ArgentinaDatos',
      run: async () => ({ data: parseArgentinaDatos(await fetchJson(ARGENTINADATOS_URL)) }),
    },
    {
      name: 'BCRA',
      run: async () => ({ data: parseBcra(await fetchJson(`${BCRA_URL}?desde=${since}`)) }),
    },
  ]
  const settled = await Promise.allSettled(attempts.map(a => a.run()))
  const results: SourceResult[] = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value.data.size > 0) {
      results.push({ name: attempts[i].name, ...s.value })
    } else {
      const why = s.status === 'rejected' ? String(s.reason?.message ?? s.reason) : 'sin datos'
      log.push(`${attempts[i].name}: no disponible (${why})`)
    }
  })
  return results
}

/** Núcleo puro (testeable): decide qué meses se aceptan a partir de las fuentes ya leídas. */
export function buildIpcAuto(results: SourceResult[], now: Date, log: string[] = []): IpcAuto {
  const monthly: Record<string, number> = {}
  const index: Record<string, number> = {}
  const sources: Record<string, string[]> = {}

  // solo meses ya cerrados: INDEC publica el mes anterior a mediados del siguiente
  const lastClosed = monthKeyOf(now.getUTCFullYear(), now.getUTCMonth() - 1)
  let ym = FROM_MONTH
  while (ym <= lastClosed) {
    const decision = decideMonth(ym, results)
    if (decision.ok) {
      monthly[ym] = decision.percent
      sources[ym] = decision.sources
      // índice exacto de INDEC: solo si el del mes anterior existe y la variación cierra
      for (const r of results) {
        const cur = r.index?.get(ym)
        const prev = r.index?.get(prevMonthKey(ym))
        if (cur === undefined || prev === undefined) continue
        const computed = (cur / prev - 1) * 100
        if (Math.abs(computed - decision.percent) > 0.06) continue
        index[ym] = cur
        break
      }
    } else if (!decision.reason.includes('solo 0 fuente')) {
      // un mes que nadie publicó todavía no es una alerta; uno con discrepancia sí
      log.push(decision.reason)
    }
    ym = nextMonthKey(ym)
  }
  return { monthly, index, sources, log, fetchedAt: now.toISOString() }
}

export async function fetchIpcAuto(): Promise<IpcAuto> {
  const log: string[] = []
  const results = await loadSources(log)
  return buildIpcAuto(results, new Date(), log)
}
