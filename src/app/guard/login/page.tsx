'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import GuardThemeToggle from '@/components/guard/GuardThemeToggle'

export default function GuardLoginPage() {
  const router  = useRouter()
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pin.trim()) { setError('أدخل الـ PIN'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/guard/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin: pin.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'PIN غير صحيح')
        setPin('')
        inputRef.current?.focus()
        return
      }
      router.replace('/guard')
    } catch {
      setError('حدث خطأ في الاتصال — حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glogin-page">
      <GuardThemeToggle />
      <div className="glogin-card animate-fade-in">
        {/* رأس الكرت */}
        <div className="glogin-header">
          <div className="glogin-icon">
            <ShieldCheck size={30} strokeWidth={1.5} />
          </div>
          <h1 className="glogin-title">شاشة الملاعب</h1>
          <p className="glogin-sub">مركز حي الشاطئ — الدخول بـ PIN</p>
        </div>

        {/* النموذج */}
        <form onSubmit={handleSubmit} id="guard-login-form" className="glogin-form">
          <div className="glogin-field">
            <label htmlFor="guard-pin" className="glogin-label">
              <Lock size={14} strokeWidth={2} />
              رمز PIN
            </label>
            <div className="glogin-input-wrap">
              <input
                ref={inputRef}
                id="guard-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                className="input glogin-input"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                maxLength={20}
                autoFocus
                autoComplete="off"
                dir="ltr"
              />
              <button
                type="button"
                className="glogin-eye"
                onClick={() => setShowPin(v => !v)}
                aria-label={showPin ? 'إخفاء الـ PIN' : 'إظهار الـ PIN'}
                tabIndex={-1}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="glogin-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn-guard-login"
            type="submit"
            className="btn btn-primary btn-full btn-lg glogin-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>جاري الدخول...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} strokeWidth={2} />
                <span>دخول</span>
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        /* ── الخلفية ── */
        .glogin-page {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          position: relative;
        }

        /* شبكة خلفية خفيفة */
        .glogin-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.4;
          pointer-events: none;
        }

        /* ── الكرت ── */
        .glogin-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 380px;
          padding: var(--space-8);
          position: relative;
          z-index: 1;
        }

        /* حد lime علوي */
        .glogin-card::before {
          content: '';
          position: absolute;
          top: 0;
          right: var(--space-8);
          left: var(--space-8);
          height: 2px;
          background: var(--color-lime);
          border-radius: 0 0 var(--radius-sm) var(--radius-sm);
          opacity: 0.7;
        }

        /* ── رأس الكرت ── */
        .glogin-header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .glogin-icon {
          width: 60px;
          height: 60px;
          border-radius: var(--radius-lg);
          background: var(--color-lime-muted);
          border: 1.5px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-4);
        }

        .glogin-title {
          font-size: var(--text-xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0 0 var(--space-1);
        }

        .glogin-sub {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        /* ── النموذج ── */
        .glogin-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .glogin-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .glogin-label {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }

        .glogin-input-wrap {
          position: relative;
        }

        .glogin-input {
          width: 100%;
          text-align: center;
          font-size: var(--text-xl);
          letter-spacing: 0.25em;
          font-family: monospace;
          padding-left: 2.5rem;
        }

        .glogin-eye {
          position: absolute;
          top: 50%;
          left: var(--space-3);
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.2s;
        }
        .glogin-eye:hover { color: var(--text-secondary); }

        /* ── رسالة الخطأ ── */
        .glogin-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224, 85, 85, 0.25);
          border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        /* ── زر الدخول ── */
        .glogin-btn {
          margin-top: var(--space-2);
          gap: var(--space-2);
        }
      `}</style>
    </div>
  )
}
