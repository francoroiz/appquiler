'use client'
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
  const ba = inq.blanco_actual || inq.blanco
  const bt = ba * (inq.tiene_iva ? 1.21 : 1)
  const na = inq.negro_actual || inq.negro || 0
  const moraDia = bt * 0.10
  const mora = moraDia * (inq.diasmora || 0)
  const vs = vencimientoStatus(inq.vencimiento || '')
  const act = calcActualizacion(inq.inicio, inq.periodo, inq.modalidad_ipc, ba, ipcExtra)
  const nPagosNegro = inq.pagos_negro_count || 0
  const nPagosBlanco = inq.pagos_blanco_count || 0

  // Cobra socias (default true si no está seteado)
  const cbA = inq.cobro_blanco_socia_a !== false
  const cbB = inq.cobro_blanco_socia_b !== false
  const cnA = inq.cobro_negro_socia_a !== false
  const cnB = inq.cobro_negro_socia_b !== false

  // Solo una socia cobra en blanco → advertencia
  const soloUnaSociaBlanco = (cbA && !cbB) || (!cbA && cbB)
  const sociaUnicaBlanco = cbA ? nombreSociaA : nombreSociaB

  // Mora automática blanco: después del día 10 sin pago blanco del mes
  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const tienePagoBlancoPendiente = !inq.ultimo_pago_blanco_mes || inq.ultimo_pago_blanco_mes < mesActual
  const diasMoraBlanco = diaHoy > 10 && tienePagoBlancoPendiente ? diaHoy - 10 : 0
  const moraBlanco = moraDia * diasMoraBlanco

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{inq.nombre}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{inq.cuit} · {inq.direccion}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {inq.tiene_iva && <span className="badge badge-blue">IVA</span>}
          <span className={`badge ${(mora > 0 || moraBlanco > 0) ? 'badge-red' : 'badge-green'}`}>
            {(mora > 0 || moraBlanco > 0) ? 'En mora' : 'Al día'}
          </span>
          {(inq.actualizaciones_count || 0) > 0 && <span className="badge badge-blue">{inq.actualizaciones_count} act.</span>}
          {nPagosNegro > 0 && <span className="badge badge-amber">{nPagosNegro} pag.negro</span>}
          {nPagosBlanco > 0 && <span className="badge badge-blue">{nPagosBlanco} pag.blanco</span>}
        </div>
      </div>

      {/* Info chips */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 8, flexWrap: 'wrap' }}>
        <span>📅 Inicio: {inq.inicio}</span>
        <span>🔄 Cada {inq.periodo} meses</span>
        {inq.anos && <span>⏳ {inq.anos} año{inq.anos > 1 ? 's' : ''}</span>}
        {modulo === 'locales' && inq.rubro && <span>🏷 {inq.rubro}</span>}
        {modulo === 'deptos' && inq.piso && <span>🚪 {inq.piso}</span>}
        <span>📋 {inq.modalidad_ipc === 'previo' ? 'Meses anteriores' : 'Esperar mes'}</span>
      </div>

      {/* Advertencia socia única blanco */}
      {soloUnaSociaBlanco && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: '#92400e' }}>
          ⚠️ Factura en blanco solamente <strong>{sociaUnicaBlanco}</strong>
        </div>
      )}

      {/* Vencimiento */}
      {vs && (
        <div className={`alert-${vs.cls}`} style={{ marginBottom: 8 }}>
          📅 {vs.txt}
        </div>
      )}

      {/* Mora manual */}
      {mora > 0 && (
        <div className="alert-mora">
          ⚠️ Mora acumulada: <strong>{fmt(mora)}</strong> ({inq.diasmora} día{inq.diasmora > 1 ? 's' : ''} × {fmt(moraDia)}/día)
        </div>
      )}

      {/* Mora automática blanco */}
      {moraBlanco > 0 && mora === 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: '#c2410c' }}>
          🔴 Sin pago blanco — mora automática: <strong>{fmt(moraBlanco)}</strong> ({diasMoraBlanco} días desde el 10)
        </div>
      )}

      {/* Alerta IPC */}
      {act.tipo === 'listo' && (
        <div className="alert-listo" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>✅ Lista para actualizar</div>
          <div style={{ fontSize: 12 }}>{act.msg} · En {act.diasHasta} días</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Nuevo monto: {fmt(act.blancoNuevo)}</div>
          <button className="btn-primary" style={{ marginTop: 8, fontSize: 12, padding: '5px 12px' }} onClick={() => onAplicar(act)}>
            ✓ Aplicar actualización
          </button>
        </div>
      )}
      {act.tipo === 'previo' && (
        <div className="alert-previo" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>🔢 Lista (acumulado compuesto)</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div className="monto-box">
          <div className="lbl" style={{ color: '#16a34a' }}>{nombreSociaA} (blanco)</div>
          {cbA ? (
            <div className="val" style={{ color: '#16a34a' }}>
              {cbB ? fmt(bt / 2) : fmt(bt)}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No cobra</div>
          )}
        </div>
        <div className="monto-box">
          <div className="lbl" style={{ color: '#16a34a' }}>{nombreSociaB} (blanco)</div>
          {cbB ? (
            <div className="val" style={{ color: '#16a34a' }}>
              {cbA ? fmt(bt / 2) : fmt(bt)}
            </div>
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

      {/* Footer buttons */}
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
  )
}
