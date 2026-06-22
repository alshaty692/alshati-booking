'use client'
// ============================================================
// صفحة تسجيل الدخول — رقم الجوال + OTP
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidSaudiPhone, normalizePhone } from '@/lib/utils'
import { Phone, KeyRound, ArrowLeft, RefreshCw, AlertCircle, Dumbbell } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState<string>()

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const normalized = normalizePhone(phone.trim())
    if (!isValidSaudiPhone(normalized)) {
      setError('يرجى إدخال رقم جوال سعودي صحيح (يبدأ بـ 05)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/booking/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setPhone(normalized)
      if (data.dev_otp) setDevOtp(data.dev_otp)
      setStep('otp')
    } catch {
      setError('حدث خطأ، تحقق من الإنترنت وحاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (otp.length !== 4) { setError('رمز التحقق 4 أرقام'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/booking/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/book')
    } catch {
      setError('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cl-page">
      {/* زر تبديل الثيم */}
      <ThemeToggle />

      {/* خلفية شبكة دقيقة */}
      <div className="cl-grid-bg" aria-hidden="true" />

      {/* كرة زخرفية ضوئية */}
      <div className="cl-glow" aria-hidden="true" />

      <div className="cl-wrap animate-fade-in">

        {/* ── الشعار والعنوان ── */}
        <div className="cl-brand">
          <div className="cl-brand-icon">
            <Dumbbell size={28} strokeWidth={1.75} />
          </div>
          <h1 className="cl-brand-name">مركز حي الشاطئ</h1>
          <p className="cl-brand-sub">احجز ملعبك بكل سهولة</p>
        </div>

        {/* ── البطاقة ── */}
        <div className="cl-card">
          {/* خط Lime علوي */}
          <div className="cl-card-accent" aria-hidden="true" />

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} id="form-send-otp" className="cl-form">
              <div className="cl-form-head">
                <div className="cl-step-icon">
                  <Phone size={20} strokeWidth={1.75} />
                </div>
                <h2 className="cl-form-title">أدخل رقم جوالك</h2>
                <p className="cl-form-sub">سنرسل لك رمز تحقق مكوّن من 4 أرقام</p>
              </div>

              <div className="cl-field">
                <label htmlFor="phone-input" className="cl-label">رقم الجوال</label>
                <div className="cl-input-wrap">
                  <Phone size={16} strokeWidth={1.75} className="cl-input-icon" />
                  <input
                    id="phone-input"
                    type="tel"
                    className="cl-input"
                    placeholder="05XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    maxLength={10}
                    inputMode="numeric"
                    dir="ltr"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="cl-error" role="alert">
                  <AlertCircle size={15} strokeWidth={2} className="cl-error-icon" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="btn-send-otp"
                type="submit"
                className="cl-btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <><span className="cl-spinner" />جاري الإرسال...</>
                ) : (
                  <>إرسال رمز التحقق<ArrowLeft size={16} strokeWidth={2} /></>
                )}
              </button>
            </form>

          ) : (
            <form onSubmit={handleVerifyOtp} id="form-verify-otp" className="cl-form">
              <button
                type="button"
                className="cl-back-btn"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
              >
                <ArrowLeft size={14} strokeWidth={2} />
                تغيير الرقم
              </button>

              <div className="cl-form-head">
                <div className="cl-step-icon">
                  <KeyRound size={20} strokeWidth={1.75} />
                </div>
                <h2 className="cl-form-title">أدخل رمز التحقق</h2>
                <p className="cl-form-sub">
                  أُرسل رمز إلى <strong className="cl-phone-highlight">{phone}</strong>
                </p>
              </div>

              {devOtp && (
                <div className="cl-dev-hint">
                  🔧 وضع التطوير — الرمز: <strong>{devOtp}</strong>
                </div>
              )}

              <div className="cl-field">
                <label htmlFor="otp-input" className="cl-label">رمز التحقق</label>
                <input
                  id="otp-input"
                  type="text"
                  className="cl-input cl-otp-input"
                  placeholder="- - - -"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  dir="ltr"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="cl-error" role="alert">
                  <AlertCircle size={15} strokeWidth={2} className="cl-error-icon" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="btn-verify-otp"
                type="submit"
                className="cl-btn-primary"
                disabled={loading || otp.length !== 4}
              >
                {loading ? (
                  <><span className="cl-spinner" />جاري التحقق...</>
                ) : (
                  <>تأكيد الدخول<ArrowLeft size={16} strokeWidth={2} /></>
                )}
              </button>

              <button
                id="btn-resend-otp"
                type="button"
                className="cl-btn-secondary"
                onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                disabled={loading}
              >
                <RefreshCw size={14} strokeWidth={2} />
                إعادة إرسال الرمز
              </button>
            </form>
          )}
        </div>

        <p className="cl-footer">مركز حي الشاطئ — جدة</p>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        /* ══ الصفحة ══ */
        .cl-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          background: var(--bg-base);
          position: relative;
          overflow: hidden;
        }

        /* شبكة دقيقة في الخلفية */
        .cl-grid-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }

        /* توهّج Lime زخرفي */
        .cl-glow {
          position: fixed;
          top: -180px;
          right: -120px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--color-lime-glow) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* ══ الغلاف الرئيسي ══ */
        .cl-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
        }

        /* ══ الشعار ══ */
        .cl-brand {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
        }

        .cl-brand-icon {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-xl);
          background: var(--color-lime-muted);
          border: 1.5px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 24px var(--color-lime-glow);
        }

        .cl-brand-name {
          font-size: var(--text-2xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .cl-brand-sub {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        /* ══ البطاقة ══ */
        .cl-card {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-lg);
          padding: var(--space-8);
          position: relative;
          overflow: hidden;
        }

        /* شريط Lime علوي */
        .cl-card-accent {
          position: absolute;
          top: 0;
          right: var(--space-8);
          left: var(--space-8);
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--color-lime), transparent);
          border-radius: 0 0 var(--radius-sm) var(--radius-sm);
        }

        /* ══ النموذج ══ */
        .cl-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .cl-form-head {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .cl-step-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cl-form-title {
          font-size: var(--text-xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0;
        }

        .cl-form-sub {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .cl-phone-highlight {
          color: var(--color-lime);
          direction: ltr;
          display: inline-block;
        }

        /* ══ الحقول ══ */
        .cl-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .cl-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }

        .cl-input-wrap {
          position: relative;
        }

        .cl-input-icon {
          position: absolute;
          top: 50%;
          right: var(--space-3);
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .cl-input {
          width: 100%;
          height: 44px;
          padding: 0 var(--space-3);
          padding-right: calc(var(--space-3) + 16px + var(--space-2));
          background: var(--bg-elevated);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-base);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }

        .cl-input:focus {
          border-color: var(--color-lime-dim);
          box-shadow: 0 0 0 3px var(--color-lime-glow);
        }

        /* OTP — رقم كبير بدون أيقونة */
        .cl-otp-input {
          padding-right: var(--space-3);
          font-size: 2rem;
          font-weight: var(--font-black);
          letter-spacing: 0.6em;
          text-align: center;
          height: 64px;
        }

        /* ══ الأزرار ══ */
        .cl-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          height: 48px;
          background: var(--color-lime);
          color: #0a1a0a;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-base);
          font-weight: var(--font-black);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 16px var(--color-lime-glow);
        }

        .cl-btn-primary:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px var(--color-lime-glow);
        }

        .cl-btn-primary:active:not(:disabled) { transform: translateY(0); }

        .cl-btn-primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .cl-btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          height: 42px;
          background: transparent;
          color: var(--text-muted);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }

        .cl-btn-secondary:hover:not(:disabled) {
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
          background: var(--color-lime-muted);
        }

        .cl-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ══ زر الرجوع ══ */
        .cl-back-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: var(--text-sm);
          font-family: inherit;
          cursor: pointer;
          padding: 0;
          font-weight: var(--font-semibold);
          transition: color 0.15s;
          margin-bottom: var(--space-1);
        }

        .cl-back-btn:hover { color: var(--color-lime); }

        /* ══ الخطأ ══ */
        .cl-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25);
          border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .cl-error-icon { flex-shrink: 0; }

        /* ══ تلميح التطوير ══ */
        .cl-dev-hint {
          background: rgba(234,179,8,.12);
          color: #ca8a04;
          border: 1px solid rgba(234,179,8,.3);
          border-right: 3px solid #ca8a04;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
        }

        /* ══ Spinner ══ */
        .cl-spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(10,26,10,.25);
          border-top-color: #0a1a0a;
          border-radius: 50%;
          animation: cl-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes cl-spin { to { transform: rotate(360deg); } }

        /* ══ الفوتر ══ */
        .cl-footer {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0;
          text-align: center;
          opacity: 0.7;
        }

        /* ══ فيد إن ══ */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        .animate-fade-in { animation: fadeIn 0.35s ease both; }

        /* ══ جوال ══ */
        @media (max-width: 480px) {
          .cl-page { padding: var(--space-4); align-items: flex-start; padding-top: 10vh; }
          .cl-card { padding: var(--space-6); }
          .cl-brand-icon { width: 52px; height: 52px; }
          .cl-brand-name { font-size: var(--text-xl); }
        }
      `}</style>
    </div>
  )
}
