import { NextResponse } from 'next/server'

// Tarea diaria de Vercel (ver vercel.json): hace actividad real en Supabase para que el proyecto
// gratuito no se pause por inactividad. No lee ni devuelve datos privados.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ ok: false, error: 'faltan variables de Supabase' }, { status: 500 })

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const checks = await Promise.allSettled([
    // consulta a la base (con RLS devuelve vacío para el rol anónimo, pero cuenta como actividad)
    fetch(`${url}/rest/v1/registros_ipc?select=mes&limit=1`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) }),
    fetch(`${url}/auth/v1/health`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) }),
    // precalienta el IPC automático (queda en caché) para que la primera pantalla del día no espere
    fetch(new URL('/api/ipc-auto', req.url), { cache: 'no-store', signal: AbortSignal.timeout(28000) }),
  ])
  const status = checks.map(c => (c.status === 'fulfilled' ? c.value.status : 'error'))
  const ok = checks.slice(0, 2).every(c => c.status === 'fulfilled' && c.value.status < 500)
  return NextResponse.json({ ok, db: status[0], auth: status[1], ipc: status[2], at: new Date().toISOString() }, { status: ok ? 200 : 502 })
}
