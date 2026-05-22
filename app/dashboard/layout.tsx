'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', label: 'Inicio', icon: '📊', exact: true },
  { section: 'Argentina' },
  { href: '/dashboard/locales', label: 'Locales comerciales', icon: '🏪' },
  { href: '/dashboard/deptos', label: 'Departamentos', icon: '🏠' },
  { href: '/dashboard/ipc', label: 'Actualizar IPC', icon: '📈' },
  { section: 'Internacional' },
  { href: '/dashboard/uruguay', label: 'Uruguay', icon: '🇺🇾' },
  { section: 'Análisis' },
  { href: '/dashboard/estadisticas', label: 'Estadísticas', icon: '📉' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
      else setUserEmail(data.session.user.email || '')
    })
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar desktop */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-logo">
          <span>🏢</span> Appquiler
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item, i) => {
            if ('section' in item) {
              return <div key={i} className="nav-section">{item.section}</div>
            }
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`nav-item ${isActive(item.href!, item.exact) ? 'active' : ''}`}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8,
          display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail}
          </div>
          <button
            onClick={logout}
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '6px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxWidth: 'calc(100vw - 220px)' }}>
        {children}
      </main>
    </div>
  )
}
