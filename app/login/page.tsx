'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Usuario o contraseña incorrectos.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f8f9fa', padding: '1rem'
    }}>
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 16,
        padding: '2.5rem', width: '100%', maxWidth: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a56db', margin: 0 }}>Appquiler</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Gestión de alquileres
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
              borderRadius: 8, padding: '8px 12px', fontSize: 13
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ justifyContent: 'center', marginTop: 4, padding: '10px 16px', fontSize: 14 }}
            disabled={loading}
          >
            {loading ? 'Ingresando...' : '→ Ingresar'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>
          Para solicitar acceso contactá al administrador.
        </p>
      </div>
    </div>
  )
}
