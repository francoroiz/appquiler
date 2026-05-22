'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, calcActualizacion, mesNombre } from '@/lib/ipc'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    locales: 0, deptos: 0, uruguay: 0,
    totalBlancoAR: 0, totalNegroAR: 0, totalUSD: 0,
    enMora: 0, porVencer: 0, listosActualizar: 0
  })
  const [loading, setLoading] = useState(true)
  const [ipcExtra, setIpcExtra] = useState<Record<string,number>>({})

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const uid = session.user.id
    const [locRes, depRes, uyRes, ipcRes] = await Promise.all([
      supabase.from('inquilinos').select('*').eq('user_id', uid).eq('modulo', 'locales'),
      supabase.from('inquilinos').select('*').eq('user_id', uid).eq('modulo', 'deptos'),
      supabase.from('inquilinos_uy').select('*').eq('user_id', uid),
      supabase.from('registros_ipc').select('*').eq('user_id', uid),
    ])

    const ipcMap: Record<string,number> = {}
    ;(ipcRes.data || []).forEach((r: any) => { ipcMap[r.mes] = r.valor })
    setIpcExtra(ipcMap)

    const todos = [...(locRes.data || []), ...(depRes.data || [])]
    let totalBlanco = 0, totalNegro = 0, mora = 0, porVencer = 0, listos = 0

    todos.forEach((inq: any) => {
      const ba = inq.blanco_actual || inq.blanco
      const bt = ba * (inq.tiene_iva ? 1.21 : 1)
      totalBlanco += bt
      totalNegro += inq.negro_actual || inq.negro || 0

      const moraMonto = bt * 0.10 * (inq.diasmora || 0)
      if (moraMonto > 0) mora++

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
      listosActualizar: listos
    })
    setLoading(false)
  }

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <div className="page-header">
        <h1>Buen día 👋</h1>
        <p style={{ textTransform: 'capitalize' }}>{hoy}</p>
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

          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total mensual (blanco + IVA)</div>
              <div className="kpi-value" style={{ color: '#1d4ed8' }}>{fmt(stats.totalBlancoAR)}</div>
              <div className="kpi-sub">{stats.locales} locales · {stats.deptos} deptos</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total mensual en negro</div>
              <div className="kpi-value" style={{ color: '#dc2626' }}>{stats.totalNegroAR > 0 ? fmt(stats.totalNegroAR) : '—'}</div>
              <div className="kpi-sub">Pagos informales registrados</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Uruguay (USD)</div>
              <div className="kpi-value" style={{ color: '#1a6e2e' }}>U$S {stats.totalUSD.toLocaleString('es-AR')}</div>
              <div className="kpi-sub">{stats.uruguay} propiedad{stats.uruguay !== 1 ? 'es' : ''} en UY</div>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Accesos rápidos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { href: '/dashboard/locales', icon: '🏪', label: 'Locales', sub: `${stats.locales} contratos` },
                { href: '/dashboard/deptos', icon: '🏠', label: 'Departamentos', sub: `${stats.deptos} contratos` },
                { href: '/dashboard/ipc', icon: '📈', label: 'Actualizar IPC', sub: 'INDEC' },
                { href: '/dashboard/uruguay', icon: '🇺🇾', label: 'Uruguay', sub: `${stats.uruguay} propiedades` },
                { href: '/dashboard/estadisticas', icon: '📉', label: 'Estadísticas', sub: 'Rendimiento real' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 14px', background: '#f9fafb', border: '1px solid #e5e7eb',
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 10
                  }}>
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
