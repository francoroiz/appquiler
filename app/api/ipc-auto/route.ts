import { NextResponse } from 'next/server'
import { fetchIpcAuto } from '@/lib/ipcAuto'

// Datos públicos de inflación (no hay información privada). Se cachea en el borde 6 horas.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const data = await fetchIpcAuto()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' },
    })
  } catch (e) {
    return NextResponse.json(
      { monthly: {}, index: {}, sources: {}, log: [String((e as Error)?.message ?? e)], fetchedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
