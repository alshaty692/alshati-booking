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
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        @media (min-width:480px)  { .kpi-strip { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width:900px)  { .kpi-strip { grid-template-columns: repeat(6, 1fr); } }

        .kpi-card {
          background: #fff;
          border-radius: 0.875rem;
          border: 1px solid #e2e8f0;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          animation: fadeInUp 0.4s ease both;
          transition: all 0.2s;
        }
        .kpi-card:hover { box-shadow:0 4px 16px rgba(27,42,59,.1); transform:translateY(-2px); }
        .kpi-card-warn { border-color: #fca5a5; }

        .kpi-icon  { font-size:1.5rem; flex-shrink:0; }
        .kpi-value { font-size:1.1rem; font-weight:800; color:#1B2A3B; line-height:1; margin-bottom:0.2rem; }
        .kpi-label { font-size:0.7rem; color:#94a3b8; font-weight:500; }

        @media (max-width:480px) {
          .kpi-icon  { font-size:1.2rem; }
          .kpi-value { font-size:0.95rem; }
          .kpi-card  { padding:0.75rem; gap:0.5rem; }
        }

        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  )
}
