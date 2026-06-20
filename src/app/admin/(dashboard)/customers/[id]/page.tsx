import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/types'
import Link from 'next/link'

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
    // تقييمات العميل عبر رقم الجوال (كل تاريخه بدون حد زمني)
    supabase
      .from('booking_ratings')
      .select('rating, comment, created_at, booking_id')
      .eq('phone', phone)
      .order('created_at', { ascending: false }),
  ])

  const bookings = bookingsRes.data ?? []
  const logs     = logsRes.data ?? []
  const ratings  = ratingsRes.data ?? []

  // AVG و COUNT محسوبان في السيرفر
  const ratingCount = ratings.length
  const ratingAvg   = ratingCount > 0
    ? Math.round(ratings.reduce((s, r) => s + r.rating, 0) / ratingCount * 10) / 10
    : null

  const CLASS_STYLE: Record<string, string> = {
    gold:'badge-gold', regular:'badge-regular', inactive:'badge-inactive', new:'badge-new',
  }
  const STATUS_STYLE: Record<string, string> = {
    pending:'badge-pending', uploaded:'badge-uploaded', confirmed:'badge-confirmed',
    rejected:'badge-rejected', cancelled:'badge-cancelled', expired:'badge-expired',
  }
  const STATUS_LABEL: Record<string, string> = {
    pending:'بانتظار الإيصال', uploaded:'قيد المراجعة', confirmed:'مؤكد',
    rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي',
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <Link href="/admin/customers" style={{ color:'var(--color-primary)', fontWeight:600, textDecoration:'none' }}>← العملاء</Link>
        <h1 style={{ fontSize:'1.4rem', margin:0 }}>{customer.name}</h1>
        <span className={`badge ${CLASS_STYLE[customer.classification] ?? ''}`}>{CLASSIFICATION_LABELS[customer.classification as keyof typeof CLASSIFICATION_LABELS] ?? customer.classification}</span>
        {customer.is_vip && <span className="badge badge-gold">⭐ VIP</span>}
        {customer.is_suspended && <span className="badge badge-rejected">موقوف</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        {/* إحصائيات */}
        <div className="card">
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📊 الإحصائيات</h2>
          <Row label="الجوال" value={customer.phone} />
          <Row label="إجمالي الحجوزات" value={<strong>{customer.total_bookings}</strong>} />
          <Row label="إجمالي المدفوع" value={<strong style={{ color:'var(--color-primary)' }}>{formatAmount(customer.total_paid)}</strong>} />
          <Row label="الملعب المفضل" value={customer.preferred_court ? getCourtName(customer.preferred_court) : '—'} />
          <Row label="الفترة المفضلة" value={customer.preferred_period ? getPeriodName(Number(customer.preferred_period)) : '—'} />
          <Row label="نوع الكود المستخدم" value={customer.preferred_code_type ?? '—'} />
          <Row label="أول حجز" value={customer.first_booking_at ? formatDateTime(customer.first_booking_at) : '—'} />
          <Row label="آخر حجز" value={customer.last_booking_at ? formatDateTime(customer.last_booking_at) : '—'} />
          <Row
            label="متوسط التقييم ⭐"
            value={
              ratingAvg !== null
                ? <strong style={{ color:'#92400e' }}>
                    {'★'.repeat(Math.round(ratingAvg))}{'☆'.repeat(5 - Math.round(ratingAvg))}{' '}
                    {ratingAvg.toFixed(1)} / 5{' '}
                    <span style={{ color:'var(--text-muted)', fontWeight:400 }}>({ratingCount} تقييم)</span>
                  </strong>
                : <span style={{ color:'var(--text-muted)' }}>لا تقييمات بعد</span>
            }
          />
        </div>

        {/* تعديل البطاقة */}
        <div className="card">
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem' }}>⚙️ تعديل البطاقة</h2>
          <form action={updateCustomer}>
            <input type="hidden" name="customer_id" value={customer.id} />
            <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:600, fontSize:'0.875rem', cursor:'pointer' }}>
                <input type="checkbox" name="is_vip" defaultChecked={customer.is_vip} />
                VIP ⭐
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:600, fontSize:'0.875rem', cursor:'pointer' }}>
                <input type="checkbox" name="is_suspended" defaultChecked={customer.is_suspended} />
                موقوف 🚫
              </label>
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.875rem', marginBottom:'0.35rem' }}>سبب الإيقاف</label>
              <input type="text" className="input" name="suspension_reason" placeholder="سبب إيقاف الحساب..." defaultValue={customer.suspension_reason ?? ''} />
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.875rem', marginBottom:'0.35rem' }}>ملاحظات داخلية</label>
              <textarea className="input" name="internal_notes" rows={3} defaultValue={customer.internal_notes ?? ''} style={{ resize:'vertical' }} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">💾 حفظ التغييرات</button>
          </form>
        </div>

        {/* سجل الحجوزات */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📋 سجل الحجوزات ({bookings.length})</h2>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>التاريخ</th><th>الملعب</th><th>الفترة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {bookings.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>لا توجد حجوزات</td></tr>}
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td>{b.booking_date}</td>
                    <td>{getCourtName(b.court_id)}</td>
                    <td>{getPeriodName(b.period_number)}</td>
                    <td style={{ fontWeight:700, color:'var(--color-primary)' }}>{formatAmount(b.final_price)}</td>
                    <td><span className={`badge ${STATUS_STYLE[b.status] ?? ''}`}>{STATUS_LABEL[b.status] ?? b.status}</span></td>
                    <td><Link href={`/admin/bookings/${b.id}`} className="btn btn-secondary btn-sm">تفاصيل</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* تقييمات العميل */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem' }}>⭐ تقييمات العميل ({ratingCount})</h2>
          {ratingCount === 0 ? (
            <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'1rem 0', margin:0 }}>لم يُقيَّم أي حجز بعد</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>التقييم</th>
                    <th>التعليق</th>
                    <th>الحجز</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize:'0.85rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                        {formatDateTime(r.created_at)}
                      </td>
                      <td style={{ whiteSpace:'nowrap' }}>
                        <span style={{ color:'#f59e0b', fontSize:'1.1rem', letterSpacing:'0.05em' }}>
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </span>{' '}
                        <strong style={{ color:'#92400e' }}>{r.rating}/5</strong>
                      </td>
                      <td style={{ fontSize:'0.875rem', color:'var(--text-secondary)', fontStyle: r.comment ? 'italic' : 'normal' }}>
                        {r.comment ?? <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        <Link href={`/admin/bookings/${r.booking_id}`} className="btn btn-secondary btn-sm">الحجز</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* سجل التواصل */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem' }}>💬 سجل التواصل</h2>
          <form action={addContactLog} style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
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
            <button type="submit" className="btn btn-secondary" style={{ gridColumn:'1/-1', maxWidth:200 }}>+ إضافة سجل تواصل</button>
          </form>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {logs.length === 0 && <p style={{ color:'var(--text-muted)', textAlign:'center' }}>لا يوجد سجل تواصل</p>}
            {logs.map(log => (
              <div key={log.id} style={{ padding:'0.75rem', background:'var(--bg-muted)', borderRadius:'0.5rem', fontSize:'0.875rem' }}>
                <div style={{ display:'flex', gap:'0.75rem', marginBottom:'0.25rem' }}>
                  <span className="badge badge-regular">{log.contact_type}</span>
                  <span style={{ color:'var(--text-muted)' }}>{formatDateTime(log.contacted_at)}</span>
                </div>
                {log.offer_sent && <div>العرض: <strong>{log.offer_sent}</strong></div>}
                {log.notes && <div style={{ color:'var(--text-secondary)' }}>{log.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) { div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; } }
        .detail-row { display:flex; justify-content:space-between; padding:0.55rem 0; border-bottom:1px solid var(--border-color); font-size:0.9rem; }
        .detail-row:last-child { border-bottom:none; }
        .detail-label { color:var(--text-muted); flex-shrink:0; }
      `}</style>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span style={{ fontWeight:500 }}>{value}</span>
    </div>
  )
}
