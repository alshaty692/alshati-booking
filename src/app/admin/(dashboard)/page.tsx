import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'

export const metadata: Metadata = { title: 'الرئيسية' }

// ── ألوان الهوية ───────────────────────────────────────
const C = {
  navy:  '#1B2A3B',
  green: '#2D5C4E',
  gold:  '#C9A96E',
  beige: '#F5F2EC',
  white: '#ffffff',
}

const STATUS_STYLE: Record<string, string> = {
  pending:'badge-pending', uploaded:'badge-uploaded', confirmed:'badge-confirmed',
  rejected:'badge-rejected', cancelled:'badge-cancelled', expired:'badge-expired',
}

export default async function AdminDashboard() {
  // ── Admin Client يتجاوز RLS ─────────────────────────────
  const supabase = createAdminClient()

  const [statsRes, pendingRes, recentRes] = await Promise.all([
    supabase.from('dashboard_stats').select('*').single(),
    supabase.from('bookings')
      .select('id,booking_date,court_id,period_number,customer_name,customer_phone,final_price,created_at')
      .eq('status','uploaded').order('created_at',{ascending:false}).limit(10),
    supabase.from('bookings')
      .select('id,booking_date,court_id,period_number,customer_name,final_price,status,created_at')
      .order('created_at',{ascending:false}).limit(8),
  ])

  const stats   = statsRes.data
  const pending = pendingRes.data ?? []
  const recent  = recentRes.data ?? []

  // ── بطاقات الإحصاء (مصمَّمة حسب الموك-أب) ──────────
  const STAT_CARDS = [
    {
      icon:'💰', label:'إيرادات هذا الأسبوع',
      value: formatAmount(stats?.revenue_this_week ?? 0),
      bg: C.navy, valuColor: C.gold, labelColor:'rgba(255,255,255,.65)',
      iconBg: 'rgba(201,169,110,.2)',
    },
    {
      icon:'📅', label:'إيرادات هذا الشهر',
      value: formatAmount(stats?.revenue_this_month ?? 0),
      bg: C.green, valuColor: C.gold, labelColor:'rgba(255,255,255,.7)',
      iconBg: 'rgba(255,255,255,.15)',
    },
    {
      icon:'🏟️', label:'حجوزات اليوم',
      value: String(stats?.bookings_today ?? 0),
      bg: C.white, valuColor: C.navy, labelColor:'var(--text-muted)',
      iconBg: '#F5F2EC',
    },
    {
      icon:'⏳', label:'تنتظر الاعتماد',
      value: String(stats?.pending_approval ?? 0),
      bg: C.gold, valuColor: C.navy, labelColor: 'rgba(27,42,59,.7)',
      iconBg: 'rgba(27,42,59,.12)',
    },
  ]

  return (
    <div className="admin-dashboard animate-fade-in">

      {/* ── هيدر علوي ملوّن ── */}
      <div className="dash-topbar">
        <div>
          <h1 className="dash-topbar-title">لوحة التحكم</h1>
          <p className="dash-topbar-sub">مرحباً بك في مركز حي الشاطئ</p>
        </div>
        <Link href="/admin/bookings/new" id="btn-new-booking" className="btn-gold">
          ✏️ حجز يدوي جديد
        </Link>
      </div>

      {/* ── بطاقات الإحصاء ── */}
      <div className="stats-grid">
        {STAT_CARDS.map((card, i) => (
          <div key={i} className="stat-card-v2"
            style={{ background: card.bg, borderColor: card.bg === C.white ? '#E2DDD4' : 'transparent' }}>
            <div className="stat-card-v2-icon" style={{ background: card.iconBg }}>{card.icon}</div>
            <div>
              <div className="stat-card-v2-value" style={{ color: card.valuColor }}>{card.value}</div>
              <div className="stat-card-v2-label" style={{ color: card.labelColor }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── الشبكة الرئيسية ── */}
      <div className="dashboard-grid">

        {/* إيصالات تنتظر الاعتماد */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">⏳ تنتظر الاعتماد
              {pending.length > 0 &&
                <span className="dash-badge-count">{pending.length}</span>}
            </h2>
            <Link href="/admin/bookings?status=uploaded" className="dash-link-sm">عرض الكل ←</Link>
          </div>
          {pending.length === 0 ? (
            <div className="dash-empty">لا توجد إيصالات معلّقة ✓</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>العميل</th><th>الملعب</th><th>التاريخ</th><th>المبلغ</th><th></th></tr>
                </thead>
                <tbody>
                  {pending.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight:700 }}>{b.customer_name}</div>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{b.customer_phone}</div>
                      </td>
                      <td>
                        <div>{getCourtName(b.court_id)}</div>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{getPeriodName(b.period_number)}</div>
                      </td>
                      <td style={{ fontSize:'0.85rem', whiteSpace:'nowrap' }}>{b.booking_date}</td>
                      <td style={{ fontWeight:800, color:C.green }}>{formatAmount(b.final_price)}</td>
                      <td>
                        <Link href={`/admin/bookings/${b.id}`} className="dash-review-btn">مراجعة</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* آخر الحجوزات */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">🕐 آخر الحجوزات</h2>
            <Link href="/admin/bookings" className="dash-link-sm">عرض الكل ←</Link>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {recent.map(b => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`} className="booking-mini-card">
                <div>
                  <div style={{ fontWeight:700, fontSize:'0.875rem', color:C.navy }}>{b.customer_name}</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.15rem' }}>
                    {getCourtName(b.court_id)} · {getPeriodName(b.period_number)} · {b.booking_date}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexShrink:0 }}>
                  <span style={{ fontWeight:800, color:C.green, fontSize:'0.875rem' }}>{formatAmount(b.final_price)}</span>
                  <span className={`badge ${STATUS_STYLE[b.status] ?? 'badge-cancelled'}`}>
                    {STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status}
                  </span>
                </div>
              </Link>
            ))}
            {recent.length === 0 && <div className="dash-empty">لا توجد حجوزات بعد</div>}
          </div>
        </div>
      </div>

      <style>{`
        /* ── الهيدر الملوّن ── */
        .dash-topbar {
          background: ${C.green};
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
          flex-wrap: wrap;
          box-shadow: 0 4px 16px rgba(45,92,78,.25);
        }
        .dash-topbar-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: ${C.white};
          margin: 0 0 0.2rem;
        }
        .dash-topbar-sub {
          color: rgba(255,255,255,.7);
          font-size: 0.875rem;
          margin: 0;
        }

        /* ── زر الذهبي ── */
        .btn-gold {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1.25rem;
          background: ${C.gold};
          color: ${C.navy};
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.9rem;
          text-decoration: none !important;
          transition: all 0.18s ease;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          white-space: nowrap;
        }
        .btn-gold:hover { background: #d4b77a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(201,169,110,.4); }

        /* ── بطاقات الإحصاء ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 0.75rem !important;
          }
          .dash-topbar { flex-direction: column; align-items: stretch; text-align: center; gap: 0.75rem; }
          .btn-gold { width: 100%; text-align: center; }
          .stat-card-v2-icon { width: 2.5rem; height: 2.5rem; font-size: 1.1rem; }
          .stat-card-v2-value { font-size: 1.2rem !important; }
          .table-container { overflow-x: auto; }
        }

        .stat-card-v2 {
          border-radius: 14px;
          border: 0.5px solid transparent;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 2px 10px rgba(27,42,59,.1);
        }
        .stat-card-v2:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(27,42,59,.18); }
        .stat-card-v2-icon {
          width: 3rem; height: 3rem;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; flex-shrink: 0;
        }
        .stat-card-v2-value { font-size: 1.6rem; font-weight: 800; line-height: 1; margin-bottom: 0.2rem; }
        .stat-card-v2-label { font-size: 0.78rem; font-weight: 500; }

        /* ── شبكة الداشبورد ── */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 900px) { .dashboard-grid { grid-template-columns: 1fr; } }

        /* ── كرت الداشبورد ── */
        .dash-card {
          background: ${C.white};
          border-radius: 14px;
          border: 0.5px solid #E2DDD4;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(27,42,59,.07);
        }
        .dash-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1rem; gap: 0.5rem;
        }
        .dash-card-title {
          font-size: 0.975rem; font-weight: 800; margin: 0;
          color: ${C.navy}; display: flex; align-items: center; gap: 0.5rem;
        }
        .dash-badge-count {
          background: ${C.gold}; color: ${C.navy};
          font-size: 0.72rem; font-weight: 800;
          padding: 0.1rem 0.45rem; border-radius: 99px;
        }
        .dash-link-sm {
          font-size: 0.82rem; font-weight: 700; color: ${C.green};
          text-decoration: none !important;
          transition: color 0.15s;
        }
        .dash-link-sm:hover { color: ${C.navy}; }

        .dash-empty {
          text-align: center; padding: 2rem;
          color: var(--text-muted); font-size: 0.9rem;
        }

        /* ── زر مراجعة ── */
        .dash-review-btn {
          display: inline-flex; align-items: center;
          padding: 0.3rem 0.75rem;
          background: ${C.navy}; color: ${C.gold};
          border-radius: 7px; font-size: 0.8rem; font-weight: 700;
          text-decoration: none !important; transition: all 0.15s;
          white-space: nowrap;
        }
        .dash-review-btn:hover { background: ${C.green}; color: #fff; }

        /* ── بطاقة الحجز الصغيرة ── */
        .booking-mini-card {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.7rem 0.875rem;
          border-radius: 10px;
          border: 0.5px solid #E2DDD4;
          background: ${C.beige};
          transition: all 0.15s ease;
          text-decoration: none !important;
          gap: 0.75rem;
        }
        .booking-mini-card:hover {
          border-color: ${C.green};
          background: #eef5f2;
          transform: translateX(-2px);
        }
      `}</style>
    </div>
  )
}
