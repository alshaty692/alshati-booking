import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { formatAmount, formatDateTime, getCourtName } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/types'
import Link from 'next/link'

export const metadata: Metadata = { title: 'العملاء' }

interface Props { searchParams: Promise<{ q?: string; classification?: string; vip?: string }> }

const CLASS_STYLE: Record<string, string> = {
  gold:'badge-gold', regular:'badge-regular', inactive:'badge-inactive', new:'badge-new',
}

// مساعد: عرض النجوم النصي
function ratingDisplay(avg: number | null, count: number): string {
  if (avg === null || count === 0) return '—'
  return `⭐ ${avg.toFixed(1)} (${count})`
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = createAdminClient()

  let query = supabase.from('customers').select('*').order('last_booking_at', { ascending: false }).limit(200)

  if (params.q) query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`)
  if (params.classification) query = query.eq('classification', params.classification)
  if (params.vip === '1') query = query.eq('is_vip', true)

  const { data: customers } = await query

  // جلب متوسط التقييمات لكل عميل دفعة واحدة من السيرفر
  // نجلب booking_id لكل حجز لكل عميل، ثم AVG(rating) من booking_ratings
  type RatingRow = { phone: string; avg: number | null; count: number }
  let ratingMap: Record<string, RatingRow> = {}

  if ((customers ?? []).length > 0) {
    const phones = (customers ?? []).map(c => c.phone)

    // جلب تقييمات كل الحجوزات المرتبطة بأرقام هؤلاء العملاء
    const { data: ratingsRaw } = await supabase
      .from('booking_ratings')
      .select('phone, rating')
      .in('phone', phones)

    // تجميع AVG و COUNT لكل phone
    const grouped: Record<string, number[]> = {}
    ;(ratingsRaw ?? []).forEach(r => {
      if (!grouped[r.phone]) grouped[r.phone] = []
      grouped[r.phone].push(r.rating)
    })

    Object.entries(grouped).forEach(([phone, ratings]) => {
      const sum = ratings.reduce((s, v) => s + v, 0)
      ratingMap[phone] = {
        phone,
        avg: Math.round((sum / ratings.length) * 10) / 10,
        count: ratings.length,
      }
    })
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">العملاء</h1>
          <p className="page-subtitle">{customers?.length ?? 0} عميل</p>
        </div>
      </div>

      {/* بحث وفلتر */}
      <form method="GET" action="/admin/customers" style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <input name="q" type="search" className="input" defaultValue={params.q} placeholder="ابحث بالاسم أو الجوال..." style={{ flex:1, minWidth:200 }} />
        <select name="classification" className="input" defaultValue={params.classification ?? ''} style={{ width:150 }}>
          <option value="">كل التصنيفات</option>
          <option value="gold">ذهبي ⭐</option>
          <option value="regular">منتظم</option>
          <option value="inactive">غير نشط</option>
          <option value="new">جديد</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.875rem', fontWeight:600 }}>
          <input type="checkbox" name="vip" value="1" defaultChecked={params.vip === '1'} />
          VIP فقط
        </label>
        <button type="submit" className="btn btn-secondary">🔍 بحث</button>
        <Link href="/admin/customers" className="btn btn-secondary">✕ مسح</Link>
      </form>

      {/* الجدول */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>الجوال</th>
                <th>الحجوزات</th>
                <th>إجمالي المدفوع</th>
                <th>الملعب المفضل</th>
                <th>التقييم</th>
                <th>آخر حجز</th>
                <th>التصنيف</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text-muted)', padding:'3rem' }}>لا توجد نتائج</td></tr>
              )}
              {(customers ?? []).map(c => {
                const r = ratingMap[c.phone] ?? null
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight:600 }}>{c.name}</div>
                      <div style={{ display:'flex', gap:'0.3rem', marginTop:'0.2rem', flexWrap:'wrap' }}>
                        {c.is_vip && <span className="badge badge-gold">⭐ VIP</span>}
                        {c.is_suspended && <span className="badge badge-rejected">موقوف</span>}
                      </div>
                    </td>
                    <td style={{ direction:'ltr', textAlign:'right' }}>{c.phone}</td>
                    <td style={{ fontWeight:700, textAlign:'center' }}>{c.total_bookings}</td>
                    <td style={{ fontWeight:700, color:'var(--color-primary)' }}>{formatAmount(c.total_paid)}</td>
                    <td>{c.preferred_court ? getCourtName(c.preferred_court) : <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontWeight:600, color: r ? '#92400e' : 'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {ratingDisplay(r?.avg ?? null, r?.count ?? 0)}
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                      {c.last_booking_at ? formatDateTime(c.last_booking_at).split('،')[0] : '—'}
                    </td>
                    <td>
                      <span className={`badge ${CLASS_STYLE[c.classification] ?? ''}`}>
                        {CLASSIFICATION_LABELS[c.classification as keyof typeof CLASSIFICATION_LABELS] ?? c.classification}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="btn btn-secondary btn-sm">بطاقة</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
        .page-title  { font-size:1.6rem; margin:0 0 0.2rem; }
        .page-subtitle { color:var(--text-muted); font-size:0.875rem; margin:0; }
      `}</style>
    </div>
  )
}
