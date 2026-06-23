'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Save, Trash2, X, AlertCircle, ArrowRight } from 'lucide-react'
import { useCourtNames } from '@/hooks/useCourtNames'

export default function EditCodePage() {
  const router = useRouter()
  const params = useParams()
  const { courts } = useCourtNames('/api/admin/settings')
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  const fetchCode = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/codes/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')
      const c = data.code
      setForm({
        code: c.code ?? '',
        code_type: c.code_type ?? 'permanent',
        discount_type: c.discount_type ?? 'percent',
        discount_value: c.discount_type === 'free' ? '' : String(c.discount_value ?? ''),
        court_id: c.court_id ?? '',
        max_uses: c.max_uses ? String(c.max_uses) : '',
        expires_at: c.expires_at ?? '',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCode() }, [fetchCode])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/codes/${id}`, {
        method: 'PATCH',
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
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/codes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')
      router.push('/admin/codes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in ec-loading">
        <span className="spinner" />
        <span>جاري التحميل...</span>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* رأس الصفحة */}
      <div className="ec-header">
        <Link href="/admin/codes" className="ec-back">
          <ArrowRight size={14} strokeWidth={2.5} />
          الأكواد
        </Link>
        <h1 className="ec-title">تعديل الكود</h1>
      </div>

      <div className="card ec-card">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="ec-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          {/* الكود */}
          <div className="ec-field">
            <label htmlFor="ec-code" className="ec-label">الكود <span className="ec-req">*</span></label>
            <input
              id="ec-code" type="text" className="input ec-code-input"
              value={form.code} onChange={e => update('code', e.target.value.toUpperCase())}
              placeholder="مثال: SUMMER2025" required
            />
          </div>

          {/* نوع الكود */}
          <div className="ec-field">
            <label htmlFor="ec-code-type" className="ec-label">نوع الكود <span className="ec-req">*</span></label>
            <select id="ec-code-type" className="input" value={form.code_type} onChange={e => update('code_type', e.target.value)}>
              <option value="permanent">دائم</option>
              <option value="charity">خيري</option>
              <option value="free">مجاني</option>
              <option value="custom">خاص</option>
            </select>
          </div>

          {/* نوع الخصم */}
          <div className="ec-field">
            <label htmlFor="ec-discount-type" className="ec-label">نوع الخصم <span className="ec-req">*</span></label>
            <select id="ec-discount-type" className="input" value={form.discount_type} onChange={e => update('discount_type', e.target.value)}>
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="free">مجاني</option>
            </select>
          </div>

          {/* قيمة الخصم */}
          {form.discount_type !== 'free' && (
            <div className="ec-field">
              <label htmlFor="ec-discount-val" className="ec-label">
                قيمة الخصم
                {form.discount_type === 'percent' && ' (%)'}
                {form.discount_type === 'fixed' && ' (ر.س)'}
              </label>
              <input
                id="ec-discount-val" type="number" className="input"
                value={form.discount_value} onChange={e => update('discount_value', e.target.value)}
                min="0" step="0.01"
                placeholder={form.discount_type === 'percent' ? '10' : '50'}
              />
            </div>
          )}

          {/* الملعب */}
          <div className="ec-field">
            <label htmlFor="ec-court" className="ec-label">الملعب</label>
            <select id="ec-court" className="input" value={form.court_id} onChange={e => update('court_id', e.target.value)}>
              <option value="">الكل</option>
              {courts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* صفين: الحد الأقصى + الانتهاء */}
          <div className="ec-row">
            <div className="ec-field">
              <label htmlFor="ec-max-uses" className="ec-label">الحد الأقصى للاستخدام</label>
              <input
                id="ec-max-uses" type="number" className="input"
                value={form.max_uses} onChange={e => update('max_uses', e.target.value)}
                min="1" placeholder="غير محدود"
              />
            </div>
            <div className="ec-field">
              <label htmlFor="ec-expires" className="ec-label">تاريخ الانتهاء</label>
              <input
                id="ec-expires" type="date" className="input"
                value={form.expires_at} onChange={e => update('expires_at', e.target.value)}
              />
            </div>
          </div>

          {/* الإجراءات */}
          <div className="ec-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> جاري الحفظ...</> : <><Save size={15} strokeWidth={2} /> حفظ التغييرات</>}
            </button>
            <Link href="/admin/codes" className="btn btn-secondary">
              <X size={14} strokeWidth={2} /> إلغاء
            </Link>
            <button type="button" className="btn btn-ghost ec-delete-btn" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><span className="spinner" /> جاري الحذف...</> : <><Trash2 size={14} strokeWidth={2} /> حذف الكود</>}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .ec-loading {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          justify-content: center;
          padding: 4rem 0;
          color: var(--text-muted);
        }
        .ec-header { margin-bottom: var(--space-6); }
        .ec-back {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          color: var(--color-lime-dim);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          text-decoration: none;
          margin-bottom: var(--space-3);
          transition: color 0.15s, gap 0.15s;
        }
        .ec-back:hover { color: var(--color-lime); gap: var(--space-2); opacity: 1; }
        .ec-title {
          font-size: var(--text-2xl);
          font-weight: var(--font-black);
          margin: 0;
          color: var(--text-primary);
        }
        .ec-card { max-width: 640px; }
        .ec-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25);
          border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-5);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }
        .ec-field { margin-bottom: var(--space-4); }
        .ec-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }
        .ec-req { color: var(--color-danger); margin-right: 2px; }
        .ec-code-input {
          font-family: monospace;
          font-weight: var(--font-bold);
          letter-spacing: 0.08em;
          font-size: var(--text-lg);
        }
        .ec-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        @media (max-width: 480px) { .ec-row { grid-template-columns: 1fr; } }
        .ec-actions {
          display: flex;
          gap: var(--space-2);
          align-items: center;
          margin-top: var(--space-6);
          padding-top: var(--space-5);
          border-top: 1px solid var(--border-color);
          flex-wrap: wrap;
        }
        .ec-delete-btn {
          color: var(--color-danger);
          border-color: rgba(224,85,85,.3);
          margin-inline-start: auto;
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
        }
        .ec-delete-btn:hover:not(:disabled) {
          background: var(--color-danger-bg);
          border-color: var(--color-danger);
          color: var(--color-danger);
        }
        @media (max-width: 480px) { .ec-delete-btn { margin-inline-start: 0; width: 100%; justify-content: center; } }
      `}</style>
    </div>
  )
}
