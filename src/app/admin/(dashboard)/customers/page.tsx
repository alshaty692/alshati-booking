import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { formatAmount, formatDateTime, getCourtName } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/types'
import Link from 'next/link'
import { Search, X, Star, Users } from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'

export const metadata: Metadata = { title: 'العملاء' }

interface Props { searchParams: Promise<{ q?: string; classification?: string; vip?: string }> }

const CLASS_STYLE: Record<string, string> = {
  gold: 'badge-gold', regular: 'badge-regular', inactive: 'badge-inactive', new: 'badge-new',
}

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
      <Star size={13} strokeWidth={2} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
      <strong style={{ color: 'var(--color-warning)' }}>{avg.toFixed(1)}</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({count})</span>
    </span>
  )
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = createAdminClient()

  let query = supabase.from('customers').select('*').order('last_booking_at', { ascending: false }).limit(200)
  if (params.q) query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`)
  if (params.classification) query = query.eq('classification', params.classification)
  if (params.vip === '1') query = query.eq('is_vip', true)

  const { data: customers } = await query

  type RatingRow = { phone: string; avg: number | null; count: number }
  let ratingMap: Record<string, RatingRow> = {}

  if ((customers ?? []).length > 0) {
    const phones = (customers ?? []).map(c => c.phone)
    const { data: ratingsRaw } = await supabase
      .from('booking_ratings').select('phone, rating').in('phone', phones)

    const grouped: Record<string, number[]> = {}
    ;(ratingsRaw ?? []).forEach(r => {
      if (!grouped[r.phone]) grouped[r.phone] = []
      grouped[r.phone].push(r.rating)
    })
    Object.entries(grouped).forEach(([phone, ratings]) => {
      const sum = ratings.reduce((s, v) => s + v, 0)
      ratingMap[phone] = { phone, avg: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length }
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="العملاء"
        subtitle={`${customers?.length ?? 0} عميل`}
      />

      {/* بحث وفلتر */}
      <form method="GET" action="/admin/customers" className="cu-filters">
        <div className="cu-search-wrap">
          <Search size={15} className="cu-search-icon" />
          <input
            name="q" type="search" className="input cu-search-input"
            defaultValue={params.q} placeholder="ابحث بالاسم أو الجوال..."
          />
        </div>
        <select name="classification" className="input cu-select" defaultValue={params.classification ?? ''}>
          <option value="">كل التصنيفات</option>
          <option value="gold">ذهبي</option>
          <option value="regular">منتظم</option>
          <option value="inactive">غير نشط</option>
          <option value="new">جديد</option>
        </select>
        <label className="cu-vip-label">
          <input type="checkbox" name="vip" value="1" defaultChecked={params.vip === '1'} className="cu-checkbox" />
          <Star size={13} strokeWidth={2} />
          VIP فقط
        </label>
        <button type="submit" className="btn btn-secondary btn-sm cu-btn-search">
          <Search size={14} /> بحث
        </button>
        <Link href="/admin/customers" className="btn btn-ghost btn-sm">
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
                <th>الجوال</th>
                <th style={{ textAlign: 'center' }}>الحجوزات</th>
                <th>إجمالي المدفوع</th>
                <th>الملعب المفضل</th>
                <th>التقييم</th>
                <th>آخر حجز</th>
                <th>التصنيف</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} className="cu-empty">
                    <Users size={28} strokeWidth={1.25} />
                    <span>لا توجد نتائج</span>
                  </td>
                </tr>
              )}
              {(customers ?? []).map(c => {
                const r = ratingMap[c.phone] ?? null
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-semibold)' } as React.CSSProperties}>{c.name}</div>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {c.is_vip && (
                          <span className="badge badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Star size={10} strokeWidth={2} style={{ fill: 'currentColor' }} /> VIP
                          </span>
                        )}
                        {c.is_suspended && <span className="badge badge-rejected">موقوف</span>}
                      </div>
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{c.phone}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'] }}>{c.total_bookings}</td>
                    <td style={{ fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'], color: 'var(--color-lime)' }}>{formatAmount(c.total_paid)}</td>
                    <td>{c.preferred_court ? getCourtName(c.preferred_court) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><StarRating avg={r?.avg ?? null} count={r?.count ?? 0} /></td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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
        .cu-filters {
          display: flex;
          gap: var(--space-2);
          margin-bottom: var(--space-5);
          flex-wrap: wrap;
          align-items: center;
        }
        .cu-search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }
        .cu-search-icon {
          position: absolute;
          top: 50%;
          right: var(--space-3);
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .cu-search-input {
          padding-right: calc(var(--space-3) + 15px + var(--space-2));
        }
        .cu-select { width: 150px; }
        .cu-vip-label {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          white-space: nowrap;
        }
        .cu-checkbox { cursor: pointer; accent-color: var(--color-lime); }
        .cu-btn-search { display: inline-flex; align-items: center; gap: var(--space-1); }

        .cu-empty {
          text-align: center;
          padding: 3rem;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
        }
      `}</style>
    </div>
  )
}
