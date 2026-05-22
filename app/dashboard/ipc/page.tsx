'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { IPC_FIJO, IPC_CALENDARIO, mesNombre } from '@/lib/ipc'

const MESES_MOSTRAR = [
  '2025-10','2025-11','2025-12',
  '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'
]

export default function IPCPage() {
  const [uid, setUid] = useState('')
  const [ipcExtra, setIpcExtra] = useState<Record<string,number>>({})
  const [historial, setHistorial] = useState<any[]>([])
  const [form, setForm] = useState({ mes: '', valor: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUid(data.session.user.id); loadData(data.session.user.id) }
    })
  }, [])

  async function loadData(userId: string) {
    const [ipcRes, histRes] = await Promise.all([
      supabase.from('registros_ipc').select('*').eq('user_id', userId),
      supabase.from('actualizaciones_ipc').select('*, inquilinos(nombre)').order('created_at', { ascending: false }).limit(30)
    ])
    const map: Record<string,number> = {}
    ;(ipcRes.data || []).forEach((r: any) => { map[r.mes] = r.valor })
    setIpcExtra(map)
    setHistorial(histRes.data || [])
    setLoading(false)
  }

  async function cargarIPC() {
    if (!form.mes || !form.valor) { alert('Ingresá el mes y el valor'); return }
    const val = parseFloat(form.valor)
    if (isNaN(val) || val <= 0) { alert('Valor inválido'); return }
    setSaving(true)
    await supabase.from('registros_ipc').upsert({ user_id: uid, mes: form.mes, valor: val }, { onConflict: 'user_id,mes' })
    setForm({ mes: '', valor: '' })
    loadData(uid)
    setSaving(false)
  }

  const allIPC = { ...IPC_FIJO, ...ipcExtra }

  return (
    <div>
      <div className="page-header">
        <h1>📈 Actualización por IPC — INDEC</h1>
        <p>Base de datos de variaciones mensuales del Índice de Precios al Consumidor</p>
      </div>

      {/* Grid de meses */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Datos IPC por mes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {MESES_MOSTRAR.map(ym => {
            const val = allIPC[ym]
            const cal = IPC_CALENDARIO[ym]
            const confirmado = val !== undefined
            return (
              <div key={ym} style={{
                background: confirmado ? '#dcfce7' : '#f9fafb',
                border: `1px solid ${confirmado ? '#86efac' : '#e5e7eb'}`,
                borderRadius: 8, padding: '10px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{mesNombre(ym)}</div>
                {confirmado ? (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>+{val}%</div>
                    <div style={{ fontSize: 9, color: '#16a34a', marginTop: 2 }}>✓ Confirmado</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Pendiente</div>
                    {cal && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>~{cal}</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Cargar nuevo dato */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Cargar nuevo dato IPC
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Mes / Año</label>
              <input type="month" value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Variación IPC (%)</label>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="Ej: 2.58" />
            </div>
            <button className="btn-primary" onClick={cargarIPC} disabled={saving} style={{ height: 36 }}>
              {saving ? 'Guardando...' : '✓ Guardar'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            💡 El INDEC publica el IPC alrededor de la segunda semana de cada mes. Próxima publicación: IPC mayo 2026 el <strong>11 jun 2026</strong>.
          </div>
        </div>
      </div>

      {/* Historial de actualizaciones aplicadas */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Historial de actualizaciones aplicadas
        </div>
        {loading ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Cargando...</p> :
          historial.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Sin actualizaciones aplicadas aún.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha','Inquilino','Período','IPC aplicado','Nuevo monto blanco'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h: any) => (
                    <tr key={h.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{h.fecha}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>{h.inquilinos?.nombre || '—'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{h.periodo}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#16a34a', fontWeight: 600 }}>+{h.ipc}%</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#1d4ed8' }}>${Math.round(h.blanco_nuevo).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  )
}
