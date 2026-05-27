'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/ipc'

const CATEGORIAS = [
  'Ascensor', 'Luz común', 'Agua', 'Limpieza', 'Gas',
  'Seguro', 'Administración', 'Reparación', 'Impuesto', 'Otro'
]

interface Gasto {
  id: string
  user_id: string
  es_egreso: boolean
  tipo: 'fijo' | 'eventual'
  categoria: string
  descripcion: string
  monto: number
  fecha: string
  mes_aplicacion: string
  propiedad_id: string | null
  propiedad_nombre: string | null
  recurrente: boolean
}

interface Inquilino {
  id: string
  nombre: string
  direccion: string
}

const ymHoy = () => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

const mesLabel = (ym: string) => {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [y, m] = ym.split('-')
  return `${meses[parseInt(m) - 1]} ${y}`
}

const hoy = () => new Date().toISOString().slice(0, 10)

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [filtroMes, setFiltroMes] = useState(ymHoy())
  const [filtroPropiedad, setFiltroPropiedad] = useState('')

  const [form, setForm] = useState({
    es_egreso: true,
    tipo: 'fijo' as 'fijo' | 'eventual',
    categoria: 'Otro',
    descripcion: '',
    monto: '',
    fecha: hoy(),
    mes_aplicacion: ymHoy(),
    propiedad_id: '',
    propiedad_nombre: '',
    recurrente: false,
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const [{ data: gData }, { data: lData }, { data: dData }] = await Promise.all([
      supabase.from('gastos').select('*').eq('user_id', session.user.id).order('fecha', { ascending: false }),
      supabase.from('locales').select('id, nombre, direccion').eq('user_id', session.user.id),
      supabase.from('deptos').select('id, nombre, direccion').eq('user_id', session.user.id),
    ])

    setGastos((gData as Gasto[]) || [])
    const inqs: Inquilino[] = [
      ...((lData || []) as any[]).map(r => ({ id: r.id, nombre: r.nombre, direccion: r.direccion })),
      ...((dData || []) as any[]).map(r => ({ id: r.id, nombre: r.nombre, direccion: r.direccion })),
    ]
    setInquilinos(inqs)
    setLoading(false)
  }

  const gastosFiltrados = useMemo(() => {
    return gastos.filter(g => {
      const okMes = !filtroMes || g.mes_aplicacion === filtroMes
      const okProp = !filtroPropiedad || g.propiedad_id === filtroPropiedad
      return okMes && okProp
    })
  }, [gastos, filtroMes, filtroPropiedad])

  const egresos = gastosFiltrados.filter(g => g.es_egreso)
  const ingresos = gastosFiltrados.filter(g => !g.es_egreso)

  const totalEgresos = egresos.reduce((s, g) => s + g.monto, 0)
  const totalIngresos = ingresos.reduce((s, g) => s + g.monto, 0)
  const balance = totalIngresos - totalEgresos
  const balanceSocia = balance / 2

  const resumenCategorias = useMemo(() => {
    const map: Record<string, number> = {}
    egresos.forEach(g => {
      map[g.categoria] = (map[g.categoria] || 0) + g.monto
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [egresos])

  function handleFormChange(field: string, value: unknown) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'propiedad_id') {
        const inq = inquilinos.find(i => i.id === value)
        next.propiedad_nombre = inq ? `${inq.nombre} — ${inq.direccion}` : ''
      }
      return next
    })
  }

  async function guardar() {
    if (!form.monto || isNaN(parseFloat(form.monto))) { setError('Ingresá un monto válido'); return }
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }

    const payload = {
      user_id: session.user.id,
      es_egreso: form.es_egreso,
      tipo: form.tipo,
      categoria: form.es_egreso ? form.categoria : 'Ingreso',
      descripcion: form.descripcion,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      mes_aplicacion: form.mes_aplicacion,
      propiedad_id: form.propiedad_id || null,
      propiedad_nombre: form.propiedad_nombre || null,
      recurrente: form.recurrente,
    }

    const { error: err } = await supabase.from('gastos').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }

    setForm(f => ({ ...f, descripcion: '', monto: '', recurrente: false }))
    await loadAll()
    setSaving(false)
  }

  async function eliminar(id: string) {
    await supabase.from('gastos').delete().eq('id', id)
    setGastos(gs => gs.filter(g => g.id !== id))
  }

  if (loading) return <div style={{ padding: 32, color: '#6b7280' }}>Cargando…</div>

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>💰 Ingresos / Egresos</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Registrá gastos e ingresos por propiedad y mes.</p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Mes</label>
          <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Propiedad</label>
          <select value={filtroPropiedad} onChange={e => setFiltroPropiedad(e.target.value)}
            style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13, minWidth: 180 }}>
            <option value="">Todas</option>
            {inquilinos.map(i => <option key={i.id} value={i.id}>{i.nombre} — {i.direccion}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total ingresos', val: totalIngresos, color: '#16a34a' },
          { label: 'Total egresos', val: totalEgresos, color: '#dc2626' },
          { label: 'Balance neto', val: balance, color: balance >= 0 ? '#16a34a' : '#dc2626' },
          { label: 'c/socia', val: balanceSocia, color: balanceSocia >= 0 ? '#1d4ed8' : '#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuevo registro</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => handleFormChange('es_egreso', true)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderColor: form.es_egreso ? '#dc2626' : '#e5e7eb',
              background: form.es_egreso ? '#fee2e2' : 'white',
              color: form.es_egreso ? '#dc2626' : '#6b7280' }}>
            ⬇ Egreso
          </button>
          <button
            onClick={() => handleFormChange('es_egreso', false)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderColor: !form.es_egreso ? '#16a34a' : '#e5e7eb',
              background: !form.es_egreso ? '#dcfce7' : 'white',
              color: !form.es_egreso ? '#16a34a' : '#6b7280' }}>
            ⬆ Ingreso
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tipo</label>
            <select value={form.tipo} onChange={e => handleFormChange('tipo', e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
              <option value="fijo">Fijo</option>
              <option value="eventual">Eventual</option>
            </select>
          </div>
          {form.es_egreso && (
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Categoría</label>
              <select value={form.categoria} onChange={e => handleFormChange('categoria', e.target.value)}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Descripción</label>
          <input value={form.descripcion} onChange={e => handleFormChange('descripcion', e.target.value)}
            placeholder="Ej: Expensas, cobro alquiler…"
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Monto ($)</label>
            <input type="number" value={form.monto} onChange={e => handleFormChange('monto', e.target.value)}
              placeholder="0"
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => handleFormChange('fecha', e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Mes de aplicación</label>
            <input type="month" value={form.mes_aplicacion} onChange={e => handleFormChange('mes_aplicacion', e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Propiedad</label>
            <select value={form.propiedad_id} onChange={e => handleFormChange('propiedad_id', e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
              <option value="">— General —</option>
              {inquilinos.map(i => <option key={i.id} value={i.id}>{i.nombre} — {i.direccion}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.recurrente} onChange={e => handleFormChange('recurrente', e.target.checked)}
            style={{ width: 16, height: 16 }} />
          Recurrente (se repite cada mes)
        </label>

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button onClick={guardar} disabled={saving}
          style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Guardando…' : '+ Guardar registro'}
        </button>
      </div>

      {/* Resumen por categoría */}
      {resumenCategorias.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Egresos por categoría — {filtroMes ? mesLabel(filtroMes) : 'todos los meses'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resumenCategorias.map(([cat, total]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#374151' }}>{cat}</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista egresos */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#dc2626' }}>Egresos ({egresos.length})</div>
        {egresos.length === 0
          ? <div style={{ fontSize: 13, color: '#9ca3af' }}>Sin egresos para este filtro.</div>
          : egresos.map(g => <GastoRow key={g.id} g={g} onEliminar={() => eliminar(g.id)} />)
        }
      </div>

      {/* Lista ingresos */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#16a34a' }}>Ingresos ({ingresos.length})</div>
        {ingresos.length === 0
          ? <div style={{ fontSize: 13, color: '#9ca3af' }}>Sin ingresos para este filtro.</div>
          : ingresos.map(g => <GastoRow key={g.id} g={g} onEliminar={() => eliminar(g.id)} />)
        }
      </div>
    </div>
  )
}

function GastoRow({ g, onEliminar }: { g: Gasto; onEliminar: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: g.es_egreso ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${g.es_egreso ? '#fecaca' : '#bbf7d0'}`,
      borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13
    }}>
      <span style={{ fontSize: 15 }}>{g.es_egreso ? '⬇' : '⬆'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#111827' }}>
          {g.descripcion || g.categoria}
          {g.recurrente && <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280' }}>🔁 recurrente</span>}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          {g.categoria} · {g.tipo} · {mesLabel(g.mes_aplicacion)}
          {g.propiedad_nombre && ` · ${g.propiedad_nombre}`}
        </div>
      </div>
      <div style={{ fontWeight: 700, color: g.es_egreso ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
        {g.es_egreso ? '−' : '+'}{fmt(g.monto)}
      </div>
      <button onClick={onEliminar}
        style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
        🗑
      </button>
    </div>
  )
}
