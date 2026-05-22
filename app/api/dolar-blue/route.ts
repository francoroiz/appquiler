import { NextResponse } from 'next/server'

export const revalidate = 3600 // cache 1 hora

export async function GET() {
  try {
    const [histRes, curRes] = await Promise.all([
      fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/blue'),
      fetch('https://dolarapi.com/v1/dolares/blue'),
    ])

    if (!histRes.ok || !curRes.ok) throw new Error('API error')

    const hist: { fecha: string; compra: number; venta: number }[] = await histRes.json()
    const cur: { compra: number; venta: number; fechaActualizacion: string } = await curRes.json()

    // Promedio mensual del precio de venta
    const byMonth: Record<string, number[]> = {}
    for (const entry of hist) {
      const ym = entry.fecha.slice(0, 7) // "YYYY-MM"
      if (!byMonth[ym]) byMonth[ym] = []
      byMonth[ym].push(entry.venta)
    }
    const monthly: Record<string, number> = {}
    for (const [ym, vals] of Object.entries(byMonth)) {
      monthly[ym] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
    }

    return NextResponse.json({
      monthly,
      current: Math.round(cur.venta),
      updated: cur.fechaActualizacion,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo obtener el dólar blue' }, { status: 500 })
  }
}
