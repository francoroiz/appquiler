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
  { href: '/dashboard/gastos', label: 'Ingresos / Egresos', icon: '💰' },
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

  const NavLinks = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item, i) => {
          if ('section' in item) return <div key={i} className="nav-section">{item.section}</div>
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`nav-item ${isActive(item.href!, item.exact) ? 'active' : ''}`}
              onClick={onClose}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#6b7280', padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
          ↩ Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar desktop */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-logo"><span>🏢</span> Appquiler</div>
        <NavLinks />
      </aside>

      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <div className="sidebar-logo" style={{ margin: 0, fontSize: 17 }}><span>🏢</span> Appquiler</div>
        <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menú">
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      <div className={`drawer-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      {/* Mobile drawer */}
      <div className={`mobile-drawer${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ marginBottom: '1.5rem' }}><span>🏢</span> Appquiler</div>
        <NavLinks onClose={() => setMenuOpen(false)} />
      </div>

      {/* Main content */}
      <main className="main-wrap" style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxWidth: 'calc(100vw - 220px)', paddingTop: '2rem' }}>
        {children}
      </main>
    </div>
  )
}
