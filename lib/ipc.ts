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

// Calcula inflación acumulada compuesta entre dos meses
export function ipcAcumulado(
  from: string,
  to: string,
  ipcExtra: Record<string, number> = {}
): number {
  const db = { ...IPC_FIJO, ...ipcExtra }
  const meses = ymList(from, to).slice(1)
  return meses.reduce((acc, ym) => {
    const v = db[ym]
    return v !== undefined ? acc * (1 + v / 100) : acc
  }, 1) - 1
}

export type TipoActualizacion =
  | { tipo: 'listo'; ipc: number; mesDato: string; proxYM: string; diasHasta: number; blancoNuevo: number; msg: string }
  | { tipo: 'previo'; ipcComp: number; meses: { ym: string; val: number | null }[]; proxYM: string; diasHasta: number; blancoNuevo: number; msg: string }
  | { tipo: 'esperar'; proxYM: string; diasHasta: number; msg: string; pubCal?: string }

export function calcActualizacion(
  inicio: string,
  periodo: number,
  modalidad: 'esperar' | 'previo',
  blancoActual: number,
  ipcExtra: Record<string, number> = {}
): TipoActualizacion {
  const db = { ...IPC_FIJO, ...ipcExtra }
  const hoy = new Date()
  const inicioDate = new Date(inicio)

  let proxFecha = new Date(inicioDate)
  while (proxFecha <= hoy) {
    proxFecha.setMonth(proxFecha.getMonth() + periodo)
  }

  const proxMes = proxFecha.getMonth() + 1
  const proxAnio = proxFecha.getFullYear()
  const proxYM = `${proxAnio}-${String(proxMes).padStart(2, '0')}`
  const diasHasta = Math.ceil((proxFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

  if (modalidad === 'esperar') {
    const mdf = new Date(proxFecha)
    mdf.setMonth(mdf.getMonth() - 1)
    const mdYM = `${mdf.getFullYear()}-${String(mdf.getMonth() + 1).padStart(2, '0')}`
    const ipcDisp = db[mdYM] ?? null

    if (ipcDisp !== null) {
      const blancoNuevo = blancoActual * (1 + ipcDisp / 100)
      return { tipo: 'listo', ipc: ipcDisp, mesDato: mdYM, proxYM, diasHasta, blancoNuevo, msg: `IPC ${mesNombre(mdYM)}: +${ipcDisp}%` }
    }
    const pubCal = IPC_CALENDARIO[mdYM]
    return { tipo: 'esperar', proxYM, diasHasta, pubCal, msg: `Esperando IPC ${mesNombre(mdYM)}${pubCal ? ` (publica ${pubCal})` : ''}` }
  } else {
    const meses: { ym: string; val: number | null }[] = []
    for (let i = periodo; i >= 1; i--) {
      const d = new Date(proxFecha)
      d.setMonth(d.getMonth() - i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meses.push({ ym, val: db[ym] ?? null })
    }
    const todos = meses.every(x => x.val !== null)
    if (todos) {
      const comp = meses.reduce((a, x) => a * (1 + (x.val as number) / 100), 1) - 1
      const blancoNuevo = blancoActual * (1 + comp)
      return {
        tipo: 'previo', ipcComp: comp * 100, meses, proxYM, diasHasta, blancoNuevo,
        msg: `Acumulado compuesto (${meses.map(x => mesNombre(x.ym)).join('+')}): +${(comp * 100).toFixed(2)}%`
      }
    }
    const falt = meses.filter(x => x.val === null).map(x => mesNombre(x.ym))
    return { tipo: 'esperar', proxYM, diasHasta, msg: `Faltan datos: ${falt.join(', ')}` }
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
