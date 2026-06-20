import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'
import { Search, X, PenLine } from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'

export const metadata: Metadata = { title: 'الحجوزات' }

interface Props { searchParams: Promise<{ status?: string; court?: string; date?: string; q?: string }> }

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', uploaded: 'badge-uploaded', confirmed: 'badge-confirmed',
  rejected: 'badge-rejected', cancelled: 'badge-cancelled', expired: 'badge-expired',
}

const FILTERS = [
  { label: 'الكل',              value: '' },
  { label: 'بانتظار الإيصال',   value: 'pending' },
  { label: 'تنتظر الاعتماد',    value: 'uploaded' },
  { label: 'مؤكدة',             value: 'confirmed' },
  { label: 'مرفوضة',            value: 'rejected' },
  { label: 'ملغاة',             value: 'cancelled' },
]

export default async function BookingsPage({ searchParams }: Props) {
  const params = await searchParams

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return <div>غير مصرح</div>

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

  const buildUrl = (overrides: Record<string, string>) => {
    const p = { ...params, ...overrides }
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/admin/bookings${qs ? '?' + qs : ''}`
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="الحجوزات"
        subtitle={`${bookings?.length ?? 0} حجز`}
        action={
          <Link href="/admin/bookings/new" className="btn btn-primary">
            <PenLine size={16} strokeWidth={2} />
            حجز يدوي
          </Link>
        }
      />

      {/* فلاتر الحالة */}
      <div className="bk-status-tabs">
        {FILTERS.map(f => (
          <Link
            key={f.value}
            href={buildUrl({ status: f.value })}
            className={`bk-tab ${(params.status === f.value || (!params.status && !f.value)) ? 'bk-tab-active' : ''}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* بحث وفلتر */}
      <form method="GET" action="/admin/bookings" className="bk-filters">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <div className="bk-search-wrap">
          <Search size={15} className="bk-search-icon" />
          <input
            name="q" type="search" className="input bk-search-input"
            defaultValue={params.q} placeholder="ابحث باسم أو جوال..."
          />
        </div>
        <select name="court" className="input bk-select" defaultValue={params.court ?? ''}>
          <option value="">كل الملاعب</option>
          <option value="football">كرة القدم</option>
          <option value="volleyball">الكرة الطائرة</option>
          <option value="multi">الملعب المتعدد</option>
        </select>
        <input name="date" type="date" className="input bk-date" defaultValue={params.date} />
        <button type="submit" className="btn btn-secondary btn-sm bk-btn">
          <Search size={14} /> بحث
        </button>
        <Link href="/admin/bookings" className="btn btn-ghost btn-sm">
          <X size={14} /> مسح
        </Link>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>لا توجد نتائج</td></tr>
              )}
              {(bookings ?? []).map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'] }}>{b.customer_name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>{b.customer_phone}</div>
                    {b.is_manual && <span className="badge badge-confirmed" style={{ marginTop: 'var(--space-1)', display: 'inline-block' }}>يدوي</span>}
                  </td>
                  <td>
                    <div style={{ fontSize: 'var(--text-sm)' }}>{getCourtName(b.court_id)}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{getPeriodName(b.period_number)}</div>
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>{b.booking_date}</td>
                  <td style={{ fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'], color: 'var(--color-lime)' }}>
                    {formatAmount(b.final_price)}
                  </td>
                  <td>
                    {b.code_used
                      ? <span className="badge badge-confirmed" style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{b.code_used}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${STATUS_STYLE[b.status] ?? ''}`}>
                      {STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status}
                    </span>
                  </td>
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
        /* فلاتر الحالة — tabs بدل أزرار */
        .bk-status-tabs {
          display: flex;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: var(--space-3);
        }
        .bk-tab {
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .bk-tab:hover { background: var(--bg-elevated); color: var(--text-primary); opacity: 1; }
        .bk-tab-active {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border: 1px solid var(--color-lime-dim);
        }
        [data-theme="light"] .bk-tab-active { color: var(--color-lime); }

        /* شريط الفلتر */
        .bk-filters {
          display: flex;
          gap: var(--space-2);
          margin-bottom: var(--space-5);
          flex-wrap: wrap;
          align-items: center;
        }
        .bk-search-wrap { position: relative; flex: 1; min-width: 180px; }
        .bk-search-icon {
          position: absolute; top: 50%; right: var(--space-3);
          transform: translateY(-50%); color: var(--text-muted); pointer-events: none;
        }
        .bk-search-input { padding-right: calc(var(--space-3) + 15px + var(--space-2)); }
        .bk-select { width: 160px; }
        .bk-date  { width: 160px; }
        .bk-btn   { display: inline-flex; align-items: center; gap: var(--space-1); }
      `}</style>
    </div>
  )
}
