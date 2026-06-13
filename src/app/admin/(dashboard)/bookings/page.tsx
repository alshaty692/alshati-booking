import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'

export const metadata: Metadata = { title: 'الحجوزات' }

interface Props { searchParams: Promise<{ status?: string; court?: string; date?: string; q?: string }> }

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', uploaded: 'badge-uploaded', confirmed: 'badge-confirmed',
  rejected: 'badge-rejected', cancelled: 'badge-cancelled', expired: 'badge-expired',
}

export default async function BookingsPage({ searchParams }: Props) {
  const params = await searchParams

  // ── التحقق من تسجيل الدخول ──────────────────────────────
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return <div>غير مصرح</div>

  // ── القراءة باستخدام Admin Client (يتجاوز RLS) ──────────
  const supabase = createAdminClient()

  let query = supabase
    .from('bookings')
    .select('id,booking_date,court_id,period_number,customer_name,customer_phone,code_used,final_price,status,is_manual,created_at,receipt_url')
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.status) query = query.eq('status', params.status)
  if (params.court)  query = query.eq('court_id', params.court)
  if (params.date)   query = query.eq('booking_date', params.date)
  if (params.q)      query = query.or(`customer_name.ilike.%${params.q}%,customer_phone.ilike.%${params.q}%`)

  const { data: bookings, error } = await query

  if (error) console.error('[BookingsPage]', error)


  const FILTERS = [
    { label: 'الكل', value: '' },
    { label: 'بانتظار الإيصال', value: 'pending' },
    { label: 'تنتظر الاعتماد', value: 'uploaded' },
    { label: 'مؤكدة', value: 'confirmed' },
    { label: 'مرفوضة', value: 'rejected' },
    { label: 'ملغاة', value: 'cancelled' },
  ]

  const buildUrl = (overrides: Record<string, string>) => {
    const p = { ...params, ...overrides }
    const qs = Object.entries(p).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/admin/bookings${qs ? '?' + qs : ''}`
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">الحجوزات</h1>
          <p className="page-subtitle">{bookings?.length ?? 0} حجز</p>
        </div>
        <Link href="/admin/bookings/new" className="btn btn-primary">✏️ حجز يدوي</Link>
      </div>

      {/* فلاتر الحالة */}
      <div className="filter-tabs" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <Link key={f.value} href={buildUrl({ status: f.value })}
            className={`btn btn-sm ${params.status === f.value || (!params.status && !f.value) ? 'btn-primary' : 'btn-secondary'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {/* بحث وفلتر الملعب */}
      <form method="GET" action="/admin/bookings" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <input name="q" type="search" className="input" defaultValue={params.q} placeholder="ابحث باسم أو جوال..." style={{ flex: 1, minWidth: 180 }} />
        <select name="court" className="input" defaultValue={params.court ?? ''} style={{ width: 160 }}>
          <option value="">كل الملاعب</option>
          <option value="football">كرة القدم</option>
          <option value="volleyball">الكرة الطائرة</option>
          <option value="multi">الملعب المتعدد</option>
        </select>
        <input name="date" type="date" className="input" defaultValue={params.date} style={{ width: 160 }} />
        <button type="submit" className="btn btn-secondary">🔍 بحث</button>
        <Link href="/admin/bookings" className="btn btn-secondary">✕ مسح</Link>
      </form>

      {/* الجدول */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>الملعب / الفترة</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الكود</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>لا توجد نتائج</td></tr>
              )}
              {(bookings ?? []).map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                    {b.is_manual && <span className="badge badge-confirmed" style={{ marginTop: '0.2rem' }}>يدوي</span>}
                  </td>
                  <td>
                    <div>{getCourtName(b.court_id)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getPeriodName(b.period_number)}</div>
                  </td>
                  <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{b.booking_date}</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatAmount(b.final_price)}</td>
                  <td>{b.code_used ? <span className="badge badge-confirmed">{b.code_used}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><span className={`badge ${STATUS_STYLE[b.status] ?? ''}`}>{STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status}</span></td>
                  <td>
                    <Link href={`/admin/bookings/${b.id}`} className="btn btn-secondary btn-sm">تفاصيل</Link>
                  </td>
                </tr>
              ))}
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
