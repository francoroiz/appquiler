'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, calcVencimiento, mesNombre } from '@/lib/ipc'
import InquilinoCard from '@/components/InquilinoCard'

const EMPTY = {
  nombre: '', cuit: '', direccion: '', rubro: '',
  inicio: '', anos: '', vencimiento: '',
  periodo: '3', modalidad_ipc: 'esperar',
  blanco: '', tiene_iva: false, negro: '', diasmora: '0',
}

export default function LocalesPage() {
  const [inquilinos, setInquilinos] = useState<any[]>([])
  const [ipcExtra, setIpcExtra] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [uid, setUid] = useState('')
  const [pagoModal, setPagoModal] = useState<any | null>(null)
  const [pagos, setPagos] = useState<any[]>([])
  const [pagoForm, setPagoForm] = useState({ fecha: '', monto: '' })
  const [saving, setSaving] = useState(false)

  // Calculated fields
  const blancoNum = parseFloat(form.blanco) || 0
  const ivaVal = form.tiene_iva ? blancoNum * 0.21 : 0
  const blancoTotal = blancoNum + ivaVal
  const moraDia = blancoTotal * 0.10
  const moraTot = moraDia * (parseInt(form.diasmora) || 0)
  const negroNum = parseFloat(form.negro) || 0

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUid(data.session.user.id); loadAll(data.session.user.id) }
    })
  }, [])

  async function loadAll(userId: string) {
    const [inqRes, ipcRes] = await Promise.all([
      supabase.from('inquilinos').select('*').eq('user_id', userId).eq('modulo', 'locales').order('created_at'),
      supabase.from('registros_ipc').select('*').eq('user_id', userId),
    ])
    setInquilinos(inqRes.data || [])
    const map: Record<string, number> = {}
    ;(ipcRes.data || []).forEach((r: any) => { map[r.mes] = r.valor })
    setIpcExtra(map)
    setLoading(false)
  }

  function handleFormChange(field: string, value: any) {
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
    if (!form.nombre || !form.cuit || !form.direccion || !form.inicio || !form.blanco) {
      alert('Completá los campos obligatorios (*)'); return
    }
    setSaving(true)
    const payload = {
      user_id: uid, modulo: 'locales',
      nombre: form.nombre, cuit: form.cuit, direccion: form.direccion,
      rubro: form.rubro || null,
      inicio: form.inicio, anos: parseInt(form.anos) || null,
      vencimiento: form.vencimiento || null,
      periodo: parseInt(form.periodo), modalidad_ipc: form.modalidad_ipc,
      blanco: blancoNum, blanco_actual: blancoNum,
      tiene_iva: form.tiene_iva, negro: negroNum, negro_actual: negroNum,
      diasmora: parseInt(form.diasmora) || 0,
    }
    if (editId) {
      await supabase.from('inquilinos').update(payload).eq('id', editId)
    } else {
      await supabase.from('inquilinos').insert(payload)
    }
    setSaving(false)
    setShowForm(false); setEditId(null); setForm(EMPTY)
    loadAll(uid)
  }

  function editar(inq: any) {
    setForm({
      nombre: inq.nombre, cuit: inq.cuit, direccion: inq.direccion, rubro: inq.rubro || '',
      inicio: inq.inicio, anos: inq.anos?.toString() || '', vencimiento: inq.vencimiento || '',
      periodo: inq.periodo.toString(), modalidad_ipc: inq.modalidad_ipc,
      blanco: inq.blanco.toString(), tiene_iva: inq.tiene_iva, negro: inq.negro?.toString() || '',
      diasmora: inq.diasmora?.toString() || '0',
    })
    setEditId(inq.id); setShowForm(true)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este inquilino?')) return
    await supabase.from('inquilinos').delete().eq('id', id)
    loadAll(uid)
  }

  async function aplicarActualizacion(inq: any, act: any) {
    const pct = act.tipo === 'previo' ? act.ipcComp : act.ipc
    const bN = act.blancoNuevo
    const nN = (inq.negro_actual || inq.negro || 0) * (1 + pct / 100)
    await Promise.all([
      supabase.from('inquilinos').update({ blanco_actual: bN, negro_actual: nN }).eq('id', inq.id),
      supabase.from('actualizaciones_ipc').insert({
        inquilino_id: inq.id, periodo: mesNombre(act.proxYM),
        ipc: parseFloat(pct.toFixed(2)), blanco_nuevo: bN, negro_nuevo: nN,
        fecha: new Date().toLocaleDateString('es-AR')
      })
    ])
    alert(`✓ Actualización aplicada\nIPC: +${pct.toFixed(2)}%\nNuevo base: ${fmt(bN)}`)
    loadAll(uid)
  }

  async function abrirPagos(inq: any) {
    setPagoModal(inq)
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', inq.id).order('fecha', { ascending: false })
    setPagos(data || [])
  }

  async function guardarPago() {
    if (!pagoForm.fecha || !pagoForm.monto) { alert('Completá fecha y monto'); return }
    await supabase.from('pagos_negro').insert({
      inquilino_id: pagoModal.id,
      fecha: pagoForm.fecha,
      monto: parseFloat(pagoForm.monto),
    })
    setPagoForm({ fecha: '', monto: '' })
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', pagoModal.id).order('fecha', { ascending: false })
    setPagos(data || [])
    loadAll(uid)
  }

  async function eliminarPago(id: string) {
    if (!confirm('¿Eliminar pago?')) return
    await supabase.from('pagos_negro').delete().eq('id', id)
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', pagoModal.id).order('fecha', { ascending: false })
    setPagos(data || [])
    loadAll(uid)
  }

  const totalBlanco = inquilinos.reduce((s, i) => s + ((i.blanco_actual || i.blanco) * (i.tiene_iva ? 1.21 : 1)), 0)
  const totalNegro = inquilinos.reduce((s, i) => s + (i.negro_actual || i.negro || 0), 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🏪 Locales comerciales</h1>
          <p>{inquilinos.length} contrato{inquilinos.length !== 1 ? 's' : ''} · Total: {fmt(totalBlanco)}/mes{totalNegro > 0 ? ` + ${fmt(totalNegro)} negro` : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }}>
          + Nuevo local
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
            {editId ? 'Editar local' : 'Nuevo local comercial'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group"><label>Nombre y apellido *</label><input value={form.nombre} onChange={e => handleFormChange('nombre', e.target.value)} placeholder="Juan García" /></div>
            <div className="form-group"><label>CUIT / DNI *</label><input value={form.cuit} onChange={e => handleFormChange('cuit', e.target.value)} placeholder="20-12345678-9" /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Dirección *</label><input value={form.direccion} onChange={e => handleFormChange('direccion', e.target.value)} placeholder="Av. Corrientes 1234" /></div>
            <div className="form-group"><label>Rubro</label><input value={form.rubro} onChange={e => handleFormChange('rubro', e.target.value)} placeholder="Gastronomía, Ropa..." /></div>
            <div className="form-group"><label>Fecha inicio *</label><input type="date" value={form.inicio} onChange={e => handleFormChange('inicio', e.target.value)} /></div>
            <div className="form-group"><label>Duración (años)</label><input type="number" value={form.anos} onChange={e => handleFormChange('anos', e.target.value)} placeholder="2" min="1" /></div>
            <div className="form-group"><label>Vencimiento (calculado)</label><input readOnly value={form.vencimiento} placeholder="—" /></div>
            <div className="form-group"><label>Período de actualización</label>
              <select value={form.periodo} onChange={e => handleFormChange('periodo', e.target.value)}>
                <option value="3">Trimestral (3 meses)</option>
                <option value="6">Semestral (6 meses)</option>
                <option value="12">Anual</option>
              </select>
            </div>
            <div className="form-group"><label>Modalidad IPC</label>
              <select value={form.modalidad_ipc} onChange={e => handleFormChange('modalidad_ipc', e.target.value)}>
                <option value="esperar">Esperar dato del mes (Olobardi / De Mula)</option>
                <option value="previo">Meses anteriores acumulados (Credicoop)</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Monto en blanco</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Monto base (ARS) *</label><input type="number" value={form.blanco} onChange={e => handleFormChange('blanco', e.target.value)} placeholder="0" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                <input type="checkbox" id="iva" checked={form.tiene_iva} onChange={e => handleFormChange('tiene_iva', e.target.checked)} />
                <label htmlFor="iva" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Aplicar IVA 21%</label>
              </div>
              <div className="form-group"><label>IVA (ARS)</label><input readOnly value={ivaVal > 0 ? fmt(ivaVal) : '—'} /></div>
              <div className="form-group"><label>Total blanco + IVA</label><input readOnly value={blancoTotal > 0 ? fmt(blancoTotal) : '—'} /></div>
            </div>
            {blancoTotal > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 12px', flex: 1, fontSize: 12 }}>
                  <div style={{ color: '#1d4ed8', fontWeight: 600 }}>Total en blanco: {fmt(blancoTotal)}</div>
                </div>
                <div style={{ background: '#dcfce7', borderRadius: 8, padding: '8px 12px', flex: 1, fontSize: 12 }}>
                  <div style={{ color: '#16a34a', fontWeight: 600 }}>c/socia: {fmt(blancoTotal / 2)}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Mora</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Días en mora</label><input type="number" value={form.diasmora} onChange={e => handleFormChange('diasmora', e.target.value)} min="0" /></div>
              <div className="form-group"><label>Mora/día (10% total blanco)</label><input readOnly value={blancoTotal > 0 ? fmt(moraDia) : '—'} /></div>
            </div>
            {moraTot > 0 && <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Mora total: {fmt(moraTot)}</div>}
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Monto en negro</div>
            <div className="form-group" style={{ maxWidth: 300 }}><label>Monto en negro (ARS)</label><input type="number" value={form.negro} onChange={e => handleFormChange('negro', e.target.value)} placeholder="0" /></div>
            {negroNum > 0 && <div style={{ background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#d97706', fontWeight: 600 }}>c/socia: {fmt(negroNum / 2)}</div>}
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
            <p>No hay locales cargados aún.</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>+ Agregar primero</button>
          </div>
        ) : (
          inquilinos.map(inq => (
            <InquilinoCard
              key={inq.id} inq={inq} ipcExtra={ipcExtra} modulo="locales"
              onEditar={() => editar(inq)}
              onEliminar={() => eliminar(inq.id)}
              onPagos={() => abrirPagos(inq)}
              onAplicar={act => aplicarActualizacion(inq, act)}
            />
          ))
        )
      )}

      {/* Modal pagos negro */}
      {pagoModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPagoModal(null) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>💵 Pagos negro — {pagoModal.nombre}</div>
              <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setPagoModal(null)}>✕</button>
            </div>

            {pagos.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Sin pagos registrados.</p> : (
              <div style={{ marginBottom: 16 }}>
                {pagos.map(p => (
                  <div key={p.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 13 }}>{fmt(p.monto)}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{p.fecha}</div>
                      {p.comprobante_nombre && <div style={{ fontSize: 11, color: '#1d4ed8' }}>📎 {p.comprobante_nombre}</div>}
                    </div>
                    <button className="btn-danger" style={{ fontSize: 11 }} onClick={() => eliminarPago(p.id)}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Registrar pago</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div className="form-group"><label>Fecha *</label><input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(p => ({ ...p, fecha: e.target.value }))} /></div>
                <div className="form-group"><label>Monto (ARS) *</label><input type="number" value={pagoForm.monto} onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))} placeholder="0" /></div>
              </div>
              <button className="btn-primary" onClick={guardarPago}>✓ Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
