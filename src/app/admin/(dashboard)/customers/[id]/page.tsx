import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/types'
import Link from 'next/link'
import {
  BarChart2, Settings2, ClipboardList, Star, MessageCircle,
  Shield, Ban, Phone, MessageSquare, Hash, Save, Plus,
} from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'

export const metadata: Metadata = { title: 'بطاقة العميل' }

interface Props { params: Promise<{ id: string }> }

async function updateCustomer(formData: FormData) {
  'use server'
  const supabase = createAdminClient()
  const id = formData.get('customer_id') as string
  await supabase.from('customers').update({
    is_vip: formData.get('is_vip') === 'on',
    is_suspended: formData.get('is_suspended') === 'on',
    suspension_reason: formData.get('suspension_reason') as string,
    internal_notes: formData.get('internal_notes') as string,
  }).eq('id', id)
  revalidatePath(`/admin/customers/${id}`)
}

async function addContactLog(formData: FormData) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('customer_contact_log').insert({
    customer_phone: formData.get('phone') as string,
    contact_type: formData.get('contact_type') as string,
    offer_sent: formData.get('offer_sent') as string,
    notes: formData.get('notes') as string,
  })
  revalidatePath(`/admin/customers/${formData.get('customer_id')}`)
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', uploaded: 'badge-uploaded', confirmed: 'badge-confirmed',
  rejected: 'badge-rejected', cancelled: 'badge-cancelled', expired: 'badge-expired',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'بانتظار الإيصال', uploaded: 'قيد المراجعة', confirmed: 'مؤكد',
  rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي',
}
const CLASS_STYLE: Record<string, string> = {
  gold: 'badge-gold', regular: 'badge-regular', inactive: 'badge-inactive', new: 'badge-new',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cd-row">
      <span className="cd-row-label">{label}</span>
      <span className="cd-row-value">{value}</span>
    </div>
  )
}

function StarDisplay({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span style={{ color: 'var(--text-muted)' }}>لا تقييمات بعد</span>
  const full = Math.round(avg)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ color: 'var(--color-warning)', letterSpacing: '0.05em', fontSize: '1rem' }}>
        {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      </span>
      <strong style={{ color: 'var(--color-warning)' }}>{avg.toFixed(1)}/5</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({count} تقييم)</span>
    </span>
  )
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const customerRes = await supabase.from('customers').select('*').eq('id', id).single()
  const customer = customerRes.data
  if (!customer) notFound()

  const phone = customer.phone
  const [bookingsRes, logsRes, ratingsRes] = await Promise.all([
    supabase.from('bookings').select('*').eq('customer_phone', phone).order('created_at', { ascending: false }).limit(20),
    supabase.from('customer_contact_log').select('*').eq('customer_phone', phone).order('contacted_at', { ascending: false }).limit(10),
    supabase.from('booking_ratings').select('rating, comment, created_at, booking_id').eq('phone', phone).order('created_at', { ascending: false }),
  ])

  const bookings = bookingsRes.data ?? []
  const logs     = logsRes.data ?? []
  const ratings  = ratingsRes.data ?? []
  const ratingCount = ratings.length
  const ratingAvg   = ratingCount > 0
    ? Math.round(ratings.reduce((s, r) => s + r.rating, 0) / ratingCount * 10) / 10
    : null

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={customer.name}
        backHref="/admin/customers"
        backLabel="العملاء"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span className={`badge ${CLASS_STYLE[customer.classification] ?? ''}`}>
              {CLASSIFICATION_LABELS[customer.classification as keyof typeof CLASSIFICATION_LABELS] ?? customer.classification}
            </span>
            {customer.is_vip && (
              <span className="badge badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Star size={10} strokeWidth={2} style={{ fill: 'currentColor' }} /> VIP
              </span>
            )}
            {customer.is_suspended && <span className="badge badge-rejected">موقوف</span>}
          </div>
        }
      />

      <div className="cd-grid">
        {/* الإحصائيات */}
        <div className="card">
          <div className="cd-card-head">
            <BarChart2 size={16} strokeWidth={1.75} />
            <h2>الإحصائيات</h2>
          </div>
          <Row label="الجوال" value={<span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>{customer.phone}</span>} />
          <Row label="إجمالي الحجوزات" value={<strong>{customer.total_bookings}</strong>} />
          <Row label="إجمالي المدفوع" value={<strong style={{ color: 'var(--color-lime)' }}>{formatAmount(customer.total_paid)}</strong>} />
          <Row label="الملعب المفضل" value={customer.preferred_court ? getCourtName(customer.preferred_court) : '—'} />
          <Row label="الفترة المفضلة" value={customer.preferred_period ? getPeriodName(Number(customer.preferred_period)) : '—'} />
          <Row label="نوع الكود المستخدم" value={customer.preferred_code_type ?? '—'} />
          <Row label="أول حجز" value={customer.first_booking_at ? formatDateTime(customer.first_booking_at) : '—'} />
          <Row label="آخر حجز" value={customer.last_booking_at ? formatDateTime(customer.last_booking_at) : '—'} />
          <Row label="متوسط التقييم" value={<StarDisplay avg={ratingAvg} count={ratingCount} />} />
        </div>

        {/* تعديل البطاقة */}
        <div className="card">
          <div className="cd-card-head">
            <Settings2 size={16} strokeWidth={1.75} />
            <h2>تعديل البطاقة</h2>
          </div>
          <form action={updateCustomer}>
            <input type="hidden" name="customer_id" value={customer.id} />
            <div className="cd-toggles">
              <label className="cd-toggle-label">
                <input type="checkbox" name="is_vip" defaultChecked={customer.is_vip} className="cd-checkbox" />
                <Shield size={14} strokeWidth={2} />
                VIP
              </label>
              <label className="cd-toggle-label">
                <input type="checkbox" name="is_suspended" defaultChecked={customer.is_suspended} className="cd-checkbox" />
                <Ban size={14} strokeWidth={2} />
                موقوف
              </label>
            </div>
            <div className="cd-field">
              <label className="cd-field-label">سبب الإيقاف</label>
              <input type="text" className="input" name="suspension_reason"
                placeholder="سبب إيقاف الحساب..." defaultValue={customer.suspension_reason ?? ''} />
            </div>
            <div className="cd-field">
              <label className="cd-field-label">ملاحظات داخلية</label>
              <textarea className="input" name="internal_notes" rows={3}
                defaultValue={customer.internal_notes ?? ''} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              <Save size={15} strokeWidth={2} />
              حفظ التغييرات
            </button>
          </form>
        </div>

        {/* سجل الحجوزات */}
        <div className="card cd-full-col">
          <div className="cd-card-head">
            <ClipboardList size={16} strokeWidth={1.75} />
            <h2>سجل الحجوزات <span className="cd-count">({bookings.length})</span></h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>التاريخ</th><th>الملعب</th><th>الفترة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>لا توجد حجوزات</td></tr>
                )}
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td>{b.booking_date}</td>
                    <td>{getCourtName(b.court_id)}</td>
                    <td>{getPeriodName(b.period_number)}</td>
                    <td style={{ fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'], color: 'var(--color-lime)' }}>{formatAmount(b.final_price)}</td>
                    <td><span className={`badge ${STATUS_STYLE[b.status] ?? ''}`}>{STATUS_LABEL[b.status] ?? b.status}</span></td>
                    <td><Link href={`/admin/bookings/${b.id}`} className="btn btn-secondary btn-sm">تفاصيل</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* تقييمات العميل */}
        <div className="card cd-full-col">
          <div className="cd-card-head">
            <Star size={16} strokeWidth={1.75} />
            <h2>تقييمات العميل <span className="cd-count">({ratingCount})</span></h2>
          </div>
          {ratingCount === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4) 0', margin: 0 }}>لم يُقيَّم أي حجز بعد</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>التاريخ</th><th>التقييم</th><th>التعليق</th><th>الحجز</th></tr></thead>
                <tbody>
                  {ratings.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--color-warning)', letterSpacing: '0.05em' }}>
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </span>
                        {' '}
                        <strong style={{ color: 'var(--color-warning)' }}>{r.rating}/5</strong>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: r.comment ? 'italic' : 'normal' }}>
                        {r.comment ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><Link href={`/admin/bookings/${r.booking_id}`} className="btn btn-secondary btn-sm">الحجز</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* سجل التواصل */}
        <div className="card cd-full-col">
          <div className="cd-card-head">
            <MessageCircle size={16} strokeWidth={1.75} />
            <h2>سجل التواصل</h2>
          </div>
          <form action={addContactLog} className="cd-contact-form">
            <input type="hidden" name="phone" value={customer.phone} />
            <input type="hidden" name="customer_id" value={customer.id} />
            <select name="contact_type" className="input" required>
              <option value="whatsapp">واتساب</option>
              <option value="call">مكالمة</option>
              <option value="sms">SMS</option>
              <option value="other">أخرى</option>
            </select>
            <input type="text" name="offer_sent" className="input" placeholder="العرض المُرسَل (اختياري)" />
            <input type="text" name="notes" className="input" placeholder="ملاحظة..." />
            <button type="submit" className="btn btn-secondary cd-contact-btn">
              <Plus size={14} /> إضافة سجل
            </button>
          </form>
          <div className="cd-logs">
            {logs.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>لا يوجد سجل تواصل</p>}
            {logs.map(log => (
              <div key={log.id} className="cd-log-item">
                <div className="cd-log-meta">
                  {log.contact_type === 'whatsapp' && <span className="badge badge-confirmed"><MessageSquare size={10} /> واتساب</span>}
                  {log.contact_type === 'call' && <span className="badge badge-info"><Phone size={10} /> مكالمة</span>}
                  {log.contact_type === 'sms' && <span className="badge badge-regular"><Hash size={10} /> SMS</span>}
                  {log.contact_type === 'other' && <span className="badge badge-cancelled">أخرى</span>}
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{formatDateTime(log.contacted_at)}</span>
                </div>
                {log.offer_sent && <div className="cd-log-offer">العرض: <strong>{log.offer_sent}</strong></div>}
                {log.notes && <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{log.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .cd-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-5);
        }
        .cd-full-col { grid-column: 1 / -1; }
        @media (max-width: 700px) { .cd-grid { grid-template-columns: 1fr; } }

        .cd-card-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        .cd-card-head > svg { color: var(--color-lime-dim); }
        .cd-card-head h2 {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          margin: 0;
          color: var(--text-primary);
        }
        .cd-count { color: var(--text-muted); font-weight: var(--font-regular); font-size: var(--text-sm); }

        .cd-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) 0;
          border-bottom: 1px solid var(--border-subtle);
          font-size: var(--text-sm);
          gap: var(--space-4);
        }
        .cd-row:last-child { border-bottom: none; }
        .cd-row-label { color: var(--text-muted); flex-shrink: 0; }
        .cd-row-value { font-weight: var(--font-medium); text-align: left; }

        /* checkboxes */
        .cd-toggles {
          display: flex;
          gap: var(--space-6);
          margin-bottom: var(--space-4);
        }
        .cd-toggle-label {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .cd-checkbox { accent-color: var(--color-lime); cursor: pointer; }

        .cd-field { margin-bottom: var(--space-3); }
        .cd-field-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }

        /* سجل التواصل */
        .cd-contact-form {
          display: grid;
          grid-template-columns: repeat(3, 1fr) auto;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
          align-items: end;
        }
        @media (max-width: 640px) { .cd-contact-form { grid-template-columns: 1fr; } }
        .cd-contact-btn { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; }
        .cd-logs { display: flex; flex-direction: column; gap: var(--space-2); }
        .cd-log-item {
          padding: var(--space-3) var(--space-4);
          background: var(--bg-elevated);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          border: 1px solid var(--border-subtle);
        }
        .cd-log-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
        }
        .cd-log-meta .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
        }
        .cd-log-offer {
          color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }

        /* badge-info مخصص لسجل التواصل */
        .badge-info {
          background: var(--color-info-bg);
          color: var(--color-info);
          border: 1px solid rgba(74,158,191,.25);
        }
        [data-theme="light"] .badge-info { color: #0F4F6A; }
      `}</style>
    </div>
  )
}
