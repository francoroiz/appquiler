'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcVencimiento, vencimientoStatus } from '@/lib/ipc'

const EMPTY = { nombre: '', documento: '', direccion: '', tipo: 'Apartamento', inicio: '', anos: '', vencimiento: '', usd: '', diasmora: '0' }

export default function UruguayPage() {
  const [inquilinos, setInquilinos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState('')
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxTs, setFxTs] = useState('')
  const [fxManual, setFxManual] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUid(data.session.user.id); loadData(data.session.user.id) }
    })
    fetchFX()
  }, [])

  async function fetchFX() {
    try {
      const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const d = await r.json()
      if (d.rates?.UYU) {
        setFxRate(d.rates.UYU)
        setFxTs(new Date().toLocaleString('es-AR'))
      }
    } catch { setFxRate(null) }
  }

  async function loadData(userId: string) {
    const { data } = await supabase.from('inquilinos_uy').select('*').eq('user_id', userId).order('created_at')
    setInquilinos(data || [])
    setLoading(false)
  }

  function handleChange(field: string, value: any) {
    setForm((prev: any) => {
      const next = { ...prev, [field]: value }
      if (field === 'inicio' || field === 'anos') {
        const ini = field === 'inicio' ? value : prev.inicio
        const anos = parseInt(field === 'anos' ? value : prev.anos) || 0
        if (ini && anos) next.vencimiento = calcVencimiento(ini, anos)
      }
      return next
    })
  }

  async function guardar() {
    if (!form.nombre || !form.direccion || !form.inicio || !form.usd) { alert('Completá los campos obligatorios (*)'); return }
    setSaving(true)
    const payload = {
      user_id: uid, nombre: form.nombre, documento: form.documento || null,
      direccion: form.direccion, tipo: form.tipo,
      inicio: form.inicio, anos: parseInt(form.anos) || null,
      vencimiento: form.vencimiento || null,
      usd: parseFloat(form.usd), diasmora: parseInt(form.diasmora) || 0,
    }
    if (editId) await supabase.from('inquilinos_uy').update(payload).eq('id', editId)
    else await supabase.from('inquilinos_uy').insert(payload)
    setSaving(false); setShowForm(false); setEditId(null); setForm(EMPTY)
    loadData(uid)
  }

  function editar(inq: any) {
    setForm({ nombre: inq.nombre, documento: inq.documento || '', direccion: inq.direccion, tipo: inq.tipo, inicio: inq.inicio, anos: inq.anos?.toString() || '', vencimiento: inq.vencimiento || '', usd: inq.usd.toString(), diasmora: inq.diasmora?.toString() || '0' })
    setEditId(inq.id); setShowForm(true)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('inquilinos_uy').delete().eq('id', id)
    loadData(uid)
  }

  const fmtUYU = (n: number) => '$U ' + Math.round(n).toLocaleString('es-UY')
  const fmtUSD = (n: number) => 'U$S ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const totalUSD = inquilinos.reduce((s, i) => s + (i.usd || 0), 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🇺🇾 Uruguay</h1>
          <p>{inquilinos.length} propiedad{inquilinos.length !== 1 ? 'es' : ''} · Total: {fmtUSD(totalUSD)}/mes</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }}>+ Nueva propiedad</button>
      </div>

      {/* Cotización FX */}
      <div style={{ background: '#f0f7e6', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🇺🇾</span>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Cotización USD → UYU</div>
            {fxRate ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a6e2e' }}>1 USD = {fxRate.toFixed(2)} UYU</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Actualizado: {fxTs}</div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <input type="number" value={fxManual} onChange={e => setFxManual(e.target.value)} placeholder="Ej: 43.50" style={{ width: 100, fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { const v = parseFloat(fxManual); if (v > 0) { setFxRate(v); setFxTs('Ingresado manualmente') } }}>Usar</button>
              </div>
            )}
          </div>
        </div>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={fetchFX}>🔄 Actualizar cotización</button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{editId ? 'Editar propiedad' : 'Nueva propiedad en Uruguay'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group"><label>Nombre y apellido *</label><input value={form.nombre} onChange={e => handleChange('nombre', e.target.value)} /></div>
            <div className="form-group"><label>Cédula / RUT</label><input value={form.documento} onChange={e => handleChange('documento', e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Dirección *</label><input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} placeholder="Av. 18 de Julio 1234, Montevideo" /></div>
            <div className="form-group"><label>Tipo de inmueble</label>
              <select value={form.tipo} onChange={e => handleChange('tipo', e.target.value)}>
                <option>Apartamento</option><option>Casa</option><option>Local comercial</option><option>Otro</option>
              </select>
            </div>
            <div className="form-group"><label>Fecha inicio *</label><input type="date" value={form.inicio} onChange={e => handleChange('inicio', e.target.value)} /></div>
            <div className="form-group"><label>Duración (años)</label><input type="number" value={form.anos} onChange={e => handleChange('anos', e.target.value)} placeholder="2" /></div>
            <div className="form-group"><label>Vencimiento (calculado)</label><input readOnly value={form.vencimiento} placeholder="—" /></div>
            <div className="form-group"><label>Días en mora</label><input type="number" value={form.diasmora} onChange={e => handleChange('diasmora', e.target.value)} min="0" /></div>
          </div>
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Monto del alquiler</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Monto fijo en USD *</label><input type="number" value={form.usd} onChange={e => handleChange('usd', e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label>Equivalente en UYU (hoy)</label><input readOnly value={fxRate && form.usd ? fmtUYU(parseFloat(form.usd) * fxRate) : '—'} /></div>
            </div>
            {fxRate && parseFloat(form.usd) > 0 && (
              <div style={{ background: '#f0f7e6', borderRadius: 8, padding: '8px 12px', marginTop: 8, color: '#1a6e2e', fontWeight: 600, fontSize: 13 }}>
                Total: {fmtUYU(parseFloat(form.usd) * fxRate)} · Cotización: 1 USD = {fxRate.toFixed(2)} UYU
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Cargando...</p> : (
        inquilinos.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🇺🇾</div>
            <p>No hay propiedades en Uruguay.</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>+ Agregar primera</button>
          </div>
        ) : (
          inquilinos.map(inq => {
            const uyu = fxRate ? inq.usd * fxRate : null
            const vs = vencimientoStatus(inq.vencimiento || '')
            return (
              <div key={inq.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>🇺🇾 {inq.nombre}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{inq.documento ? inq.documento + ' · ' : ''}{inq.direccion}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span className="badge badge-uy">{inq.tipo}</span>
                    <span className={`badge ${(inq.diasmora || 0) > 0 ? 'badge-red' : 'badge-green'}`}>{(inq.diasmora || 0) > 0 ? 'En mora' : 'Al día'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                  <span>📅 {inq.inicio}</span>
                  {inq.anos && <span>⏳ {inq.anos} año{inq.anos > 1 ? 's' : ''}</span>}
                  <span>💱 {fxRate ? `1 USD = ${fxRate.toFixed(2)} UYU` : 'Sin cotización'}</span>
                </div>
                {vs && <div className={`alert-${vs.cls}`} style={{ marginBottom: 8, fontSize: 12 }}>📅 {vs.txt}</div>}
                {(inq.diasmora || 0) > 0 && <div className="alert-mora">⚠️ {inq.diasmora} día{inq.diasmora > 1 ? 's' : ''} en mora</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div className="monto-box">
                    <div className="lbl" style={{ color: '#1a6e2e' }}>Monto fijo (USD)</div>
                    <div className="val" style={{ color: '#1a6e2e' }}>{fmtUSD(inq.usd)}</div>
                    <div className="sub">Monto base del contrato</div>
                  </div>
                  <div className="monto-box">
                    <div className="lbl" style={{ color: '#1a6e2e' }}>Equivalente (UYU)</div>
                    {uyu ? <div className="val" style={{ color: '#1a6e2e' }}>{fmtUYU(uyu)}</div> : <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Sin cotización</div>}
                    {uyu && <div className="sub">Cotización del día</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => editar(inq)}>✏️ Editar</button>
                  <button className="btn-danger" style={{ fontSize: 12 }} onClick={() => eliminar(inq.id)}>🗑 Eliminar</button>
                </div>
              </div>
            )
          })
        )
      )}
    </div>
  )
}
