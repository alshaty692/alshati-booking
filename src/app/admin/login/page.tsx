'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError('البريد الإلكتروني أو كلمة المرور غير صحيحة'); return }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏟️</div>
          <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.25rem' }}>لوحة تحكم الإدارة</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>مركز حي الشاطئ</p>
        </div>

        <form onSubmit={handleLogin} id="admin-login-form">
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
              البريد الإلكتروني
            </label>
            <input id="admin-email" type="email" className="input" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
              كلمة المرور
            </label>
            <input id="admin-password" type="password" className="input" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.875rem',
              borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem',
              borderRight: '3px solid #ef4444' }}>
              {error}
            </div>
          )}

          <button id="btn-admin-login" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> جاري الدخول...</> : 'دخول →'}
          </button>
        </form>
      </div>

      <style>{`
        .admin-login-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
        .admin-login-card { width: 100%; max-width: 400px; padding: 2rem; }
      `}</style>
    </div>
  )
}
