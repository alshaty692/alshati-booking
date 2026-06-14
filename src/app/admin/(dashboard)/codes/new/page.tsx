'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewCodePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    code: '',
    code_type: 'permanent',
    discount_type: 'percent',
    discount_value: '',
    court_id: '',
    max_uses: '',
    expires_at: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          code_type: form.code_type,
          discount_type: form.discount_type,
          discount_value: form.discount_type === 'free' ? 100 : Number(form.discount_value) || 0,
          court_id: form.court_id || null,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          expires_at: form.expires_at || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')

      router.push('/admin/codes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="form-page-header">
        <Link href="/admin/codes" className="back-link">→ الأكواد</Link>
        <h1 className="form-page-title">كود جديد</h1>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          {/* الكود */}
          <div className="form-group">
            <label className="form-label">الكود <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              value={form.code}
              onChange={e => update('code', e.target.value.toUpperCase())}
              placeholder="مثال: SUMMER2025"
              required
              style={{ letterSpacing: '0.1em', fontWeight: 700 }}
            />
          </div>

          {/* نوع الكود */}
          <div className="form-group">
            <label className="form-label">نوع الكود <span className="required">*</span></label>
            <select
              className="form-input"
              value={form.code_type}
              onChange={e => update('code_type', e.target.value)}
            >
              <option value="permanent">دائم</option>
              <option value="charity">خيري</option>
              <option value="free">مجاني</option>
              <option value="custom">خاص</option>
            </select>
          </div>

          {/* نوع الخصم */}
          <div className="form-group">
            <label className="form-label">نوع الخصم <span className="required">*</span></label>
            <select
              className="form-input"
              value={form.discount_type}
              onChange={e => update('discount_type', e.target.value)}
            >
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="free">مجاني</option>
            </select>
          </div>

          {/* قيمة الخصم */}
          {form.discount_type !== 'free' && (
            <div className="form-group">
              <label className="form-label">
                قيمة الخصم
                {form.discount_type === 'percent' && ' (%)'}
                {form.discount_type === 'fixed' && ' (ر.ع)'}
              </label>
              <input
                type="number"
                className="form-input"
                value={form.discount_value}
                onChange={e => update('discount_value', e.target.value)}
                min="0"
                step="0.01"
                placeholder={form.discount_type === 'percent' ? '10' : '5.000'}
              />
            </div>
          )}

          {/* الملعب */}
          <div className="form-group">
            <label className="form-label">الملعب</label>
            <select
              className="form-input"
              value={form.court_id}
              onChange={e => update('court_id', e.target.value)}
            >
              <option value="">الكل</option>
              <option value="football">كرة القدم</option>
              <option value="volleyball">الكرة الطائرة</option>
              <option value="multi">الملعب المتعدد</option>
            </select>
          </div>

          <div className="form-row">
            {/* الحد الأقصى */}
            <div className="form-group">
              <label className="form-label">الحد الأقصى للاستخدام</label>
              <input
                type="number"
                className="form-input"
                value={form.max_uses}
                onChange={e => update('max_uses', e.target.value)}
                min="1"
                placeholder="غير محدود"
              />
            </div>

            {/* تاريخ الانتهاء */}
            <div className="form-group">
              <label className="form-label">تاريخ الانتهاء</label>
              <input
                type="date"
                className="form-input"
                value={form.expires_at}
                onChange={e => update('expires_at', e.target.value)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'إنشاء الكود'}
            </button>
            <Link href="/admin/codes" className="btn-cancel">إلغاء</Link>
          </div>
        </form>
      </div>

      <style>{`
        .form-page-header {
          margin-bottom: 1.5rem;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #2D5C4E;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 0.5rem;
          transition: opacity 0.2s;
        }
        .back-link:hover { opacity: 0.7; }
        .form-page-title {
          font-size: 1.6rem;
          margin: 0;
          color: #1B2A3B;
        }
        .form-card {
          background: #fff;
          border: 0.5px solid #E2DDD4;
          border-radius: 14px;
          padding: 2rem;
          max-width: 640px;
        }
        .form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #1B2A3B;
          margin-bottom: 0.4rem;
        }
        .required { color: #dc2626; }
        .form-input {
          width: 100%;
          padding: 0.65rem 0.9rem;
          border: 1px solid #E2DDD4;
          border-radius: 10px;
          font-size: 0.9rem;
          font-family: 'Tajawal', sans-serif;
          background: #FAFAF8;
          color: #1B2A3B;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #C9A96E;
          box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
        }
        .form-input::placeholder {
          color: #b0a898;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .form-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-top: 1.75rem;
          padding-top: 1.25rem;
          border-top: 1px solid #F0ECE4;
        }
        .btn-submit {
          padding: 0.7rem 2rem;
          background: #2D5C4E;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 700;
          font-family: 'Tajawal', sans-serif;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .btn-submit:hover:not(:disabled) {
          background: #245043;
          transform: translateY(-1px);
        }
        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-cancel {
          padding: 0.7rem 1.5rem;
          background: transparent;
          color: #1B2A3B;
          border: 1px solid #E2DDD4;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          font-family: 'Tajawal', sans-serif;
          text-decoration: none;
          transition: background 0.2s;
        }
        .btn-cancel:hover { background: #F5F2EC; }

        @media (max-width: 600px) {
          .form-card { padding: 1.25rem; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
