'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, ShieldCheck, User, Lock, AlertCircle, ShieldOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ui/ThemeToggle'

// ─────────────────────────────────────────────────────────────────────
// المكوّن الداخلي — يستخدم useSearchParams لذا يحتاج Suspense wrapper
// Next.js يشترط هذا الفصل لتجنب build error
// ─────────────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isUnauthorized = searchParams.get('error') === 'unauthorized'
  const [identifier, setIdentifier] = useState('')   // اسم مستخدم أو بريد كامل
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // لو المستخدم وصل بـ ?error=unauthorized — يُسجَّل خروجه فوراً حتى لا يتكرر الـ redirect
  useEffect(() => {
    if (isUnauthorized) {
      const supabase = createClient()
      supabase.auth.signOut()
    }
  }, [isUnauthorized])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      // لو المُدخَل يحتوي @ → بريد حقيقي (حساب المدير القديم)
      // لو بدون @ → اسم مستخدم داخلي → يُحوَّل لـ username@alshati.internal
      const email = identifier.includes('@')
        ? identifier.trim()
        : `${identifier.trim()}@alshati.internal`
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError('اسم المستخدم أو كلمة المرور غير صحيحة'); return }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* رأس الكرت */}
      <div className="al-login-header">
        <div className="al-login-icon-wrap">
          <ShieldCheck size={28} strokeWidth={1.5} />
        </div>
        <h1 className="al-login-title">لوحة تحكم الإدارة</h1>
        <p className="al-login-subtitle">مركز حي الشاطئ</p>
      </div>

      {/* النموذج */}
      <form onSubmit={handleLogin} id="admin-login-form" className="al-login-form">

        {/* اسم المستخدم أو البريد */}
        <div className="al-field">
          <label htmlFor="admin-identifier" className="al-field-label">
            اسم المستخدم
          </label>
          <div className="al-field-wrap">
            <User size={16} strokeWidth={1.75} className="al-field-icon" />
            <input
              id="admin-identifier"
              type="text"
              className="input al-field-input"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              autoFocus
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              dir="ltr"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* كلمة المرور */}
        <div className="al-field">
          <label htmlFor="admin-password" className="al-field-label">
            كلمة المرور
          </label>
          <div className="al-field-wrap">
            <Lock size={16} strokeWidth={1.75} className="al-field-icon" />
            <input
              id="admin-password"
              type="password"
              className="input al-field-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* بانر غير مخوّل — يظهر فقط عند ?error=unauthorized */}
        {isUnauthorized && (
          <div className="al-unauthorized" role="alert">
            <ShieldOff size={16} strokeWidth={2} className="al-error-icon" />
            <span>حسابك غير مخوّل للوصول إلى لوحة الإدارة. تواصل مع المدير الرئيسي.</span>
          </div>
        )}

        {/* رسالة الخطأ — خطأ تسجيل دخول */}
        {error && (
          <div className="al-error" role="alert">
            <AlertCircle size={15} strokeWidth={2} className="al-error-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* زر الدخول — CTA الوحيد على الصفحة */}
        <button
          id="btn-admin-login"
          type="submit"
          className="btn btn-primary btn-full btn-lg al-submit-btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              <span>جاري الدخول...</span>
            </>
          ) : (
            <>
              <LogIn size={18} strokeWidth={2} />
              <span>دخول</span>
            </>
          )}
        </button>
      </form>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────
// الصفحة الرئيسية — تغلّف LoginForm بـ Suspense (مطلوب من Next.js)
// ─────────────────────────────────────────────────────────────────────
export default function AdminLoginPage() {
  return (
    <div className="al-login-page">
      {/* زر التبديل — ثابت */}
      <ThemeToggle />

      {/* الكرت المركزي */}
      <div className="al-login-card animate-fade-in">
        <Suspense fallback={
          <div className="al-login-header">
            <div className="al-login-icon-wrap">
              <ShieldCheck size={28} strokeWidth={1.5} />
            </div>
            <h1 className="al-login-title">لوحة تحكم الإدارة</h1>
            <p className="al-login-subtitle">مركز حي الشاطئ</p>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>

      <style>{`
        /* ── الخلفية ── */
        .al-login-page {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          position: relative;
        }

        /* خط بياني خفيف في الخلفية — يعطي عمقاً دون تشويش */
        .al-login-page::before {
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
        .al-login-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 400px;
          padding: var(--space-8);
          position: relative;
          z-index: 1;
        }

        /* حد Lime علوي — جرأة بصرية في مكان واحد */
        .al-login-card::before {
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
        .al-login-header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .al-login-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: var(--color-lime-muted);
          border: 1.5px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-4);
        }

        .al-login-title {
          font-size: var(--text-xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0 0 var(--space-1);
          letter-spacing: -0.01em;
        }

        .al-login-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
          font-weight: var(--font-medium);
          letter-spacing: 0.02em;
        }

        /* ── النموذج ── */
        .al-login-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .al-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .al-field-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }

        .al-field-wrap {
          position: relative;
        }

        .al-field-icon {
          position: absolute;
          top: 50%;
          right: var(--space-3);
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
          flex-shrink: 0;
        }

        .al-field-input {
          padding-right: calc(var(--space-3) + 16px + var(--space-2));
        }

        /* ── رسالة غير مخوّل ── */
        .al-unauthorized {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid rgba(245, 166, 35, 0.25);
          border-right: 3px solid var(--color-warning);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          line-height: 1.5;
        }

        /* ── رسالة الخطأ ── */
        .al-error {
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

        .al-error-icon { flex-shrink: 0; }

        /* ── زر الدخول ── */
        .al-submit-btn {
          margin-top: var(--space-2);
          gap: var(--space-2);
        }
      `}</style>
    </div>
  )
}
