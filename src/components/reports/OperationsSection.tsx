'use client'
// ============================================================
// OperationsSection — قسم الأداء التشغيلي
// ============================================================
import { formatAmount } from '@/lib/utils'
import type { ReportOperations, ReportKpis } from '@/types/reports'

const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }


interface Props {
  operations: ReportOperations
  kpis:       ReportKpis
  getCourtName: (id: string) => string
}

function OccupancyMeter({ rate }: { rate: number }) {
  const color = rate >= 70 ? '#ef4444' : rate >= 40 ? '#C9A96E' : '#2D5C4E'
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div style={{ fontSize: '3rem', fontWeight: 900, color, lineHeight: 1 }}>{rate}%</div>
      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem' }}>نسبة الإشغال الكلية</div>
      <div style={{ height: 12, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginTop: '0.75rem' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.3rem' }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  )
}

export default function OperationsSection({ operations, kpis, getCourtName }: Props) {
  const confirmHours = operations.avg_confirmation_minutes > 0
    ? operations.avg_confirmation_minutes >= 60
      ? `${Math.round(operations.avg_confirmation_minutes / 60)} ساعة`
      : `${operations.avg_confirmation_minutes} دقيقة`
    : '—'

  return (
    <section id="section-operations" className="report-section">
      <div className="section-header">
        <h2 className="section-title">📈 الأداء التشغيلي</h2>
      </div>

      <div className="rpt-grid-3">
        {/* عداد الإشغال */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">📊 الإشغال</h3>
          <OccupancyMeter rate={operations.occupancy_rate} />
        </div>

        {/* أرقام ذروة */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">🏆 أرقام الذروة</h3>
          <div className="rpt-detail-row">
            <span>أكثر يوم ازدحاماً</span>
            <strong style={{ color: '#1B2A3B' }}>
              {operations.top_day
                ? `${new Date(operations.top_day.date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long' })} (${operations.top_day.count} حجز)`
                : '—'}
            </strong>
          </div>
          <div className="rpt-detail-row">
            <span>أكثر فترة طلباً</span>
            <strong style={{ color: '#1B2A3B' }}>
              {operations.top_period
                ? `${PERIOD_LABELS[operations.top_period.period] ?? operations.top_period.period} (${operations.top_period.count} حجز)`
                : '—'}
            </strong>
          </div>
          <div className="rpt-detail-row">
            <span>أكثر ملعب طلباً</span>
            <strong style={{ color: '#1B2A3B' }}>
              {operations.top_court
                ? `${getCourtName(operations.top_court.court_id)} (${operations.top_court.count} حجز)`
                : '—'}
            </strong>
          </div>
        </div>

        {/* جودة الخدمة */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">⚡ جودة الخدمة</h3>
          <div className="rpt-detail-row">
            <span>متوسط وقت التأكيد</span>
            <strong style={{ color: '#1B2A3B' }}>{confirmHours}</strong>
          </div>
          <div className="rpt-detail-row">
            <span>إجمالي الحجوزات</span>
            <strong>{kpis.total_count}</strong>
          </div>
          <div className="rpt-detail-row">
            <span>الحجوزات المؤكدة</span>
            <strong style={{ color: '#2D5C4E' }}>{kpis.confirmed_count}</strong>
          </div>
          <div className="rpt-detail-row">
            <span>نسبة النجاح</span>
            <strong style={{ color: '#2D5C4E' }}>
              {kpis.total_count > 0
                ? `${Math.round(kpis.confirmed_count / kpis.total_count * 100)}%`
                : '—'}
            </strong>
          </div>
          <div className="rpt-detail-row">
            <span>نسبة الإلغاء</span>
            <strong style={{ color: kpis.cancellation_rate > 30 ? '#ef4444' : '#94a3b8' }}>
              {kpis.cancellation_rate}%
            </strong>
          </div>
        </div>
      </div>
    </section>
  )
}
