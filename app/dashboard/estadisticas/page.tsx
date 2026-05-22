'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { IPC_FIJO, ymList, ipcAcumulado, fmt } from '@/lib/ipc'

const DOLAR: Record<string,number> = { '2024-05':896,'2024-06':908,'2024-07':927,'2024-08':944,'2024-09':963,'2024-10':982,'2024-11':1005,'2024-12':1031,'2025-01':1053,'2025-02':1073,'2025-03':1088,'2025-04':1092,'2025-05':1100,'2025-06':1115,'2025-07':1130,'2025-08':1150,'2025-09':1170,'2025-10':1190,'2025-11':1220,'2025-12':1270,'2026-01':1320,'2026-02':1360,'2026-03':1390,'2026-04':1390 }
const ASADO: Record<string,number> = { '2024-05':7200,'2024-06':7400,'2024-07':7445,'2024-08':7500,'2024-09':7600,'2024-10':7878,'2024-11':8200,'2024-12':9500,'2025-01':10500,'2025-02':11000,'2025-03':11500,'2025-04':11800,'2025-05':12000,'2025-06':12200,'2025-07':12500,'2025-08':12800,'2025-09':13000,'2025-10':13300,'2025-11':13700,'2025-12':14200,'2026-01':14800,'2026-02':15200,'2026-03':15800,'2026-04':10500 }
const NAFTA: Record<string,number> = { '2024-05':1100,'2024-06':1180,'2024-07':1260,'2024-08':1340,'2024-09':1380,'2024-10':1420,'2024-11':1500,'2024-12':1580,'2025-01':1650,'2025-02':1720,'2025-03':1820,'2025-04':1916,'2025-05':1850,'2025-06':1880,'2025-07':1920,'2025-08':1960,'2025-09':2000,'2025-10':2050,'2025-11':2100,'2025-12':2150,'2026-01':2180,'2026-02':2207,'2026-03':2117,'2026-04':2200 }
const CBT: Record<string,number> = { '2024-05':595000,'2024-06':630000,'2024-07':660000,'2024-08':690000,'2024-09':720000,'2024-10':740000,'2024-11':760000,'2024-12':790000,'2025-01':815000,'2025-02':840000,'2025-03':880000,'2025-04':910000,'2025-05':930000,'2025-06':950000,'2025-07':975000,'2025-08':1000000,'2025-09':1025000,'2025-10':1055000,'2025-11':1090000,'2025-12':1125000,'2026-01':1162000,'2026-02':1196000,'2026-03':1237000,'2026-04':1270000 }

const HOY = '2026-04'
const mN = (ym: string) => { const ms=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; const [,m]=ym.split('-'); return ms[parseInt(m)-1]+' '+ym.slice(2) }

export default function EstadisticasPage() {
  const [inquilinos, setInquilinos] = useState<any[]>([])
  const [selIdx, setSelIdx] = useState<string>('__todos__')
  const [montoInicial, setMontoInicial] = useState('500000')
  const [montoInicialNegro, setMontoInicialNegro] = useState('')
  const [inicio, setInicio] = useState('2024-05')
  const [ipcExtra, setIpcExtra] = useState<Record<string,number>>({})
  const [tieneIva, setTieneIva] = useState(false)
  const [serie, setSerie] = useState<any[]>([])
  const [serieNegro, setSerieNegro] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      const uid = data.session.user.id
      Promise.all([
        supabase.from('inquilinos').select('*').eq('user_id', uid),
        supabase.from('registros_ipc').select('*').eq('user_id', uid)
      ]).then(([inqRes, ipcRes]) => {
        setInquilinos(inqRes.data || [])
        const map: Record<string,number> = {}
        ;(ipcRes.data || []).forEach((r: any) => { map[r.mes] = r.valor })
        setIpcExtra(map)
        setLoading(false)
        calcular(500000, '2024-05', map)
      })
    })
  }, [])

  function onSelChange(val: string) {
    setSelIdx(val)
    if (val !== '__todos__') {
      const inq = inquilinos[parseInt(val)]
      if (inq) {
        const bi = inq.blanco_inicial || inq.blanco
        setMontoInicial(bi.toString())
        setMontoInicialNegro((inq.negro_inicial || inq.negro || '').toString())
        setInicio(inq.inicio ? inq.inicio.slice(0, 7) : '2024-05')
        setTieneIva(!!inq.tiene_iva)
      }
    } else {
      setTieneIva(false)
    }
  }

  function calcular(monto?: number, ini?: string, ipcEx?: Record<string,number>, negro?: number, ivaFlag?: boolean) {
    const m = monto ?? (parseFloat(montoInicial) || 0)
    const mN2 = negro ?? (parseFloat(montoInicialNegro) || 0)
    const i = ini ?? inicio
    const ex = (ipcEx ?? ipcExtra)
    const iva = ivaFlag ?? tieneIva
    const ivaF = iva ? 1.21 : 1
    if (!m) return
    const meses = ymList(i, HOY)
    const data = meses.map(ym => {
      const acum = ipcAcumulado(i, ym, ex)
      const montoAct = m * (1 + acum) * ivaF
      const dolar = DOLAR[ym] || 1390
      return {
        mes: mN(ym), ym,
        monto: Math.round(montoAct),
        montoFijo: Math.round(m * ivaF),
        usd: Math.round(montoAct / dolar),
        kg: parseFloat((montoAct / (ASADO[ym] || 10000)).toFixed(1)),
        lts: Math.round(montoAct / (NAFTA[ym] || 2000)),
        cb: parseFloat((montoAct / (CBT[ym] || 1000000)).toFixed(2)),
        ipcAcum: parseFloat((acum * 100).toFixed(1))
      }
    })
    setSerie(data)

    if (mN2 > 0) {
      const dataN = meses.map(ym => {
        const acum = ipcAcumulado(i, ym, ex)
        const montoAct = mN2 * (1 + acum)
        const dolar = DOLAR[ym] || 1390
        return { mes: mN(ym), ym, monto: Math.round(montoAct), montoFijo: Math.round(mN2), usd: Math.round(montoAct / dolar), ipcAcum: parseFloat((acum * 100).toFixed(1)) }
      })
      setSerieNegro(dataN)
    } else {
      setSerieNegro([])
    }
  }

  const ini = serie[0]
  const act = serie[serie.length - 1]

  return (
    <div>
      <div className="page-header">
        <h1>📉 Estadísticas de rendimiento</h1>
        <p>Evolución real del alquiler: inflación, poder adquisitivo y rendimiento en USD</p>
      </div>

      {/* Selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Inquilino / simulación libre</label>
            <select value={selIdx} onChange={e => onSelChange(e.target.value)}>
              <option value="__todos__">— Simulación manual —</option>
              {inquilinos.map((inq, i) => <option key={inq.id} value={i}>{inq.nombre} — {inq.direccion}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Monto inicial blanco (base, sin IVA)</label>
            <input type="number" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} placeholder="500000" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 18 }}>
            <input type="checkbox" id="iva-est" checked={tieneIva} onChange={e => setTieneIva(e.target.checked)} />
            <label htmlFor="iva-est" style={{ fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Aplica IVA 21%</label>
          </div>
          <div className="form-group">
            <label>Monto inicial negro</label>
            <input type="number" value={montoInicialNegro} onChange={e => setMontoInicialNegro(e.target.value)} placeholder="0 (opcional)" />
          </div>
          <div className="form-group">
            <label>Mes de inicio</label>
            <input type="month" value={inicio} onChange={e => setInicio(e.target.value)} min="2024-01" max="2026-04" />
          </div>
          <button className="btn-primary" style={{ height: 36 }} onClick={() => calcular()}>▶ Calcular</button>
        </div>
        {selIdx !== '__todos__' && inquilinos[parseInt(selIdx)] && (() => {
          const inq = inquilinos[parseInt(selIdx)]
          const bi = inq.blanco_inicial || inq.blanco
          const biIva = bi * (inq.tiene_iva ? 1.21 : 1)
          const ni = inq.negro_inicial || inq.negro || 0
          return (
            <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', display: 'flex', gap: 16 }}>
              <span>📋 Monto inicial blanco cargado: <strong style={{ color: '#1d4ed8' }}>${Math.round(bi).toLocaleString('es-AR')}</strong>{inq.tiene_iva && <span style={{ color: '#7c3aed' }}> → con IVA: ${Math.round(biIva).toLocaleString('es-AR')}</span>}</span>
              {ni > 0 && <span>📋 Monto inicial negro: <strong style={{ color: '#dc2626' }}>${Math.round(ni).toLocaleString('es-AR')}</strong></span>}
              {!inq.blanco_inicial && <span style={{ color: '#f59e0b' }}>⚠️ Sin monto inicial histórico — se usa el base actual. Editá el contrato para cargarlo.</span>}
            </div>
          )
        })()}
      </div>

      {serie.length > 1 && ini && act && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Monto blanco actualizado', val: fmt(act.monto), sub: `Inicial: ${fmt(parseFloat(montoInicial))}`, delta: `▲ +${act.ipcAcum}% acumulado`, dColor: '#1d4ed8' },
              { label: 'Equivalente en USD', val: `U$S ${act.usd.toLocaleString('es-AR')}`, sub: `Inicio: U$S ${ini.usd.toLocaleString('es-AR')}`, delta: `${act.usd >= ini.usd ? '▲' : '▼'} ${((act.usd/ini.usd - 1)*100).toFixed(1)}% en USD`, dColor: act.usd >= ini.usd ? '#16a34a' : '#dc2626' },
              { label: 'Kg de asado equiv.', val: `${act.kg} kg`, sub: `Inicio: ${ini.kg} kg`, delta: `${act.kg >= ini.kg ? '▲' : '▼'} ${((act.kg/ini.kg - 1)*100).toFixed(1)}%`, dColor: act.kg >= ini.kg ? '#16a34a' : '#dc2626' },
              { label: 'Canastas básicas', val: `${act.cb} CB`, sub: `Inicio: ${ini.cb} CB (4 pers.)`, delta: `${act.cb >= ini.cb ? '▲' : '▼'} ${((act.cb/ini.cb - 1)*100).toFixed(1)}%`, dColor: act.cb >= ini.cb ? '#16a34a' : '#dc2626' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize: 18, color: '#111827' }}>{k.val}</div>
                <div className="kpi-sub">{k.sub}</div>
                <div className="kpi-delta" style={{ color: k.dColor }}>{k.delta}</div>
              </div>
            ))}
          </div>

          {/* Negro KPI + chart si hay negro */}
          {serieNegro.length > 1 && (() => {
            const iniN = serieNegro[0]; const actN = serieNegro[serieNegro.length - 1]
            return (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid #dc2626' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#dc2626' }}>💰 Negro — evolución histórica</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="kpi-card">
                    <div className="kpi-label">Monto negro inicial</div>
                    <div className="kpi-value" style={{ fontSize: 16, color: '#dc2626' }}>{fmt(iniN.monto)}</div>
                    <div className="kpi-sub">{iniN.mes}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Monto negro actualizado</div>
                    <div className="kpi-value" style={{ fontSize: 16, color: '#dc2626' }}>{fmt(actN.monto)}</div>
                    <div className="kpi-sub">{actN.mes}</div>
                    <div className="kpi-delta" style={{ color: '#1d4ed8' }}>▲ +{actN.ipcAcum}% acumulado</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Variación en USD</div>
                    <div className="kpi-value" style={{ fontSize: 16, color: actN.usd >= iniN.usd ? '#16a34a' : '#dc2626' }}>U$S {actN.usd.toLocaleString('es-AR')}</div>
                    <div className="kpi-sub">Inicio: U$S {iniN.usd.toLocaleString('es-AR')}</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={serieNegro}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => '$'+Math.round(v/1000)+'k'} />
                    <Tooltip formatter={(v: any) => '$'+Math.round(v).toLocaleString('es-AR')} />
                    <Line type="monotone" dataKey="monto" stroke="#dc2626" strokeWidth={2} dot={false} name="Negro c/ IPC" />
                    <Line type="monotone" dataKey="montoFijo" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Sin actualizar" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {/* Monto ARS */}
            <div className="card" style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📈 Blanco ARS actualizado vs. sin actualizar</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '$'+Math.round(v/1000)+'k'} />
                  <Tooltip formatter={(v: any) => '$'+Math.round(v).toLocaleString('es-AR')} />
                  <Line type="monotone" dataKey="monto" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Con IPC" />
                  <Line type="monotone" dataKey="montoFijo" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Sin actualizar" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* USD */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💵 Rendimiento en USD</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => 'U$S'+v} />
                  <Tooltip formatter={(v: any) => 'U$S ' + v} />
                  <Line type="monotone" dataKey="usd" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Kg asado */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🥩 Kg de asado equivalentes</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v+'kg'} />
                  <Tooltip formatter={(v: any) => v + ' kg'} />
                  <Bar dataKey="kg" fill="#16a34a" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Nafta */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>⛽ Litros de nafta premium</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v+'L'} />
                  <Tooltip formatter={(v: any) => v + ' litros'} />
                  <Bar dataKey="lts" fill="#1d4ed8" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Canastas */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🛒 Canastas básicas (4 personas)</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v+' CB'} />
                  <Tooltip formatter={(v: any) => v + ' canastas'} />
                  <Line type="monotone" dataKey="cb" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📋 Resumen por trimestre</div>
              <div style={{ overflowY: 'auto', maxHeight: 200 }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead><tr>{['Mes','ARS','USD','Asado','Nafta'].map(h => <th key={h} style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {serie.filter((_, i) => i === 0 || i % 3 === 0 || i === serie.length - 1).map(s => (
                      <tr key={s.ym}>
                        <td style={{ padding: '5px 6px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>{s.mes}</td>
                        <td style={{ padding: '5px 6px', borderBottom: '1px solid #f3f4f6', color: '#1d4ed8' }}>{fmt(s.monto)}</td>
                        <td style={{ padding: '5px 6px', borderBottom: '1px solid #f3f4f6', color: '#16a34a' }}>U$S{s.usd}</td>
                        <td style={{ padding: '5px 6px', borderBottom: '1px solid #f3f4f6' }}>{s.kg}kg</td>
                        <td style={{ padding: '5px 6px', borderBottom: '1px solid #f3f4f6' }}>{s.lts}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {serie.length <= 1 && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📉</div>
          <p>Ingresá un monto inicial y hacé clic en Calcular para ver el análisis.</p>
        </div>
      )}
    </div>
  )
}
