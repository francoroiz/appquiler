'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, calcActualizacion, ymList, ipcAcumulado } from '@/lib/ipc'
import Link from 'next/link'

const HOY_YM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })()

// Fallback dólar blue mensual
const DOLAR_BASE: Record<string,number> = {
  '2024-05':1260,'2024-06':1490,'2024-07':1415,'2024-08':1370,'2024-09':1245,
  '2024-10':1205,'2024-11':1185,'2024-12':1200,'2025-01':1260,'2025-02':1270,
  '2025-03':1310,'2025-04':1290,'2025-05':1305,'2025-06':1320,'2025-07':1340,
  '2025-08':1365,'2025-09':1390,'2025-10':1420,'2025-11':1450,'2025-12':1490,
  '2026-01':1530,'2026-02':1570,'2026-03':1610,'2026-04':1615,
}

function saludo() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    locales: 0, deptos: 0, uruguay: 0,
    totalBlancoAR: 0, totalNegroAR: 0, totalUSD: 0,
    enMora: 0, porVencer: 0, listosActualizar: 0,
    sociaABlanco: 0, sociaBBlanco: 0, sociaANegro: 0, sociaBNegro: 0,
  })
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [dolarActual, setDolarActual] = useState<number | null>(null)
  const [dolarMonthly, setDolarMonthly] = useState<Record<string,number>>(DOLAR_BASE)
  const [sociaA, setSociaA] = useState('Socia A')
  const [sociaB, setSociaB] = useState('Socia B')
  const [todosInq, setTodosInq] = useState<any[]>([])
  const [ipcMapState, setIpcMapState] = useState<Record<string,number>>({})
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState(HOY_YM)
  const [minDesde, setMinDesde] = useState('2024-01')

  useEffect(() => {
    setSociaA(localStorage.getItem('socia_a_nombre') || 'Socia A')
    setSociaB(localStorage.getItem('socia_b_nombre') || 'Socia B')
    fetch('/api/dolar-blue').then(r => r.json()).then(d => {
      if (d.current) setDolarActual(d.current)
      if (d.monthly) setDolarMonthly(prev => ({ ...prev, ...d.monthly }))
    }).catch(() => {})
    loadStats()
  }, [])

  async function loadStats() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const uid = session.user.id
    const meta = session.user.user_metadata
    setUserName(meta?.full_name || meta?.name || session.user.email?.split('@')[0] || '')

    const [locRes, depRes, uyRes, ipcRes] = await Promise.all([
      supabase.from('inquilinos').select('*').eq('user_id', uid).eq('modulo', 'locales'),
      supabase.from('inquilinos').select('*').eq('user_id', uid).eq('modulo', 'deptos'),
      supabase.from('inquilinos_uy').select('*').eq('user_id', uid),
      supabase.from('registros_ipc').select('*').eq('user_id', uid),
    ])

    const ipcMap: Record<string,number> = {}
    ;(ipcRes.data || []).forEach((r: any) => { ipcMap[r.mes] = r.valor })
    setIpcMapState(ipcMap)

    const todos = [...(locRes.data || []), ...(depRes.data || [])]
    setTodosInq(todos)

    let totalBlanco = 0, totalNegro = 0, mora = 0, porVencer = 0, listos = 0
    let sociaABlanco = 0, sociaBBlanco = 0, sociaANegro = 0, sociaBNegro = 0

    todos.forEach((inq: any) => {
      const ba = inq.blanco_actual || inq.blanco
      const bt = ba * (inq.tiene_iva ? 1.21 : 1)
      const na = inq.negro_actual || inq.negro || 0
      totalBlanco += bt
      totalNegro += na

      const cbA = inq.cobro_blanco_socia_a !== false
      const cbB = inq.cobro_blanco_socia_b !== false
      const cnA = inq.cobro_negro_socia_a !== false
      const cnB = inq.cobro_negro_socia_b !== false
      if (cbA) sociaABlanco += cbB ? bt / 2 : bt
      if (cbB) sociaBBlanco += cbA ? bt / 2 : bt
      if (cnA) sociaANegro += cnB ? na / 2 : na
      if (cnB) sociaBNegro += cnA ? na / 2 : na

      if (bt * 0.10 * (inq.diasmora || 0) > 0) mora++

      if (inq.vencimiento) {
        const p = inq.vencimiento.split('/')
        if (p.length === 3) {
          const v = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
          const diff = Math.ceil((v.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (diff >= 0 && diff <= 90) porVencer++
        }
      }

      const act = calcActualizacion(inq.inicio, inq.periodo, inq.modalidad_ipc, ba, ipcMap)
      if (act.tipo === 'listo' || act.tipo === 'previo') listos++
    })

    const totalUSD = (uyRes.data || []).reduce((s: number, i: any) => s + (i.usd || 0), 0)

    setStats({
      locales: locRes.data?.length || 0,
      deptos: depRes.data?.length || 0,
      uruguay: uyRes.data?.length || 0,
      totalBlancoAR: totalBlanco,
      totalNegroAR: totalNegro,
      totalUSD,
      enMora: mora,
      porVencer,
      listosActualizar: listos,
      sociaABlanco, sociaBBlanco, sociaANegro, sociaBNegro,
    })
    setLoading(false)

    if (todos.length > 0) {
      const inis = todos.map((i: any) => (i.inicio || '').slice(0, 7)).filter(Boolean).sort()
      const earliest = inis[0] || HOY_YM
      setMinDesde(earliest)
      setRangoDesde(earliest)
    }
  }

  // Cálculo acumulado histórico del rango seleccionado
  const acum = useMemo(() => {
    if (!rangoDesde || !rangoHasta || rangoDesde > rangoHasta || todosInq.length === 0) return null
    const meses = ymList(rangoDesde, rangoHasta)
    if (meses.length === 0) return null

    const dolarKeys = Object.keys(dolarMonthly).sort()
    const lastDolar = dolarKeys.length > 0 ? dolarMonthly[dolarKeys[dolarKeys.length - 1]] : (dolarActual || 1425)

    let totalARS = 0, totalUSD = 0, arsA = 0, arsB = 0

    for (const ym of meses) {
      const dolarMes = dolarMonthly[ym] ?? lastDolar
      for (const inq of todosInq) {
        const inicioYM = (inq.inicio || '').slice(0, 7)
        if (!inicioYM || inicioYM > ym) continue

        const ivaF = inq.tiene_iva ? 1.21 : 1
        const blancoIniIva = inq.blanco_inicial || (inq.blanco * ivaF)
        const negroIni = inq.negro_inicial || inq.negro || 0
        const acumIPC = ipcAcumulado(inicioYM, ym, ipcMapState)
        const bt = blancoIniIva * (1 + acumIPC)
        const na = negroIni * (1 + acumIPC)
        const mes = bt + na

        totalARS += mes
        totalUSD += mes / dolarMes

        const cbA = inq.cobro_blanco_socia_a !== false
        const cbB = inq.cobro_blanco_socia_b !== false
        const cnA = inq.cobro_negro_socia_a !== false
        const cnB = inq.cobro_negro_socia_b !== false
        arsA += (cbA ? (cbB ? bt/2 : bt) : 0) + (cnA ? (cnB ? na/2 : na) : 0)
        arsB += (cbB ? (cbA ? bt/2 : bt) : 0) + (cnB ? (cnA ? na/2 : na) : 0)
      }
    }

    const usdTotal = Math.round(totalUSD)
    const ratio = totalARS > 0 ? totalUSD / totalARS : 0
    return {
      totalARS, usdTotal,
      arsA, arsB,
      usdA: Math.round(arsA * ratio),
      usdB: Math.round(arsB * ratio),
      nMeses: meses.length,
    }
  }, [rangoDesde, rangoHasta, todosInq, ipcMapState, dolarMonthly, dolarActual])

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const mesActual = new Date().getMonth() + 1
  const totalMensual = stats.totalBlancoAR + stats.totalNegroAR
  const totalMensualUSD = dolarActual && totalMensual > 0 ? Math.round(totalMensual / dolarActual) : null
  const ytdTotal = totalMensual * mesActual
  const ytdUSD = dolarActual && ytdTotal > 0 ? Math.round(ytdTotal / dolarActual) : null
  const mesNombre = new Date().toLocaleDateString('es-AR', { month: 'long' })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{saludo()}{userName ? `, ${userName}` : ''} 👋</h1>
          <p style={{ textTransform: 'capitalize' }}>{hoy}</p>
        </div>
        {dolarActual && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '8px 14px', textAlign: 'right', fontSize: 12, flexShrink: 0 }}>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>💵 Dólar Blue</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#16a34a' }}>${dolarActual.toLocaleString('es-AR')}</div>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Cargando...</p>
      ) : (
        <>
          {/* Alertas */}
          {(stats.listosActualizar > 0 || stats.enMora > 0 || stats.porVencer > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {stats.listosActualizar > 0 && (
                <div className="alert-listo" style={{ fontSize: 13 }}>
                  ✅ <strong>{stats.listosActualizar} contrato{stats.listosActualizar > 1 ? 's' : ''}</strong> listo{stats.listosActualizar > 1 ? 's' : ''} para actualizar por IPC.{' '}
                  <Link href="/dashboard/locales" style={{ color: 'inherit', fontWeight: 600 }}>Ver →</Link>
                </div>
              )}
              {stats.enMora > 0 && (
                <div className="alert-mora" style={{ fontSize: 13 }}>
                  ⚠️ <strong>{stats.enMora} inquilino{stats.enMora > 1 ? 's' : ''}</strong> en mora.
                </div>
              )}
              {stats.porVencer > 0 && (
                <div className="alert-proximo" style={{ fontSize: 13 }}>
                  📅 <strong>{stats.porVencer} contrato{stats.porVencer > 1 ? 's' : ''}</strong> vence{stats.porVencer > 1 ? 'n' : ''} en menos de 90 días.
                </div>
              )}
            </div>
          )}

          {/* KPIs mensual */}
          <div className="g3" style={{ marginBottom: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total mensual</div>
              <div className="kpi-value" style={{ color: '#111827' }}>{fmt(totalMensual)}</div>
              <div className="kpi-sub" style={{ color: '#1d4ed8' }}>Blanco: {fmt(stats.totalBlancoAR)}</div>
              {stats.totalNegroAR > 0 && <div className="kpi-sub" style={{ color: '#dc2626' }}>Negro: {fmt(stats.totalNegroAR)}</div>}
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total mensual en USD Blue</div>
              <div className="kpi-value" style={{ color: '#16a34a' }}>
                {totalMensualUSD ? `U$S ${totalMensualUSD.toLocaleString('es-AR')}` : '—'}
              </div>
              <div className="kpi-sub">{dolarActual ? `TC blue: $${dolarActual.toLocaleString('es-AR')}` : 'Sin cotización'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Uruguay (USD)</div>
              <div className="kpi-value" style={{ color: '#1a6e2e' }}>U$S {stats.totalUSD.toLocaleString('es-AR')}</div>
              <div className="kpi-sub">{stats.uruguay} propiedad{stats.uruguay !== 1 ? 'es' : ''} en UY</div>
            </div>
          </div>

          {/* KPIs acumulado año */}
          <div className="g2" style={{ marginBottom: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Acumulado {new Date().getFullYear()} ({mesActual} mes{mesActual !== 1 ? 'es' : ''})</div>
              <div className="kpi-value" style={{ color: '#111827' }}>{fmt(ytdTotal)}</div>
              <div className="kpi-sub" style={{ textTransform: 'capitalize' }}>Enero → {mesNombre}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Acumulado {new Date().getFullYear()} en USD Blue</div>
              <div className="kpi-value" style={{ color: '#16a34a' }}>
                {ytdUSD ? `U$S ${ytdUSD.toLocaleString('es-AR')}` : '—'}
              </div>
              <div className="kpi-sub">Basado en TC blue actual</div>
            </div>
          </div>

          {/* Acumulado histórico por rango */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>📅 Acumulado histórico por período</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: acum ? 16 : 0, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <label>Desde</label>
                <input type="month" value={rangoDesde} min={minDesde} max={rangoHasta || HOY_YM} onChange={e => setRangoDesde(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <label>Hasta</label>
                <input type="month" value={rangoHasta} min={rangoDesde || minDesde} max={HOY_YM} onChange={e => setRangoHasta(e.target.value)} />
              </div>
              {acum && (
                <div style={{ fontSize: 11, color: '#9ca3af', paddingBottom: 10 }}>
                  {acum.nMeses} mes{acum.nMeses !== 1 ? 'es' : ''}
                </div>
              )}
            </div>

            {acum && (
              <>
                <div className="g2" style={{ marginBottom: 14 }}>
                  <div className="kpi-card">
                    <div className="kpi-label">Total acumulado en pesos</div>
                    <div className="kpi-value" style={{ color: '#111827' }}>{fmt(acum.totalARS)}</div>
                    <div className="kpi-sub">Prom. mensual: {fmt(acum.totalARS / acum.nMeses)}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Total acumulado en USD Blue</div>
                    <div className="kpi-value" style={{ color: '#16a34a' }}>U$S {acum.usdTotal.toLocaleString('es-AR')}</div>
                    <div className="kpi-sub">TC blue promedio del período</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Distribución por socia — período</div>
                <div className="g2">
                  {([
                    { nombre: sociaA, ars: acum.arsA, usd: acum.usdA },
                    { nombre: sociaB, ars: acum.arsB, usd: acum.usdB },
                  ] as { nombre: string; ars: number; usd: number }[]).map(s => (
                    <div key={s.nombre} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.nombre}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{fmt(s.ars)}</div>
                      <div style={{ fontSize: 12, color: '#16a34a' }}>≈ U$S {s.usd.toLocaleString('es-AR')}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Socias mensual */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Distribución por socia — mensual</div>
            <div className="g2">
              {([
                { nombre: sociaA, blanco: stats.sociaABlanco, negro: stats.sociaANegro },
                { nombre: sociaB, blanco: stats.sociaBBlanco, negro: stats.sociaBNegro },
              ] as { nombre: string; blanco: number; negro: number }[]).map(s => (
                <div key={s.nombre} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.nombre}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{fmt(s.blanco + s.negro)}</div>
                  <div style={{ fontSize: 12, color: '#1d4ed8' }}>Blanco: {fmt(s.blanco)}</div>
                  {s.negro > 0 && <div style={{ fontSize: 12, color: '#dc2626' }}>Negro: {fmt(s.negro)}</div>}
                  {dolarActual && (
                    <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                      ≈ U$S {Math.round((s.blanco + s.negro) / dolarActual).toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Accesos rápidos</div>
            <div className="g3" style={{ gap: 8 }}>
              {[
                { href: '/dashboard/locales', icon: '🏪', label: 'Locales', sub: `${stats.locales} contratos` },
                { href: '/dashboard/deptos', icon: '🏠', label: 'Departamentos', sub: `${stats.deptos} contratos` },
                { href: '/dashboard/ipc', icon: '📈', label: 'Actualizar IPC', sub: 'INDEC' },
                { href: '/dashboard/uruguay', icon: '🇺🇾', label: 'Uruguay', sub: `${stats.uruguay} propiedades` },
                { href: '/dashboard/estadisticas', icon: '📉', label: 'Estadísticas', sub: 'Rendimiento real' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.sub}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
