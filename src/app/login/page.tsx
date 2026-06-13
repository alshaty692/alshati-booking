'use client'
// ============================================================
// صفحة تسجيل الدخول — رقم الجوال + OTP
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidSaudiPhone, normalizePhone } from '@/lib/utils'

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
    <div className="login-page">
      {/* خلفية */}
      <div className="login-bg" />

      <div className="login-container animate-fade-in">
        {/* شعار المنشأة */}
        <div className="login-header">
          <div className="login-logo">🏟️</div>
          <h1>مركز حي الشاطئ</h1>
          <p>احجز ملعبك بكل سهولة</p>
        </div>

        {/* البطاقة */}
        <div className="card login-card">
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} id="form-send-otp">
              <h2 className="form-title">أدخل رقم جوالك</h2>
              <p className="form-subtitle">سنرسل لك رمز تحقق مكوّن من 4 أرقام</p>

              <div className="form-group">
                <label htmlFor="phone-input">رقم الجوال</label>
                <input
                  id="phone-input"
                  type="tel"
                  className="input phone-input"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  maxLength={10}
                  inputMode="numeric"
                  autoFocus
                  required
                />
              </div>

              {error && <div className="form-error" role="alert">{error}</div>}

              <button
                id="btn-send-otp"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
              >
                {loading ? <><span className="spinner" /> جاري الإرسال...</> : 'إرسال رمز التحقق →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} id="form-verify-otp">
              <button
                type="button"
                className="back-btn"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
              >
                ← تغيير الرقم
              </button>

              <h2 className="form-title">أدخل رمز التحقق</h2>
              <p className="form-subtitle">
                أُرسل رمز مكوّن من 4 أرقام إلى <strong>{phone}</strong>
              </p>

              {devOtp && (
                <div className="dev-hint">
                  🔧 وضع التطوير — الرمز: <strong>{devOtp}</strong>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="otp-input">رمز التحقق</label>
                <input
                  id="otp-input"
                  type="text"
                  className="input otp-input"
                  placeholder="- - - -"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  autoFocus
                  required
                />
              </div>

              {error && <div className="form-error" role="alert">{error}</div>}

              <button
                id="btn-verify-otp"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || otp.length !== 4}
              >
                {loading ? <><span className="spinner" /> جاري التحقق...</> : 'تأكيد →'}
              </button>

              <button
                id="btn-resend-otp"
                type="button"
                className="btn btn-secondary btn-full"
                style={{ marginTop: '0.75rem' }}
                onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                disabled={loading}
              >
                إعادة إرسال الرمز
              </button>
            </form>
          )}
        </div>

        <p className="login-footer">
          مركز حي الشاطئ — جدة
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #0ea5e9 100%);
          z-index: 0;
        }
        .login-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='20'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
        }
        .login-header {
          text-align: center;
          margin-bottom: 1.75rem;
          color: #fff;
        }
        .login-logo {
          font-size: 3.5rem;
          margin-bottom: 0.5rem;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,.3));
        }
        .login-header h1 {
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 0.3rem;
        }
        .login-header p {
          color: rgba(255,255,255,.75);
          font-size: 0.95rem;
          margin: 0;
        }
        .login-card {
          padding: 2rem;
          backdrop-filter: blur(12px);
          background: rgba(255,255,255,.97);
        }
        .form-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 0.3rem;
        }
        .form-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin: 0 0 1.5rem;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 0.4rem;
          color: var(--text-primary);
        }
        .phone-input {
          font-size: 1.1rem;
          text-align: center;
          letter-spacing: 0.05em;
        }
        .otp-input {
          font-size: 2rem;
          text-align: center;
          letter-spacing: 0.5em;
          font-weight: 700;
        }
        .form-error {
          background: #fee2e2;
          color: #991b1b;
          padding: 0.6rem 0.875rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          border-right: 3px solid #ef4444;
        }
        .dev-hint {
          background: #fef3c7;
          color: #92400e;
          padding: 0.6rem 0.875rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          border-right: 3px solid #f59e0b;
        }
        .back-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: 0.875rem;
          font-family: inherit;
          cursor: pointer;
          padding: 0;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        .back-btn:hover { text-decoration: underline; }
        .login-footer {
          text-align: center;
          color: rgba(255,255,255,.55);
          font-size: 0.8rem;
          margin-top: 1.25rem;
        }
      `}</style>
    </div>
  )
}
