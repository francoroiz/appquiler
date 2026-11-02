// Datos históricos IPC INDEC (variación mensual %)
export const IPC_FIJO: Record<string, number> = {
  '2024-01': 20.6, '2024-02': 13.2, '2024-03': 11.0, '2024-04': 8.8,
  '2024-05': 4.2,  '2024-06': 4.6,  '2024-07': 4.0,  '2024-08': 4.2,
  '2024-09': 3.5,  '2024-10': 2.4,  '2024-11': 2.4,  '2024-12': 2.7,
  '2025-01': 2.3,  '2025-02': 2.4,  '2025-03': 3.7,  '2025-04': 2.8,
  '2025-05': 1.5,  '2025-06': 1.6,  '2025-07': 1.9,  '2025-08': 1.9,
  '2025-09': 2.1,  '2025-10': 2.3,  '2025-11': 2.5,  '2025-12': 2.8,
  '2026-01': 2.9,  '2026-02': 2.9,  '2026-03': 3.4,  '2026-04': 2.58,
}

// Próximas fechas de publicación INDEC
export const IPC_CALENDARIO: Record<string, string> = {
  '2026-05': '11 jun 2026',
  '2026-06': '~segunda semana jul 2026',
  '2026-07': '~segunda semana ago 2026',
}

export function mesNombre(ym: string): string {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [, m] = ym.split('-')
  return meses[parseInt(m) - 1] + ' ' + ym.split('-')[0]
}

export function ymHoy(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

export function ymList(from: string, to: string): string[] {
  const list: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    list.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return list
}

// ── IPC automático y verificado ──────────────────────────────────────────────
// El panel (layout) lo carga desde /api/ipc-auto antes de mostrar las pantallas. Son datos
// públicos confirmados por al menos 2 fuentes (INDEC + ArgentinaDatos/BCRA).
type IpcAutoData = { monthly: Record<string, number>; index: Record<string, number> }
let AUTO: IpcAutoData = { monthly: {}, index: {} }

export function setIpcAuto(data: Partial<IpcAutoData> | null | undefined) {
  AUTO = { monthly: data?.monthly ?? {}, index: data?.index ?? {} }
}

/** Variaciones automáticas de los meses que no están en la tabla fija. */
export function getIpcAutoMonthly(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [ym, v] of Object.entries(AUTO.monthly)) if (!(ym in IPC_FIJO)) out[ym] = v
  return out
}

/** Prioridad: carga manual > tabla fija > automático verificado. */
export function ipcDb(ipcExtra: Record<string, number> = {}): Record<string, number> {
  return { ...getIpcAutoMonthly(), ...IPC_FIJO, ...ipcExtra }
}

export function ymAdd(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Acumulado exacto con el índice INDEC (fin / base − 1). Solo si ningún mes fue cargado a mano. */
function exactAccum(baseYM: string, endYM: string, months: string[], ipcExtra: Record<string, number>): number | null {
  if (months.some(m => m in IPC_FIJO || m in ipcExtra)) return null
  const a = AUTO.index[baseYM]
  const b = AUTO.index[endYM]
  if (!a || !b) return null
  return b / a - 1
}

// Calcula inflación acumulada compuesta entre dos meses
export function ipcAcumulado(
  from: string,
  to: string,
  ipcExtra: Record<string, number> = {}
): number {
  const db = ipcDb(ipcExtra)
  const meses = ymList(from, to).slice(1)
  return meses.reduce((acc, ym) => {
    const v = db[ym]
    return v !== undefined ? acc * (1 + v / 100) : acc
  }, 1) - 1
}

export type TipoActualizacion =
  | { tipo: 'listo'; ipc: number; mesDato: string; proxYM: string; diasHasta: number; blancoNuevo: number; msg: string; vencida: boolean; exacto: boolean }
  | { tipo: 'previo'; ipcComp: number; meses: { ym: string; val: number | null }[]; proxYM: string; diasHasta: number; blancoNuevo: number; msg: string; vencida: boolean; exacto: boolean }
  | { tipo: 'esperar'; proxYM: string; diasHasta: number; msg: string; pubCal?: string; vencida: boolean }

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Suma meses sin desbordar (31/01 + 1 mes = 28/02, no 03/03). */
function addMonthsClamped(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last))
}

const DAY = 1000 * 60 * 60 * 24

export function calcActualizacion(
  inicio: string,
  periodo: number,
  modalidad: 'esperar' | 'previo',
  blancoActual: number,
  ipcExtra: Record<string, number> = {},
  negroActual: number = 0,
  /** períodos ya aplicados (ej. "Nov 2026"). Si se pasa, una actualización vencida y sin aplicar sigue pendiente. */
  aplicados?: string[]
): TipoActualizacion {
  const db = ipcDb(ipcExtra)
  const now = new Date()
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const inicioDate = parseLocalDate(inicio)

  // Si blanco es 0, operar sobre negro con modalidad previo (acumulado compuesto)
  const base = blancoActual === 0 ? negroActual : blancoActual
  const modalidadEfectiva: 'esperar' | 'previo' = blancoActual === 0 ? 'previo' : modalidad

  // Fechas de actualización: inicio + k·período. Última vencida y próxima.
  let k = 1
  let lastDue: Date | null = null
  let nextDue = addMonthsClamped(inicioDate, periodo)
  while (nextDue <= hoy) {
    lastDue = nextDue
    k++
    nextDue = addMonthsClamped(inicioDate, k * periodo)
  }
  const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  // Una actualización vencida que todavía no se aplicó sigue pendiente (no se salta al siguiente ciclo)
  let proxFecha = nextDue
  let vencida = false
  if (
    aplicados !== undefined && lastDue &&
    !aplicados.includes(mesNombre(ymOf(lastDue))) &&
    lastDue >= addMonthsClamped(hoy, -periodo)
  ) {
    proxFecha = lastDue
    vencida = true
  }

  const proxYM = ymOf(proxFecha)
  const diasHasta = Math.round((proxFecha.getTime() - hoy.getTime()) / DAY)

  if (modalidadEfectiva === 'esperar') {
    const mdYM = ymAdd(proxYM, -1)
    const exact = exactAccum(ymAdd(mdYM, -1), mdYM, [mdYM], ipcExtra)
    const ipcDisp = exact !== null ? exact * 100 : (db[mdYM] ?? null)

    if (ipcDisp !== null) {
      const blancoNuevo = base * (1 + ipcDisp / 100)
      return {
        tipo: 'listo', ipc: ipcDisp, mesDato: mdYM, proxYM, diasHasta, blancoNuevo, vencida, exacto: exact !== null,
        msg: `IPC ${mesNombre(mdYM)}: +${exact !== null ? ipcDisp.toFixed(4) : ipcDisp}%${exact !== null ? ' (índice exacto INDEC)' : ''}`
      }
    }
    const pubCal = IPC_CALENDARIO[mdYM]
    return { tipo: 'esperar', proxYM, diasHasta, pubCal, vencida, msg: `Esperando IPC ${mesNombre(mdYM)}${pubCal ? ` (publica ${pubCal})` : ''}` }
  } else {
    const meses: { ym: string; val: number | null }[] = []
    for (let i = periodo; i >= 1; i--) {
      const ym = ymAdd(proxYM, -i)
      meses.push({ ym, val: db[ym] ?? null })
    }
    const exact = exactAccum(ymAdd(meses[0].ym, -1), meses[meses.length - 1].ym, meses.map(x => x.ym), ipcExtra)
    const todos = exact !== null || meses.every(x => x.val !== null)
    if (todos) {
      const comp = exact !== null
        ? exact
        : meses.reduce((a, x) => a * (1 + (x.val as number) / 100), 1) - 1
      const blancoNuevo = base * (1 + comp)
      return {
        tipo: 'previo', ipcComp: comp * 100, meses, proxYM, diasHasta, blancoNuevo, vencida, exacto: exact !== null,
        msg: `Acumulado ${exact !== null ? 'exacto INDEC' : 'compuesto'} (${meses.map(x => mesNombre(x.ym)).join('+')}): +${(comp * 100).toFixed(exact !== null ? 4 : 2)}%`
      }
    }
    const falt = meses.filter(x => x.val === null).map(x => mesNombre(x.ym))
    return { tipo: 'esperar', proxYM, diasHasta, vencida, msg: `Faltan datos: ${falt.join(', ')}` }
  }
}

export function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

export function fmtUSD(n: number): string {
  return 'U$S ' + parseFloat(n.toFixed(0)).toLocaleString('es-AR')
}

export function calcVencimiento(inicio: string, anos: number): string {
  const d = new Date(inicio)
  d.setFullYear(d.getFullYear() + anos)
  return d.toLocaleDateString('es-AR')
}

export function vencimientoStatus(venc: string): { cls: string; txt: string } | null {
  if (!venc || venc === '—') return null
  const p = venc.split('/')
  if (p.length !== 3) return null
  const v = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.ceil((v.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { cls: 'vencido', txt: `Vencido hace ${Math.abs(diff)} días` }
  if (diff <= 90) return { cls: 'proximo', txt: `Vence en ${diff} días (${venc})` }
  return { cls: 'ok', txt: `Vence el ${venc}` }
}
