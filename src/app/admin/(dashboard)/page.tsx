import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { formatAmount, getPeriodName } from '@/lib/utils'
import { fetchCourtNames } from '@/hooks/useCourtNames'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'
import {
  TrendingUp, CalendarDays, Clock3, FileCheck2,
  PenLine, ArrowLeft, CheckCheck,
} from 'lucide-react'

export const metadata: Metadata = { title: 'الرئيسية' }

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', uploaded: 'badge-uploaded', confirmed: 'badge-confirmed',
  rejected: 'badge-rejected', cancelled: 'badge-cancelled', expired: 'badge-expired',
}

export default async function AdminDashboard() {
  const supabase = createAdminClient()

  const [statsRes, pendingRes, recentRes] = await Promise.all([
    supabase.from('dashboard_stats').select('*').single(),
    supabase.from('bookings')
      .select('id,booking_date,court_id,period_number,customer_name,customer_phone,final_price,created_at')
      .eq('status', 'uploaded').order('created_at', { ascending: false }).limit(10),
    supabase.from('bookings')
      .select('id,booking_date,court_id,period_number,customer_name,final_price,status,created_at')
      .order('created_at', { ascending: false }).limit(8),
  ])

  // أسماء الملاعب الديناميكية من الإعدادات
  let courtMap: Record<string, string> = { football: 'كرة القدم', volleyball: 'الكرة الطائرة', multi: 'السلة' }
  try { courtMap = await fetchCourtNames(supabase) } catch { /* fallback */ }
  const getCourtName = (id: string) => courtMap[id] ?? id

  const stats   = statsRes.data
  const pending = pendingRes.data ?? []
  const recent  = recentRes.data ?? []

  const STAT_CARDS = [
    {
      Icon: TrendingUp,    label: 'إيرادات هذا الأسبوع',
      value: formatAmount(stats?.revenue_this_week ?? 0),
      mod: 'stat-card--lime',
    },
    {
      Icon: CalendarDays,  label: 'إيرادات هذا الشهر',
      value: formatAmount(stats?.revenue_this_month ?? 0),
      mod: 'stat-card--elevated',
    },
    {
      Icon: Clock3,        label: 'حجوزات اليوم',
      value: String(stats?.bookings_today ?? 0),
      mod: 'stat-card--surface',
    },
    {
      Icon: FileCheck2,    label: 'تنتظر الاعتماد',
      value: String(stats?.pending_approval ?? 0),
      mod: `stat-card--warning${(stats?.pending_approval ?? 0) > 0 ? ' stat-card--warning-glow' : ''}`,
    },
  ]

  return (
    <div className="animate-fade-in dh-page">

      {/* ── هيدر الصفحة ── */}
      <div className="dh-topbar">
        <div>
          <h1 className="dh-topbar-title">لوحة التحكم</h1>
          <p className="dh-topbar-sub">نظرة عامة على نشاط المنشأة</p>
        </div>
        <Link href="/admin/bookings/new" id="btn-new-booking" className="btn btn-primary">
          <PenLine size={16} strokeWidth={2} />
          حجز يدوي جديد
        </Link>
      </div>

      {/* ── بطاقات الإحصاء ── */}
      <div className="dh-stats">
        {STAT_CARDS.map(({ Icon, label, value, mod }, i) => (
          <div key={i} className={`stat-card ${mod}`}>
            <div className="stat-icon">
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div className="stat-body">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── الشبكة الرئيسية ── */}
      <div className="dh-grid">

        {/* إيصالات تنتظر الاعتماد */}
        <div className="card dh-card">
          <div className="dh-card-head">
            <div className="dh-card-title">
              <FileCheck2 size={16} strokeWidth={1.75} />
              تنتظر الاعتماد
              {pending.length > 0 && (
                <span className="dh-badge-count">{pending.length}</span>
              )}
            </div>
            <Link href="/admin/bookings?status=uploaded" className="dh-see-all">
              عرض الكل
              <ArrowLeft size={13} strokeWidth={2} />
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="dh-empty">
              <CheckCheck size={24} strokeWidth={1.5} />
              <span>لا توجد إيصالات معلّقة</span>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>الملعب</th>
                    <th>التاريخ</th>
                    <th>المبلغ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'] }}>{b.customer_name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{b.customer_phone}</div>
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
                        <Link href={`/admin/bookings/${b.id}`} className="dh-review-btn">مراجعة</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* آخر الحجوزات */}
        <div className="card dh-card">
          <div className="dh-card-head">
            <div className="dh-card-title">
              <Clock3 size={16} strokeWidth={1.75} />
              آخر الحجوزات
            </div>
            <Link href="/admin/bookings" className="dh-see-all">
              عرض الكل
              <ArrowLeft size={13} strokeWidth={2} />
            </Link>
          </div>

          <div className="dh-recent-list">
            {recent.map(b => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`} className="dh-mini-card">
                <div className="dh-mini-info">
                  <div className="dh-mini-name">{b.customer_name}</div>
                  <div className="dh-mini-meta">
                    {getCourtName(b.court_id)} · {getPeriodName(b.period_number)} · {b.booking_date}
                  </div>
                </div>
                <div className="dh-mini-right">
                  <span className="dh-mini-price">{formatAmount(b.final_price)}</span>
                  <span className={`badge ${STATUS_STYLE[b.status] ?? 'badge-cancelled'}`}>
                    {STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status}
                  </span>
                </div>
              </Link>
            ))}
            {recent.length === 0 && (
              <div className="dh-empty">
                <CalendarDays size={24} strokeWidth={1.5} />
                <span>لا توجد حجوزات بعد</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .dh-page { }

        /* ── هيدر ── */
        .dh-topbar {
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-2xl);
          padding: var(--space-5) var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-5);
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        @media (max-width: 600px) {
          .dh-topbar { flex-direction: column; align-items: stretch; }
          .dh-topbar .btn { width: 100%; justify-content: center; }
        }
        .dh-topbar-title {
          font-size: var(--text-2xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0 0 var(--space-1);
        }
        .dh-topbar-sub {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin: 0;
        }

        /* ── بطاقات الإحصاء ── */
        .dh-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
          margin-bottom: var(--space-5);
          width: 100%;
          box-sizing: border-box;
        }
        @media (min-width: 900px) { .dh-stats { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 600px) {
          .dh-stats { gap: var(--space-2); }
          .stat-card { padding: var(--space-3); }
          .stat-icon { display: none; }
        }

        .stat-card {
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
          padding: var(--space-4) var(--space-5);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }

        /* lime — إيرادات الأسبوع */
        .stat-card--lime {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
        }
        .stat-card--lime .stat-icon { background: var(--color-lime-glow); color: var(--color-lime); }
        .stat-card--lime .stat-value { color: var(--color-lime); }
        .stat-card--lime .stat-label { color: var(--text-muted); }

        /* elevated — إيرادات الشهر */
        .stat-card--elevated {
          background: var(--bg-elevated);
          border-color: var(--border-color);
        }
        .stat-card--elevated .stat-icon { background: var(--bg-surface); color: var(--text-secondary); }
        .stat-card--elevated .stat-value { color: var(--text-primary); }
        .stat-card--elevated .stat-label { color: var(--text-muted); }

        /* surface — حجوزات اليوم */
        .stat-card--surface {
          background: var(--bg-surface);
          border-color: var(--border-subtle);
        }
        .stat-card--surface .stat-icon { background: var(--bg-elevated); color: var(--text-secondary); }
        .stat-card--surface .stat-value { color: var(--text-primary); }
        .stat-card--surface .stat-label { color: var(--text-muted); }

        /* warning — تنتظر الاعتماد */
        .stat-card--warning {
          background: var(--color-warning-bg);
          border-color: var(--color-warning);
        }
        .stat-card--warning .stat-icon { background: rgba(245,166,35,.2); color: var(--color-warning); }
        .stat-card--warning .stat-value { color: var(--color-warning); }
        .stat-card--warning .stat-label { color: var(--text-muted); }
        .stat-card--warning-glow {
          box-shadow: 0 0 0 2px rgba(245,166,35,.2), var(--shadow-sm);
          animation: pulse-warning 2s ease-in-out infinite;
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 0 0 2px rgba(245,166,35,.2); }
          50%       { box-shadow: 0 0 0 4px rgba(245,166,35,.35); }
        }

        .stat-icon {
          width: 44px; height: 44px;
          border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .stat-body {}
        .stat-value { font-size: var(--text-2xl); font-weight: var(--font-black); line-height: 1; margin-bottom: var(--space-1); }
        .stat-label { font-size: var(--text-xs); font-weight: var(--font-medium); }

        /* ── الشبكة الرئيسية ── */
        .dh-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-5);
        }
        @media (min-width: 900px) { .dh-grid { grid-template-columns: 1.4fr 1fr; } }

        /* ── رأس الكرت ── */
        .dh-card {}
        .dh-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          gap: var(--space-2);
        }
        .dh-card-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .dh-card-title > svg { color: var(--color-lime-dim); }
        .dh-badge-count {
          background: var(--color-warning);
          color: var(--bg-base);
          font-size: var(--text-xs);
          font-weight: var(--font-black);
          padding: 0.1em 0.5em;
          border-radius: var(--radius-full);
          min-width: 20px;
          text-align: center;
        }
        .dh-see-all {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-lime-dim);
          text-decoration: none;
          transition: color 0.15s, gap 0.15s;
          white-space: nowrap;
        }
        .dh-see-all:hover { color: var(--color-lime); gap: var(--space-2); opacity: 1; }

        .dh-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          text-align: center;
          padding: var(--space-6);
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        /* ── زر مراجعة ── */
        .dh-review-btn {
          display: inline-flex; align-items: center;
          padding: var(--space-1) var(--space-3);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          color: var(--color-lime);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .dh-review-btn:hover {
          background: var(--color-lime-glow);
          box-shadow: 0 0 0 2px var(--color-lime-glow);
          opacity: 1;
        }

        /* ── قائمة الحجوزات الأخيرة ── */
        .dh-recent-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .dh-mini-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
          text-decoration: none;
          gap: var(--space-3);
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .dh-mini-card:hover {
          border-color: var(--color-lime-dim);
          background: var(--color-lime-muted);
          transform: translateX(-2px);
          opacity: 1;
        }
        .dh-mini-info { flex: 1; min-width: 0; }
        .dh-mini-name {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dh-mini-meta {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dh-mini-right {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .dh-mini-price {
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--color-lime);
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
