'use client'
import { useState } from 'react'
import { fmt, calcActualizacion, vencimientoStatus } from '@/lib/ipc'

interface Props {
  inq: any
  ipcExtra: Record<string, number>
  onEditar: () => void
  onEliminar: () => void
  onPagos: () => void
  onPagosBlanco: () => void
  onAplicar: (act: any) => void
  modulo: 'locales' | 'deptos'
  nombreSociaA: string
  nombreSociaB: string
}

export default function InquilinoCard({ inq, ipcExtra, onEditar, onEliminar, onPagos, onPagosBlanco, onAplicar, modulo, nombreSociaA, nombreSociaB }: Props) {
  const [open, setOpen] = useState(false)

  const ba = inq.blanco_actual || inq.blanco
  const bt = ba * (inq.tiene_iva ? 1.21 : 1)
  const na = inq.negro_actual || inq.negro || 0
  const soloNegro = ba === 0 && na > 0
  const moraDia = soloNegro ? na * 0.10 : bt * 0.10
  const mora = moraDia * (inq.diasmora || 0)
  const vs = vencimientoStatus(inq.vencimiento || '')
  const act = calcActualizacion(inq.inicio, inq.periodo, inq.modalidad_ipc, ba, ipcExtra, na)
  const nPagosNegro = inq.pagos_negro_count || 0
  const nPagosBlanco = inq.pagos_blanco_count || 0

  const cbA = inq.cobro_blanco_socia_a !== false
  const cbB = inq.cobro_blanco_socia_b !== false
  const cnA = inq.cobro_negro_socia_a !== false
  const cnB = inq.cobro_negro_socia_b !== false
  const soloUnaSociaBlanco = (cbA && !cbB) || (!cbA && cbB)
  const sociaUnicaBlanco = cbA ? nombreSociaA : nombreSociaB

  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const tienePagoBlancoPendiente = !inq.ultimo_pago_blanco_mes || inq.ultimo_pago_blanco_mes < mesActual
  const diasMoraBlanco = diaHoy > 10 && tienePagoBlancoPendiente ? diaHoy - 10 : 0
  const moraBlanco = moraDia * diasMoraBlanco
  const enMora = mora > 0 || moraBlanco > 0

  const actLabel = (act.tipo === 'listo' || act.tipo === 'previo')
    ? '✅ Lista para actualizar'
    : act.tipo === 'esperar'
    ? `⏳ Act. en ${act.diasHasta}d`
    : null

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header — siempre visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{inq.nombre}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{inq.cuit} · {inq.direccion}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', marginLeft: 8 }}>
          {inq.tiene_iva && <span className="badge badge-blue">IVA</span>}
          <span className={`badge ${enMora ? 'badge-red' : 'badge-green'}`}>
            {enMora ? 'En mora' : 'Al día'}
          </span>
          {(inq.actualizaciones_count || 0) > 0 && <span className="badge badge-blue">{inq.actualizaciones_count} act.</span>}
          {nPagosNegro > 0 && <span className="badge badge-amber">{nPagosNegro} pag.negro</span>}
          {nPagosBlanco > 0 && <span className="badge badge-blue">{nPagosBlanco} pag.blanco</span>}
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background: open ? '#f3f4f6' : 'white',
              border: '1px solid #e5e7eb', borderRadius: 6,
              padding: '3px 10px', cursor: 'pointer', fontSize: 11,
              color: '#6b7280', marginLeft: 4, fontWeight: 700,
              lineHeight: 1.4
            }}
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Resumen colapsado */}
      {!open && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
          <span>
            <span style={{ color: '#6b7280' }}>Total: </span>
            <strong style={{ color: '#111827' }}>{fmt(bt + na)}</strong>
          </span>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <span>
            <span style={{ color: '#6b7280' }}>Blanco: </span>
            <strong style={{ color: '#1d4ed8' }}>{fmt(bt)}</strong>
          </span>
          {na > 0 && (
            <span>
              <span style={{ color: '#6b7280' }}>+ Negro: </span>
              <strong style={{ color: '#dc2626' }}>{fmt(na)}</strong>
            </span>
          )}
          {actLabel && (
            <>
              <span style={{ color: '#e5e7eb' }}>|</span>
              <span style={{ color: act.tipo !== 'esperar' ? '#16a34a' : '#6b7280', fontWeight: act.tipo !== 'esperar' ? 600 : 400 }}>
                {actLabel}
              </span>
            </>
          )}
          {vs && (
            <>
              <span style={{ color: '#e5e7eb' }}>|</span>
              <span style={{ color: '#6b7280' }}>📅 {vs.txt}</span>
            </>
          )}
          {enMora && (
            <>
              <span style={{ color: '#e5e7eb' }}>|</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ En mora</span>
            </>
          )}
        </div>
      )}

      {/* Contenido expandido */}
      {open && (
        <div style={{ marginTop: 12 }}>
          {/* Info chips */}
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 8, flexWrap: 'wrap' }}>
            <span>📅 Inicio: {inq.inicio}</span>
            <span>🔄 Cada {inq.periodo} meses</span>
            {inq.anos && <span>⏳ {inq.anos} año{inq.anos > 1 ? 's' : ''}</span>}
            {modulo === 'locales' && inq.rubro && <span>🏷 {inq.rubro}</span>}
            {modulo === 'deptos' && inq.piso && <span>🚪 {inq.piso}</span>}
            <span>📋 {inq.modalidad_ipc === 'previo' ? 'Meses anteriores' : 'Esperar mes'}</span>
          </div>

          {soloUnaSociaBlanco && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: '#92400e' }}>
              ⚠️ Factura en blanco solamente <strong>{sociaUnicaBlanco}</strong>
            </div>
          )}

          {vs && (
            <div
              className={vs.cls === 'vencido' ? undefined : `alert-${vs.cls}`}
              style={vs.cls === 'vencido' ? {
                background: '#fee2e2', border: '1px solid #f87171', borderRadius: 8,
                padding: '7px 12px', marginBottom: 8, fontSize: 12,
                color: '#b91c1c', fontWeight: 600
              } : { marginBottom: 8 }}
            >
              {vs.cls === 'vencido' ? '🔴' : '📅'} {vs.txt}
            </div>
          )}

          {mora > 0 && (
            <div className="alert-mora">
              ⚠️ Mora acumulada: <strong>{fmt(mora)}</strong> ({inq.diasmora} día{inq.diasmora > 1 ? 's' : ''} × {fmt(moraDia)}/día)
            </div>
          )}

          {moraBlanco > 0 && mora === 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: '#c2410c' }}>
              🔴 Sin pago blanco — mora automática: <strong>{fmt(moraBlanco)}</strong> ({diasMoraBlanco} días desde el 10)
            </div>
          )}

          {act.tipo === 'listo' && (
            <div className="alert-listo" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>✅ {soloNegro ? 'Lista para actualizar (negro)' : 'Lista para actualizar'}</div>
              <div style={{ fontSize: 12 }}>{act.msg} · En {act.diasHasta} días</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Nuevo monto: {fmt(act.blancoNuevo)}</div>
              <button className="btn-primary" style={{ marginTop: 8, fontSize: 12, padding: '5px 12px' }} onClick={() => onAplicar(act)}>
                ✓ Aplicar actualización
              </button>
            </div>
          )}
          {act.tipo === 'previo' && (
            <div className="alert-previo" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>🔢 {soloNegro ? 'Lista para actualizar (negro)' : 'Lista (acumulado compuesto)'}</div>
              <div style={{ fontSize: 12 }}>{act.msg} · En {act.diasHasta} días</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Nuevo monto: {fmt(act.blancoNuevo)}</div>
              <button className="btn-primary" style={{ marginTop: 8, fontSize: 12, padding: '5px 12px' }} onClick={() => onAplicar(act)}>
                ✓ Aplicar actualización
              </button>
            </div>
          )}
          {act.tipo === 'esperar' && (
            <div className="alert-esperar" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>⏳ Próxima actualización en {act.diasHasta} días</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{act.msg}</div>
            </div>
          )}

          {/* Montos */}
          <div className="g3" style={{ marginBottom: 8 }}>
            <div className="monto-box">
              <div className="lbl">Base blanco</div>
              <div className="val">{fmt(ba)}</div>
              {(inq.actualizaciones_count || 0) > 0 && <div className="sub">Orig: {fmt(inq.blanco)}</div>}
            </div>
            {inq.tiene_iva ? (
              <div className="monto-box">
                <div className="lbl" style={{ color: '#1d4ed8' }}>+IVA → Total</div>
                <div className="val" style={{ color: '#1d4ed8' }}>{fmt(bt)}</div>
                <div className="sub">IVA: {fmt(ba * 0.21)}</div>
              </div>
            ) : (
              <div className="monto-box">
                <div className="lbl">IVA</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Sin IVA</div>
              </div>
            )}
            {na > 0 ? (
              <div className="monto-box">
                <div className="lbl" style={{ color: '#dc2626' }}>En negro</div>
                <div className="val" style={{ color: '#dc2626' }}>{fmt(na)}</div>
                {(inq.actualizaciones_count || 0) > 0 && <div className="sub">Orig: {fmt(inq.negro)}</div>}
              </div>
            ) : (
              <div className="monto-box">
                <div className="lbl">En negro</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>—</div>
              </div>
            )}
          </div>

          {/* División socias */}
          <div className="g3" style={{ marginBottom: 12 }}>
            <div className="monto-box">
              <div className="lbl" style={{ color: '#16a34a' }}>{nombreSociaA} (blanco)</div>
              {cbA ? (
                <div className="val" style={{ color: '#16a34a' }}>{cbB ? fmt(bt / 2) : fmt(bt)}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No cobra</div>
              )}
            </div>
            <div className="monto-box">
              <div className="lbl" style={{ color: '#16a34a' }}>{nombreSociaB} (blanco)</div>
              {cbB ? (
                <div className="val" style={{ color: '#16a34a' }}>{cbA ? fmt(bt / 2) : fmt(bt)}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No cobra</div>
              )}
            </div>
            {na > 0 ? (
              <div className="monto-box">
                <div className="lbl" style={{ color: '#d97706' }}>c/socia negro</div>
                <div className="val" style={{ color: '#d97706' }}>
                  {cnA && cnB ? fmt(na / 2) : cnA || cnB ? fmt(na) : '—'}
                </div>
                {!(cnA && cnB) && (cnA || cnB) && (
                  <div className="sub">{cnA ? nombreSociaA : nombreSociaB} solo</div>
                )}
              </div>
            ) : (
              <div className="monto-box">
                <div className="lbl">c/socia negro</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>—</div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f3f4f6', paddingTop: 10, flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onEditar}>✏️ Editar</button>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '5px 12px', color: '#1d4ed8', borderColor: '#93c5fd', background: '#eff6ff' }}
              onClick={onPagosBlanco}
            >
              🏦 Pagos blanco{nPagosBlanco > 0 ? ` (${nPagosBlanco})` : ''}
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '5px 12px', color: '#d97706', borderColor: '#fcd34d', background: '#fef3c7' }}
              onClick={onPagos}
            >
              💵 Pagos negro{nPagosNegro > 0 ? ` (${nPagosNegro})` : ''}
            </button>
            <button className="btn-danger" style={{ fontSize: 12 }} onClick={onEliminar}>🗑 Eliminar</button>
          </div>
        </div>
      )}
    </div>
  )
}
