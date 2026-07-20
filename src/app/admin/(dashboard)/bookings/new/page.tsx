'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import type { PriceCalculation } from '@/types'
import { CheckCircle2, X, AlertCircle, ArrowRight, CircleDollarSign } from 'lucide-react'

const COURTS = ['football', 'volleyball', 'multi'] as const
const PERIODS = [1, 2, 3] as const

export default function NewManualBookingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    booking_date: '', court_id: '', period_number: '', customer_name: '',
    customer_phone: '', code_used: '', final_price: '', internal_note: '',
    water_quantity: '0',
  })
  const [price, setPrice] = useState<PriceCalculation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
        // لا نضبط final_price تلقائياً — نتركه للمستخدم أو فارغاً لحساب السرفير
        setForm(f => ({ ...f, final_price: '' }))
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
    <div className="nb-success animate-fade-in">
      <CheckCircle2 size={52} strokeWidth={1.25} style={{ color: 'var(--color-lime)' }} />
      <h2>تم إنشاء الحجز اليدوي بنجاح</h2>
      <p style={{ color: 'var(--text-muted)' }}>جاري التحويل...</p>
    </div>
  )

  return (
    <div className="animate-fade-in">
      {/* رأس الصفحة */}
      <div className="nb-header">
        <Link href="/admin/bookings" className="nb-back">
          <ArrowRight size={14} strokeWidth={2.5} />
          الحجوزات
        </Link>
        <h1 className="nb-title">حجز يدوي جديد</h1>
      </div>

      <form onSubmit={handleSubmit} className="card nb-form">
        {/* شبكة الحقول */}
        <div className="nb-grid">
          <div className="nb-field">
            <label htmlFor="nb-date" className="nb-label">التاريخ <span className="nb-req">*</span></label>
            <input id="nb-date" type="date" className="input" required
              value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} />
          </div>
          <div className="nb-field">
            <label htmlFor="nb-court" className="nb-label">الملعب <span className="nb-req">*</span></label>
            <select id="nb-court" className="input" required value={form.court_id}
              onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}>
              <option value="">اختر الملعب</option>
              {COURTS.map(c => <option key={c} value={c}>{getCourtName(c)}</option>)}
            </select>
          </div>
          <div className="nb-field">
            <label htmlFor="nb-period" className="nb-label">الفترة <span className="nb-req">*</span></label>
            <select id="nb-period" className="input" required value={form.period_number}
              onChange={e => setForm(f => ({ ...f, period_number: e.target.value }))}>
              <option value="">اختر الفترة</option>
              {PERIODS.map(p => <option key={p} value={p}>{getPeriodName(p)}</option>)}
            </select>
          </div>
          <div className="nb-field">
            <label htmlFor="nb-code" className="nb-label">كود الخصم</label>
            <input id="nb-code" type="text" className="input" placeholder="اختياري"
              value={form.code_used} onChange={e => setForm(f => ({ ...f, code_used: e.target.value.toUpperCase() }))} />
          </div>
          <div className="nb-field">
            <label htmlFor="nb-name" className="nb-label">اسم العميل <span className="nb-req">*</span></label>
            <input id="nb-name" type="text" className="input" required placeholder="الاسم الكامل"
              value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
          </div>
          <div className="nb-field">
            <label htmlFor="nb-phone" className="nb-label">رقم الجوال <span className="nb-req">*</span></label>
            <input id="nb-phone" type="tel" className="input" required placeholder="05XXXXXXXX"
              value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
          </div>
        </div>

        {/* ملخص السعر */}
        {price && (
          <div className="nb-price-box">
            <CircleDollarSign size={16} strokeWidth={1.75} style={{ color: 'var(--color-lime-dim)' }} />
            <span>السعر: <strong>{formatAmount(price.base_price)}</strong></span>
            {price.discount_amount > 0 && (
              <span style={{ color: 'var(--color-lime)' }}>خصم: −{formatAmount(price.discount_amount)}</span>
            )}
            {Number(form.water_quantity) > 0 && (
              <span style={{ color: 'var(--color-lime-dim)' }}>
                مياه: +{Number(form.water_quantity)} كرتون
              </span>
            )}
            <span style={{ fontWeight: 'var(--font-black)' as React.CSSProperties['fontWeight'], color: 'var(--color-lime)', fontSize: 'var(--text-lg)' }}>
              الإجمالي: {formatAmount(price.final_price)}
            </span>
          </div>
        )}

        {/* حقل كراتين المياه */}
        <div className="nb-field">
          <label htmlFor="nb-water" className="nb-label">كراتين مياه 💧 (اختياري)</label>
          <input id="nb-water" type="number" className="input" min="0" placeholder="0"
            value={form.water_quantity}
            onChange={e => setForm(f => ({ ...f, water_quantity: e.target.value }))} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            سيُحسب سعرها ويُضاف للفاتورة تلقائياً
          </p>
        </div>

        {/* تعديل السعر */}
        <div className="nb-field">
          <label htmlFor="nb-price" className="nb-label">تعديل السعر (اختياري)</label>
          <input id="nb-price" type="number" className="input" placeholder="اتركه فارغاً لاستخدام السعر المحسوب"
            value={form.final_price} onChange={e => setForm(f => ({ ...f, final_price: e.target.value }))} />
        </div>

        <div className="nb-field" style={{ marginBottom: 'var(--space-6)' }}>
          <label htmlFor="nb-note" className="nb-label">ملاحظة داخلية</label>
          <textarea id="nb-note" className="input" rows={2} placeholder="ملاحظة للإدارة..."
            value={form.internal_note} onChange={e => setForm(f => ({ ...f, internal_note: e.target.value }))} />
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="nb-error" role="alert">
            <AlertCircle size={15} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {/* الإجراءات */}
        <div className="nb-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1 }}>
            {loading
              ? <><span className="spinner" /> جاري الحجز...</>
              : <><CheckCircle2 size={17} strokeWidth={2} /> تأكيد الحجز اليدوي</>
            }
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
            <X size={14} /> إلغاء
          </button>
        </div>
      </form>

      <style>{`
        .nb-header { margin-bottom: var(--space-6); }
        .nb-back {
          display: inline-flex; align-items: center; gap: var(--space-1);
          color: var(--color-lime-dim); font-size: var(--text-sm);
          font-weight: var(--font-semibold); text-decoration: none;
          margin-bottom: var(--space-3); transition: color 0.15s, gap 0.15s;
        }
        .nb-back:hover { color: var(--color-lime); gap: var(--space-2); opacity: 1; }
        .nb-title { font-size: var(--text-2xl); font-weight: var(--font-black); margin: 0; color: var(--text-primary); }

        .nb-form { max-width: 640px; }
        .nb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
        @media (max-width: 480px) { .nb-grid { grid-template-columns: 1fr; } }

        .nb-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-4); }
        .nb-label { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); }
        .nb-req { color: var(--color-danger); margin-right: 2px; }

        .nb-price-box {
          display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
          background: var(--color-lime-muted); border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
        }

        .nb-error {
          display: flex; align-items: center; gap: var(--space-2);
          background: var(--color-danger-bg); color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25); border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
          margin-bottom: var(--space-4); font-size: var(--text-sm);
        }

        .nb-actions { display: flex; gap: var(--space-2); align-items: center; }

        .nb-success {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          padding: 4rem; gap: var(--space-3);
          min-height: 40vh;
        }
        .nb-success h2 { color: var(--text-primary); margin: 0; }
      `}</style>
    </div>
  )
}
