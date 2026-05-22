'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, calcVencimiento, mesNombre } from '@/lib/ipc'
import InquilinoCard from '@/components/InquilinoCard'
import MontoInput from '@/components/MontoInput'

const EMPTY = {
  nombre: '', cuit: '', direccion: '', piso: '',
  inicio: '', anos: '', vencimiento: '',
  periodo: '3', modalidad_ipc: 'esperar',
  blanco: '', blanco_inicial: '', tiene_iva: false,
  negro: '', negro_inicial: '', diasmora: '0',
  cobro_blanco_socia_a: true, cobro_blanco_socia_b: true,
  cobro_negro_socia_a: true, cobro_negro_socia_b: true,
}

function useSociaNames() {
  const [a, setA] = useState('Socia A')
  const [b, setB] = useState('Socia B')
  useEffect(() => {
    setA(localStorage.getItem('socia_a_nombre') || 'Socia A')
    setB(localStorage.getItem('socia_b_nombre') || 'Socia B')
  }, [])
  function saveA(v: string) { setA(v); localStorage.setItem('socia_a_nombre', v) }
  function saveB(v: string) { setB(v); localStorage.setItem('socia_b_nombre', v) }
  return { a, b, saveA, saveB }
}

export default function DeptosPage() {
  const [inquilinos, setInquilinos] = useState<any[]>([])
  const [ipcExtra, setIpcExtra] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [uid, setUid] = useState('')
  const [saving, setSaving] = useState(false)
  const { a: nombreA, b: nombreB, saveA, saveB } = useSociaNames()
  const [editingNames, setEditingNames] = useState(false)
  const [tmpA, setTmpA] = useState('')
  const [tmpB, setTmpB] = useState('')

  const [pagoNegroModal, setPagoNegroModal] = useState<any | null>(null)
  const [pagosNegro, setPagosNegro] = useState<any[]>([])
  const [pagoNegroForm, setPagoNegroForm] = useState({ fecha: '', monto: '' })
  const [pagoCompletoNegro, setPagoCompletoNegro] = useState(false)

  const [pagoBlancoModal, setPagoBlancoModal] = useState<any | null>(null)
  const [pagosBlanco, setPagosBlanco] = useState<any[]>([])
  const [pagoBlancoForm, setPagoBlancoForm] = useState({ fecha: '', monto: '' })
  const [pagoCompletoBlanco, setPagoCompletoBlanco] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function openComprobante(path: string) {
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('No se pudo abrir el comprobante: ' + (error?.message || 'error'))
  }
  function parsePaths(url: string | null): string[] {
    if (!url) return []
    try { const p = JSON.parse(url); return Array.isArray(p) ? p : [url] } catch { return [url] }
  }
  function parseNames(nombre: string | null, paths: string[]): string[] {
    if (!nombre) return paths.map((_, i) => `Archivo ${i + 1}`)
    try { const n = JSON.parse(nombre); return Array.isArray(n) ? n : [nombre] } catch { return [nombre] }
  }

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
      supabase.from('inquilinos').select('*, pagos_negro(count), actualizaciones_ipc(count)')
        .eq('user_id', userId).eq('modulo', 'deptos').order('created_at'),
      supabase.from('registros_ipc').select('*').eq('user_id', userId),
    ])
    const inqs = (inqRes.data || []).map((i: any) => ({
      ...i,
      pagos_negro_count: i.pagos_negro?.[0]?.count || 0,
      pagos_blanco_count: 0,
      actualizaciones_count: i.actualizaciones_ipc?.[0]?.count || 0,
    }))
    const ids = inqs.map((i: any) => i.id)
    let lastBlancoMap: Record<string, string> = {}
    let blancoCountMap: Record<string, number> = {}
    if (ids.length > 0) {
      try {
        const { data: ultimosPagos, error } = await supabase
          .from('pagos_blanco').select('inquilino_id, fecha')
          .in('inquilino_id', ids).order('fecha', { ascending: false })
        if (!error && ultimosPagos) {
          ultimosPagos.forEach((p: any) => {
            blancoCountMap[p.inquilino_id] = (blancoCountMap[p.inquilino_id] || 0) + 1
            if (!lastBlancoMap[p.inquilino_id]) lastBlancoMap[p.inquilino_id] = p.fecha.slice(0, 7)
          })
        }
      } catch (_) { /* tabla no existe todavía */ }
    }
    setInquilinos(inqs.map((i: any) => ({
      ...i,
      pagos_blanco_count: blancoCountMap[i.id] || 0,
      ultimo_pago_blanco_mes: lastBlancoMap[i.id] || null,
    })))
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
    const payload: any = {
      user_id: uid, modulo: 'deptos',
      nombre: form.nombre, cuit: form.cuit, direccion: form.direccion,
      piso: form.piso || null,
      inicio: form.inicio, anos: parseInt(form.anos) || null,
      vencimiento: form.vencimiento || null,
      periodo: parseInt(form.periodo), modalidad_ipc: form.modalidad_ipc,
      blanco: blancoNum, blanco_actual: blancoNum,
      blanco_inicial: parseFloat(form.blanco_inicial) || blancoNum,
      tiene_iva: form.tiene_iva,
      negro: negroNum, negro_actual: negroNum,
      negro_inicial: parseFloat(form.negro_inicial) || negroNum || null,
      diasmora: parseInt(form.diasmora) || 0,
      cobro_blanco_socia_a: form.cobro_blanco_socia_a,
      cobro_blanco_socia_b: form.cobro_blanco_socia_b,
      cobro_negro_socia_a: form.cobro_negro_socia_a,
      cobro_negro_socia_b: form.cobro_negro_socia_b,
    }
    if (editId) {
      const { blanco_actual, ...rest } = payload
      await supabase.from('inquilinos').update({ ...rest, blanco: blancoNum }).eq('id', editId)
    } else {
      await supabase.from('inquilinos').insert(payload)
    }
    setSaving(false)
    setShowForm(false); setEditId(null); setForm(EMPTY)
    loadAll(uid)
  }

  function editar(inq: any) {
    setForm({
      nombre: inq.nombre, cuit: inq.cuit, direccion: inq.direccion, piso: inq.piso || '',
      inicio: inq.inicio, anos: inq.anos?.toString() || '', vencimiento: inq.vencimiento || '',
      periodo: inq.periodo.toString(), modalidad_ipc: inq.modalidad_ipc,
      blanco: inq.blanco.toString(), blanco_inicial: inq.blanco_inicial?.toString() || '',
      tiene_iva: inq.tiene_iva,
      negro: inq.negro?.toString() || '', negro_inicial: inq.negro_inicial?.toString() || '',
      diasmora: inq.diasmora?.toString() || '0',
      cobro_blanco_socia_a: inq.cobro_blanco_socia_a !== false,
      cobro_blanco_socia_b: inq.cobro_blanco_socia_b !== false,
      cobro_negro_socia_a: inq.cobro_negro_socia_a !== false,
      cobro_negro_socia_b: inq.cobro_negro_socia_b !== false,
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

  async function abrirPagosNegro(inq: any) {
    setPagoNegroModal(inq); setPagoCompletoNegro(false)
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', inq.id).order('fecha', { ascending: false })
    setPagosNegro(data || [])
  }

  async function guardarPagoNegro() {
    if (!pagoNegroForm.fecha || !pagoNegroForm.monto) { alert('Completá fecha y monto'); return }
    const { error } = await supabase.from('pagos_negro').insert({
      inquilino_id: pagoNegroModal.id, fecha: pagoNegroForm.fecha, monto: parseFloat(pagoNegroForm.monto),
    })
    if (error) { alert('Error al registrar: ' + error.message); return }
    setPagoNegroForm({ fecha: '', monto: '' }); setPagoCompletoNegro(false)
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', pagoNegroModal.id).order('fecha', { ascending: false })
    setPagosNegro(data || [])
    loadAll(uid)
  }

  async function eliminarPagoNegro(id: string) {
    if (!confirm('¿Eliminar pago?')) return
    await supabase.from('pagos_negro').delete().eq('id', id)
    const { data } = await supabase.from('pagos_negro').select('*').eq('inquilino_id', pagoNegroModal.id).order('fecha', { ascending: false })
    setPagosNegro(data || [])
    loadAll(uid)
  }

  async function abrirPagosBlanco(inq: any) {
    setPagoBlancoModal(inq); setPagoCompletoBlanco(false)
    const { data } = await supabase.from('pagos_blanco').select('*').eq('inquilino_id', inq.id).order('fecha', { ascending: false })
    setPagosBlanco(data || [])
  }

  async function guardarPagoBlanco() {
    if (!pagoBlancoForm.fecha || !pagoBlancoForm.monto) { alert('Completá fecha y monto'); return }
    setUploading(true)
    const files = fileRef.current?.files ? Array.from(fileRef.current.files) : []
    const paths: string[] = []
    const names: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${uid}/blanco/${pagoBlancoModal.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file)
      if (!upErr) { paths.push(path); names.push(file.name) }
    }
    const comprobante_url = paths.length > 0 ? JSON.stringify(paths) : null
    const comprobante_nombre = names.length > 0 ? JSON.stringify(names) : null
    const { error } = await supabase.from('pagos_blanco').insert({
      inquilino_id: pagoBlancoModal.id, fecha: pagoBlancoForm.fecha,
      monto: parseFloat(pagoBlancoForm.monto), comprobante_url, comprobante_nombre,
    })
    if (error) {
      alert('Error al registrar: ' + error.message + '\n\nSi es la primera vez, ejecutá el SQL de migración en Supabase.')
      setUploading(false); return
    }
    setPagoBlancoForm({ fecha: '', monto: '' }); setPagoCompletoBlanco(false)
    if (fileRef.current) fileRef.current.value = ''
    const { data } = await supabase.from('pagos_blanco').select('*').eq('inquilino_id', pagoBlancoModal.id).order('fecha', { ascending: false })
    setPagosBlanco(data || [])
    setUploading(false)
    loadAll(uid)
  }

  async function eliminarPagoBlanco(id: string) {
    if (!confirm('¿Eliminar pago?')) return
    await supabase.from('pagos_blanco').delete().eq('id', id)
    const { data } = await supabase.from('pagos_blanco').select('*').eq('inquilino_id', pagoBlancoModal.id).order('fecha', { ascending: false })
    setPagosBlanco(data || [])
    loadAll(uid)
  }

  const totalBlanco = inquilinos.reduce((s, i) => s + ((i.blanco_actual || i.blanco) * (i.tiene_iva ? 1.21 : 1)), 0)
  const totalNegro = inquilinos.reduce((s, i) => s + (i.negro_actual || i.negro || 0), 0)

  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  function blancoModalInfo() {
    if (!pagoBlancoModal) return null
    const ba = pagoBlancoModal.blanco_actual || pagoBlancoModal.blanco
    const bt = ba * (pagoBlancoModal.tiene_iva ? 1.21 : 1)
    const tienePago = pagoBlancoModal.ultimo_pago_blanco_mes >= mesActual
    const diasMora = diaHoy > 10 && !tienePago ? diaHoy - 10 : 0
    const montoPagado = pagosBlanco.filter((p: any) => p.fecha?.slice(0, 7) === mesActual).reduce((s: number, p: any) => s + p.monto, 0)
    return { bt, diasMora, moraDia: bt * 0.10, montoPagado, pendiente: bt - montoPagado }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🏠 Departamentos</h1>
          <p>{inquilinos.length} contrato{inquilinos.length !== 1 ? 's' : ''} · Total: {fmt(totalBlanco)}/mes{totalNegro > 0 ? ` + ${fmt(totalNegro)} negro` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setTmpA(nombreA); setTmpB(nombreB); setEditingNames(true) }}>⚙️ Socias</button>
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }}>+ Nuevo departamento</button>
        </div>
      </div>

      {editingNames && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingNames(false) }}>
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>⚙️ Nombres de socias</div>
            <div className="form-group"><label>Socia A</label><input value={tmpA} onChange={e => setTmpA(e.target.value)} /></div>
            <div className="form-group" style={{ marginTop: 10 }}><label>Socia B</label><input value={tmpB} onChange={e => setTmpB(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" onClick={() => { saveA(tmpA || 'Socia A'); saveB(tmpB || 'Socia B'); setEditingNames(false) }}>✓ Guardar</button>
              <button className="btn-secondary" onClick={() => setEditingNames(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
            {editId ? 'Editar departamento' : 'Nuevo departamento'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group"><label>Nombre y apellido *</label><input value={form.nombre} onChange={e => handleFormChange('nombre', e.target.value)} placeholder="Juan García" /></div>
            <div className="form-group"><label>CUIT / DNI *</label><input value={form.cuit} onChange={e => handleFormChange('cuit', e.target.value)} placeholder="20-12345678-9" /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Dirección *</label><input value={form.direccion} onChange={e => handleFormChange('direccion', e.target.value)} placeholder="Av. Corrientes 1234" /></div>
            <div className="form-group"><label>Piso / Unidad</label><input value={form.piso} onChange={e => handleFormChange('piso', e.target.value)} placeholder="3° B" /></div>
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
                <option value="esperar">Esperar dato del mes</option>
                <option value="previo">Meses anteriores acumulados</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Monto en blanco</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Monto base actual (ARS) *</label><MontoInput value={form.blanco} onChange={v => handleFormChange('blanco', v)} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                <input type="checkbox" id="iva2" checked={form.tiene_iva} onChange={e => handleFormChange('tiene_iva', e.target.checked)} />
                <label htmlFor="iva2" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Aplicar IVA 21%</label>
              </div>
              <div className="form-group"><label>IVA (ARS)</label><input readOnly value={ivaVal > 0 ? fmt(ivaVal) : '—'} /></div>
              <div className="form-group"><label>Total blanco + IVA</label><input readOnly value={blancoTotal > 0 ? fmt(blancoTotal) : '—'} /></div>
              <div className="form-group"><label>Monto inicial histórico (IVA inc.)</label><MontoInput value={form.blanco_inicial} onChange={v => handleFormChange('blanco_inicial', v)} placeholder="Ej: 325.000" /></div>
            </div>
            {blancoTotal > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 12px', flex: 1, fontSize: 12 }}>
                  <div style={{ color: '#1d4ed8', fontWeight: 600 }}>Total: {fmt(blancoTotal)}</div>
                </div>
                <div style={{ background: '#dcfce7', borderRadius: 8, padding: '8px 12px', flex: 1, fontSize: 12 }}>
                  <div style={{ color: '#16a34a', fontWeight: 600 }}>c/socia: {fmt(blancoTotal / 2)}</div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.cobro_blanco_socia_a} onChange={e => handleFormChange('cobro_blanco_socia_a', e.target.checked)} />Cobra {nombreA}
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.cobro_blanco_socia_b} onChange={e => handleFormChange('cobro_blanco_socia_b', e.target.checked)} />Cobra {nombreB}
              </label>
            </div>
            {(form.cobro_blanco_socia_a && !form.cobro_blanco_socia_b) && (
              <div style={{ background: '#fef3c7', borderRadius: 8, padding: '7px 12px', marginTop: 8, fontSize: 12, color: '#92400e' }}>
                ⚠️ Factura en blanco solamente <strong>{nombreA}</strong>
              </div>
            )}
            {(!form.cobro_blanco_socia_a && form.cobro_blanco_socia_b) && (
              <div style={{ background: '#fef3c7', borderRadius: 8, padding: '7px 12px', marginTop: 8, fontSize: 12, color: '#92400e' }}>
                ⚠️ Factura en blanco solamente <strong>{nombreB}</strong>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Mora manual</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Días en mora</label><input type="number" value={form.diasmora} onChange={e => handleFormChange('diasmora', e.target.value)} min="0" /></div>
              <div className="form-group"><label>Mora/día (10% total blanco)</label><input readOnly value={blancoTotal > 0 ? fmt(moraDia) : '—'} /></div>
            </div>
            {moraTot > 0 && <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Mora total: {fmt(moraTot)}</div>}
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Monto en negro</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Monto en negro actual (ARS)</label><MontoInput value={form.negro} onChange={v => handleFormChange('negro', v)} /></div>
              <div className="form-group"><label>Monto inicial histórico negro</label><MontoInput value={form.negro_inicial} onChange={v => handleFormChange('negro_inicial', v)} /></div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.cobro_negro_socia_a} onChange={e => handleFormChange('cobro_negro_socia_a', e.target.checked)} />Cobra {nombreA} (negro)
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.cobro_negro_socia_b} onChange={e => handleFormChange('cobro_negro_socia_b', e.target.checked)} />Cobra {nombreB} (negro)
              </label>
            </div>
            {negroNum > 0 && <div style={{ background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#d97706', fontWeight: 600 }}>c/socia: {fmt(negroNum / 2)}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Cargando...</p> : (
        inquilinos.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
            <p>No hay departamentos cargados aún.</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>+ Agregar primero</button>
          </div>
        ) : (
          inquilinos.map(inq => (
            <InquilinoCard
              key={inq.id} inq={inq} ipcExtra={ipcExtra} modulo="deptos"
              nombreSociaA={nombreA} nombreSociaB={nombreB}
              onEditar={() => editar(inq)}
              onEliminar={() => eliminar(inq.id)}
              onPagos={() => abrirPagosNegro(inq)}
              onPagosBlanco={() => abrirPagosBlanco(inq)}
              onAplicar={act => aplicarActualizacion(inq, act)}
            />
          ))
        )
      )}

      {pagoNegroModal && (() => {
        const na = pagoNegroModal.negro_actual || pagoNegroModal.negro || 0
        const cA = pagoNegroModal.cobro_negro_socia_a !== false
        const cB = pagoNegroModal.cobro_negro_socia_b !== false
        const montoPorSocia = (cA && cB) ? na / 2 : na
        const totalAcumNegro = pagosNegro.reduce((s: number, p: any) => s + p.monto, 0)
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPagoNegroModal(null) }}>
            <div className="modal-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>💵 Pagos negro — {pagoNegroModal.nombre}</div>
                <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setPagoNegroModal(null)}>✕</button>
              </div>
              {pagosNegro.length > 0 && (
                <div style={{ background: '#fef3c7', borderRadius: 8, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: '#92400e', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total acumulado registrado</span><strong>{fmt(totalAcumNegro)}</strong>
                </div>
              )}
              {pagosNegro.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Sin pagos registrados.</p> : (
                <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
                  {pagosNegro.map(p => (
                    <div key={p.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 13 }}>{fmt(p.monto)}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{p.fecha}</div>
                      </div>
                      <button className="btn-danger" style={{ fontSize: 11 }} onClick={() => eliminarPagoNegro(p.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div className="form-group"><label>Fecha *</label><input type="date" value={pagoNegroForm.fecha} onChange={e => setPagoNegroForm(p => ({ ...p, fecha: e.target.value }))} /></div>
                  <div className="form-group"><label>Monto *</label><MontoInput value={pagoNegroForm.monto} onChange={v => { setPagoCompletoNegro(false); setPagoNegroForm(p => ({ ...p, monto: v })) }} /></div>
                </div>
                {montoPorSocia > 0 && (
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer', color: '#374151' }}>
                    <input type="checkbox" checked={pagoCompletoNegro} onChange={e => {
                      setPagoCompletoNegro(e.target.checked)
                      if (e.target.checked) setPagoNegroForm(p => ({ ...p, monto: Math.round(montoPorSocia).toString() }))
                    }} />
                    Monto total a cobrar ({fmt(montoPorSocia)})
                  </label>
                )}
                <button className="btn-primary" onClick={guardarPagoNegro}>✓ Registrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {pagoBlancoModal && (() => {
        const info = blancoModalInfo()
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPagoBlancoModal(null) }}>
            <div className="modal-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>🏦 Pagos blanco — {pagoBlancoModal.nombre}</div>
                <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setPagoBlancoModal(null)}>✕</button>
              </div>
              {info && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>Esperado</div>
                    <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13 }}>{fmt(info.bt)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>Pagado este mes</div>
                    <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>{fmt(info.montoPagado)}</div>
                  </div>
                  <div style={{ background: info.pendiente > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>Pendiente</div>
                    <div style={{ fontWeight: 700, color: info.pendiente > 0 ? '#c2410c' : '#16a34a', fontSize: 13 }}>{fmt(Math.max(0, info.pendiente))}</div>
                  </div>
                  <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>Total acumulado</div>
                    <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>{fmt(pagosBlanco.reduce((s: number, p: any) => s + p.monto, 0))}</div>
                  </div>
                </div>
              )}
              {info && info.diasMora > 0 && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#c2410c' }}>
                  🔴 Mora automática: <strong>{info.diasMora} días</strong> desde el 10 · {fmt(info.moraDia * info.diasMora)}
                </div>
              )}
              {pagosBlanco.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Sin pagos registrados.</p> : (
                <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
                  {pagosBlanco.map(p => {
                    const paths = parsePaths(p.comprobante_url)
                    const names = parseNames(p.comprobante_nombre, paths)
                    return (
                      <div key={p.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 13 }}>{fmt(p.monto)}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{p.fecha}</div>
                          {paths.map((path, i) => (
                            <button key={i} onClick={() => openComprobante(path)}
                              style={{ fontSize: 11, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}>
                              📎 {names[i]}
                            </button>
                          ))}
                        </div>
                        <button className="btn-danger" style={{ fontSize: 11 }} onClick={() => eliminarPagoBlanco(p.id)}>🗑</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div className="form-group"><label>Fecha *</label><input type="date" value={pagoBlancoForm.fecha} onChange={e => setPagoBlancoForm(p => ({ ...p, fecha: e.target.value }))} /></div>
                  <div className="form-group"><label>Monto *</label><MontoInput value={pagoBlancoForm.monto} onChange={v => { setPagoCompletoBlanco(false); setPagoBlancoForm(p => ({ ...p, monto: v })) }} /></div>
                </div>
                {info && info.pendiente > 0 && (
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer', color: '#374151' }}>
                    <input type="checkbox" checked={pagoCompletoBlanco} onChange={e => {
                      setPagoCompletoBlanco(e.target.checked)
                      if (e.target.checked && info) setPagoBlancoForm(p => ({ ...p, monto: Math.round(info.pendiente).toString() }))
                    }} />
                    Monto total pendiente ({fmt(info.pendiente)})
                  </label>
                )}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label>Comprobantes (imágenes o PDF — podés seleccionar varios)</label>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ fontSize: 12 }} />
                </div>
                <button className="btn-primary" disabled={uploading} onClick={guardarPagoBlanco}>
                  {uploading ? 'Subiendo...' : '✓ Registrar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
