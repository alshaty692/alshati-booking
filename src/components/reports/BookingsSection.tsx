'use client'
// ============================================================
// BookingsSection — قسم الحجوزات — ثيم-aware
// ============================================================
import type { ReportBookings, ReportKpis } from '@/types/reports'

const PERIOD_LABELS: Record<string, string> = { '1': '5–7م (الأولى)', '2': '7–9م (الثانية)', '3': '9–11م (الثالثة)' }
const STATUS_AR: Record<string, string> = {
  confirmed: 'مؤكد', pending: 'بانتظار إيصال', uploaded: 'قيد المراجعة',
  rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي',
}
// ألوان ثيم-aware: نستخدم CSS variables حيث ممكن، وألوان ثيمية ثابتة للـ status dots
const STATUS_COLOR: Record<string, string> = {
  confirmed: 'var(--color-success)',
  uploaded:  'var(--color-info)',
  pending:   'var(--color-warning)',
  rejected:  'var(--color-danger)',
  cancelled: 'var(--text-muted)',
  expired:   'var(--text-muted)',
}

interface Props {
  bookings:   ReportBookings
  kpis:       ReportKpis
  onExportPDF:   () => void
  onExportExcel: () => void
  onWhatsApp:    () => void
}

export default function BookingsSection({ bookings, kpis, onExportPDF, onExportExcel, onWhatsApp }: Props) {
  const totalPeriods = Object.values(bookings.by_period).reduce((s, n) => s + n, 0)

  return (
    <section id="section-bookings" className="report-section">
      <div className="section-header">
        <h2 className="section-title">📋 تقرير الحجوزات</h2>
        <div className="section-actions">
          <button id="btn-bk-pdf"   className="sec-btn sec-btn-pdf"   onClick={onExportPDF}>📄 PDF</button>
          <button id="btn-bk-excel" className="sec-btn sec-btn-excel" onClick={onExportExcel}>📊 Excel</button>
          <button id="btn-bk-wa"    className="sec-btn sec-btn-wa"    onClick={onWhatsApp}>💬 واتساب</button>
        </div>
      </div>

      <div className="rpt-grid-3">
        {/* توزيع الفترات */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">⏰ توزيع الفترات</h3>
          {Object.entries(bookings.by_period).map(([period, count]) => {
            const pct = totalPeriods > 0 ? Math.round(count / totalPeriods * 100) : 0
            return (
              <div key={period} style={{ marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{PERIOD_LABELS[period] ?? `فترة ${period}`}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {count} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: 'linear-gradient(90deg, var(--color-lime-dim), var(--color-lime))',
                    borderRadius: 99, transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* يدوي مقابل أونلاين */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">📡 مصدر الحجز</h3>
          {[
            { label: 'أونلاين (تطبيق)', count: bookings.online_count, color: 'var(--color-info)',    icon: '🌐' },
            { label: 'يدوي (إداري)',    count: bookings.manual_count, color: 'var(--color-warning)', icon: '✍️' },
          ].map(item => {
            const pct = bookings.total > 0 ? Math.round(item.count / bookings.total * 100) : 0
            return (
              <div key={item.label} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.icon} {item.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.count} ({pct}%)</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 99, transition: 'width 0.6s', opacity: 0.85 }} />
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="rpt-detail-row">
              <span>إجمالي الحجوزات</span>
              <strong style={{ color: 'var(--text-primary)' }}>{bookings.total}</strong>
            </div>
            <div className="rpt-detail-row">
              <span>المؤكدة</span>
              <strong style={{ color: 'var(--color-success)' }}>{kpis.confirmed_count}</strong>
            </div>
            <div className="rpt-detail-row">
              <span>نسبة الإلغاء</span>
              <strong style={{ color: kpis.cancellation_rate > 30 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {kpis.cancellation_rate}%
              </strong>
            </div>
          </div>
        </div>

        {/* ملخص الحالات */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">📊 ملخص الحالات</h3>
          {Object.entries({
            confirmed: kpis.confirmed_count,
            pending:   (bookings.details.filter(b => b.status === 'pending').length),
            uploaded:  (bookings.details.filter(b => b.status === 'uploaded').length),
            cancelled: (bookings.details.filter(b => b.status === 'cancelled').length),
            rejected:  (bookings.details.filter(b => b.status === 'rejected').length),
            expired:   (bookings.details.filter(b => b.status === 'expired').length),
          }).filter(([, c]) => c > 0)
          .map(([status, count]) => (
            <div key={status} className="rpt-detail-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLOR[status] ?? 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                {STATUS_AR[status] ?? status}
              </span>
              <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
