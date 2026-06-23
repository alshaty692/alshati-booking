'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, AlertCircle, ArrowRight } from 'lucide-react'
import { useCourtNames } from '@/hooks/useCourtNames'

export default function NewCodePage() {
  const router = useRouter()
  const { courts } = useCourtNames('/api/admin/settings')
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
      <div className="nc-header">
        <Link href="/admin/codes" className="nc-back">
          <ArrowRight size={14} strokeWidth={2.5} />
          الأكواد
        </Link>
        <h1 className="nc-title">كود جديد</h1>
      </div>

      <div className="card nc-card">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="nc-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <div className="nc-field">
            <label htmlFor="nc-code" className="nc-label">الكود <span className="nc-req">*</span></label>
            <input
              id="nc-code" type="text" className="input nc-code-input"
              value={form.code} onChange={e => update('code', e.target.value.toUpperCase())}
              placeholder="مثال: SUMMER2025" required autoFocus
            />
          </div>

          <div className="nc-field">
            <label htmlFor="nc-code-type" className="nc-label">نوع الكود <span className="nc-req">*</span></label>
            <select id="nc-code-type" className="input" value={form.code_type} onChange={e => update('code_type', e.target.value)}>
              <option value="permanent">دائم</option>
              <option value="charity">خيري</option>
              <option value="free">مجاني</option>
              <option value="custom">خاص</option>
            </select>
          </div>

          <div className="nc-field">
            <label htmlFor="nc-discount-type" className="nc-label">نوع الخصم <span className="nc-req">*</span></label>
            <select id="nc-discount-type" className="input" value={form.discount_type} onChange={e => update('discount_type', e.target.value)}>
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="free">مجاني</option>
            </select>
          </div>

          {form.discount_type !== 'free' && (
            <div className="nc-field">
              <label htmlFor="nc-discount-val" className="nc-label">
                قيمة الخصم
                {form.discount_type === 'percent' && ' (%)'}
                {form.discount_type === 'fixed' && ' (ر.س)'}
              </label>
              <input
                id="nc-discount-val" type="number" className="input"
                value={form.discount_value} onChange={e => update('discount_value', e.target.value)}
                min="0" step="0.01"
                placeholder={form.discount_type === 'percent' ? '10' : '50'}
              />
            </div>
          )}

          <div className="nc-field">
            <label htmlFor="nc-court" className="nc-label">الملعب</label>
            <select id="nc-court" className="input" value={form.court_id} onChange={e => update('court_id', e.target.value)}>
              <option value="">الكل</option>
              {courts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="nc-row">
            <div className="nc-field">
              <label htmlFor="nc-max-uses" className="nc-label">الحد الأقصى للاستخدام</label>
              <input
                id="nc-max-uses" type="number" className="input"
                value={form.max_uses} onChange={e => update('max_uses', e.target.value)}
                min="1" placeholder="غير محدود"
              />
            </div>
            <div className="nc-field">
              <label htmlFor="nc-expires" className="nc-label">تاريخ الانتهاء</label>
              <input
                id="nc-expires" type="date" className="input"
                value={form.expires_at} onChange={e => update('expires_at', e.target.value)}
              />
            </div>
          </div>

          <div className="nc-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> جاري الإنشاء...</> : <><Plus size={15} strokeWidth={2.5} /> إنشاء الكود</>}
            </button>
            <Link href="/admin/codes" className="btn btn-secondary">
              <X size={14} strokeWidth={2} /> إلغاء
            </Link>
          </div>
        </form>
      </div>

      <style>{`
        .nc-header { margin-bottom: var(--space-6); }
        .nc-back {
          display: inline-flex; align-items: center; gap: var(--space-1);
          color: var(--color-lime-dim); font-size: var(--text-sm);
          font-weight: var(--font-semibold); text-decoration: none;
          margin-bottom: var(--space-3); transition: color 0.15s, gap 0.15s;
        }
        .nc-back:hover { color: var(--color-lime); gap: var(--space-2); opacity: 1; }
        .nc-title { font-size: var(--text-2xl); font-weight: var(--font-black); margin: 0; color: var(--text-primary); }
        .nc-card { max-width: 640px; }
        .nc-error {
          display: flex; align-items: center; gap: var(--space-2);
          background: var(--color-danger-bg); color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25); border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
          margin-bottom: var(--space-5); font-size: var(--text-sm); font-weight: var(--font-medium);
        }
        .nc-field { margin-bottom: var(--space-4); }
        .nc-label {
          display: block; font-size: var(--text-sm);
          font-weight: var(--font-semibold); color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }
        .nc-req { color: var(--color-danger); margin-right: 2px; }
        .nc-code-input { font-family: monospace; font-weight: var(--font-bold); letter-spacing: 0.08em; font-size: var(--text-lg); }
        .nc-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media (max-width: 480px) { .nc-row { grid-template-columns: 1fr; } }
        .nc-actions {
          display: flex; gap: var(--space-2); align-items: center;
          margin-top: var(--space-6); padding-top: var(--space-5);
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </div>
  )
}
