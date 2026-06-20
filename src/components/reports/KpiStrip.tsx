'use client'
// ============================================================
// KpiStrip — شريط الـ KPIs الرئيسية (5 بطاقات)
// ============================================================
import { formatAmount } from '@/lib/utils'
import type { ReportKpis } from '@/types/reports'

interface KpiStripProps {
  kpis:    ReportKpis
  loading: boolean
}

export default function KpiStrip({ kpis, loading }: KpiStripProps) {
  const cards = [
    { id: 'revenue',   label: 'الإيرادات الصافية', icon: '💰', value: formatAmount(kpis.total_revenue),     type: 'amount' },
    { id: 'confirmed', label: 'المؤكدة',            icon: '✅', value: String(kpis.confirmed_count),         type: 'count'  },
    { id: 'discount',  label: 'الخصومات',           icon: '🏷️', value: formatAmount(kpis.total_discount),   type: 'amount' },
    { id: 'water',     label: 'إيرادات المياه',     icon: '💧', value: formatAmount(kpis.water_revenue),    type: 'amount' },
    { id: 'avg',       label: 'متوسط الحجز',        icon: '📊', value: formatAmount(kpis.avg_booking_value), type: 'amount' },
  ]

  return (
    <div className="kpi-strip">
      {cards.map((c, i) => (
        <div key={c.id} id={`kpi-${c.id}`} className="kpi-card" style={{ animationDelay: `${i * 0.07}s` }}>
          <div className="kpi-icon">{c.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value">{loading ? '…' : c.value}</div>
            <div className="kpi-label">{c.label}</div>
          </div>
        </div>
      ))}

      {/* مؤشر إضافي: نسبة الإلغاء */}
      <div id="kpi-cancel" className="kpi-card kpi-card-warn" style={{ animationDelay: '0.35s' }}>
        <div className="kpi-icon">❌</div>
        <div className="kpi-body">
          <div className="kpi-value">{loading ? '…' : `${kpis.cancellation_rate}%`}</div>
          <div className="kpi-label">نسبة الإلغاء</div>
        </div>
      </div>

      <style>{`
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
          margin-bottom: var(--space-5);
        }
        @media (min-width:480px)  { .kpi-strip { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width:900px)  { .kpi-strip { grid-template-columns: repeat(6, 1fr); } }

        .kpi-card {
          background: var(--bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          animation: fadeInUp 0.4s ease both;
          transition: all 0.2s;
        }
        .kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .kpi-card-warn { border-color: rgba(224,85,85,.3); }

        .kpi-icon  { font-size:1.4rem; flex-shrink:0; }
        .kpi-value { font-size:var(--text-lg); font-weight:var(--font-black); color:var(--text-primary); line-height:1; margin-bottom:0.2rem; }
        .kpi-label { font-size:var(--text-xs); color:var(--text-muted); font-weight:var(--font-medium); }

        @media (max-width:480px) {
          .kpi-icon  { font-size:1.1rem; }
          .kpi-value { font-size:var(--text-base); }
          .kpi-card  { padding:var(--space-2) var(--space-3); gap:var(--space-2); }
        }

        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  )
}
