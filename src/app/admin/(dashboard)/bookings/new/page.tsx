'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import type { PriceCalculation } from '@/types'

const COURTS = ['football','volleyball','multi'] as const
const PERIODS = [1,2,3] as const

export default function NewManualBookingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    booking_date: '', court_id: '', period_number: '', customer_name: '',
    customer_phone: '', code_used: '', final_price: '', internal_note: '',
  })
  const [price, setPrice] = useState<PriceCalculation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // حساب السعر عند تغيير الملعب أو الكود
  async function calcPrice() {
    if (!form.court_id) return
    try {
      const res = await fetch('/api/booking/validate-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ court_id: form.court_id, code: form.code_used || null }),
      })
      const data = await res.json()
      if (!data.error) {
        setPrice(data)
        setForm(f => ({ ...f, final_price: String(data.final_price) }))
      }
    } catch {}
  }

  useEffect(() => { calcPrice() }, [form.court_id, form.code_used])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(true)
      setTimeout(() => router.push('/admin/bookings'), 1500)
    } finally { setLoading(false) }
  }

  if (success) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
      <h2>تم إنشاء الحجز اليدوي بنجاح</h2>
      <p style={{ color: 'var(--text-muted)' }}>جاري التحويل...</p>
    </div>
  )

  return (
    <div className="animate-fade-in" style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>✏️ حجز يدوي جديد</h1>

      <form onSubmit={handleSubmit} className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="field-label">التاريخ *</label>
            <input type="date" className="input" required
              value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">الملعب *</label>
            <select className="input" required value={form.court_id}
              onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}>
              <option value="">اختر الملعب</option>
              {COURTS.map(c => <option key={c} value={c}>{getCourtName(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">الفترة *</label>
            <select className="input" required value={form.period_number}
              onChange={e => setForm(f => ({ ...f, period_number: e.target.value }))}>
              <option value="">اختر الفترة</option>
              {PERIODS.map(p => <option key={p} value={p}>{getPeriodName(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">كود الخصم</label>
            <input type="text" className="input" placeholder="اختياري"
              value={form.code_used} onChange={e => setForm(f => ({ ...f, code_used: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="field-label">اسم العميل *</label>
            <input type="text" className="input" required placeholder="الاسم الكامل"
              value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">رقم الجوال *</label>
            <input type="tel" className="input" required placeholder="05XXXXXXXX"
              value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
          </div>
        </div>

        {/* السعر */}
        {price && (
          <div style={{ background: 'var(--bg-muted)', borderRadius: '0.75rem', padding: '1rem', margin: '1rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>السعر: <strong>{formatAmount(price.base_price)}</strong></span>
            {price.discount_amount > 0 && <span style={{ color: 'var(--color-success)' }}>خصم: -{formatAmount(price.discount_amount)}</span>}
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>الإجمالي: {formatAmount(price.final_price)}</span>
          </div>
        )}

        <div style={{ margin: '1rem 0' }}>
          <label className="field-label">تعديل السعر (اختياري)</label>
          <input type="number" className="input" placeholder="اتركه فارغاً لاستخدام السعر المحسوب"
            value={form.final_price} onChange={e => setForm(f => ({ ...f, final_price: e.target.value }))} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label className="field-label">ملاحظة داخلية</label>
          <textarea className="input" rows={2} placeholder="ملاحظة للإدارة..."
            value={form.internal_note} onChange={e => setForm(f => ({ ...f, internal_note: e.target.value }))} />
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: '0.5rem', marginBottom: '1rem', borderRight: '3px solid #ef4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" /> جاري الحجز...</> : '✅ تأكيد الحجز اليدوي'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>إلغاء</button>
        </div>
      </form>

      <style>{`.field-label { display:block; font-weight:600; font-size:0.875rem; margin-bottom:0.4rem; }`}</style>
    </div>
  )
}
