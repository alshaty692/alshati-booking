'use client'
// ============================================================
// FinancialSection — القسم المالي مع أزرار التصدير
// ============================================================
import { formatAmount, getCourtName } from '@/lib/utils'
import type { ReportFinancial, ReportKpis, BookingRow } from '@/types/reports'

const STATUS_AR: Record<string, string> = {
  confirmed: 'مؤكد', pending: 'بانتظار إيصال', uploaded: 'قيد المراجعة',
  rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي',
}
const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }
const STATUS_COLOR: Record<string, string> = {
  confirmed: '#2D5C4E', uploaded: '#0ea5e9', pending: '#f59e0b',
  rejected: '#ef4444', cancelled: '#94a3b8', expired: '#cbd5e1',
}

function BarChart({ items, max }: { items: { label: string; value: number }[]; max: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right', color: 'var(--text-primary)' }}>{item.label}</span>
          <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{
              height: '100%',
              width: `${max > 0 ? Math.round(item.value / max * 100) : 0}%`,
              background: 'linear-gradient(90deg, var(--color-lime-dim), var(--color-lime))',
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-success)' }}>{formatAmount(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  financial:  ReportFinancial
  kpis:       ReportKpis
  details:    BookingRow[]
  from:       string
  to:         string
  centerName: string
  waterPrice: number
  onExportPDF:    () => void
  onExportExcel:  () => void
  onWhatsApp:     () => void
}

export default function FinancialSection({
  financial, kpis, details, from, to, centerName, waterPrice,
  onExportPDF, onExportExcel, onWhatsApp,
}: Props) {
  const maxRevenue = Math.max(1, ...financial.by_court.map(c => c.revenue))
  const confirmedDetails = details.filter(b => b.status === 'confirmed')

  return (
    <section id="section-financial" className="report-section">
      {/* رأس القسم */}
      <div className="section-header">
        <h2 className="section-title">💰 التقرير المالي</h2>
        <div className="section-actions">
          <button id="btn-fin-pdf"   className="sec-btn sec-btn-pdf"   onClick={onExportPDF}>📄 PDF</button>
          <button id="btn-fin-excel" className="sec-btn sec-btn-excel" onClick={onExportExcel}>📊 Excel</button>
          <button id="btn-fin-wa"    className="sec-btn sec-btn-wa"    onClick={onWhatsApp}>💬 واتساب</button>
        </div>
      </div>

      {/* الشبكة */}
      <div className="rpt-grid-2">
        {/* إيرادات الملاعب */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">🏟️ الإيرادات حسب الملعب</h3>
          <BarChart
            max={maxRevenue}
            items={financial.by_court.map(c => ({ label: c.name, value: c.revenue }))}
          />
          <div style={{ marginTop: '1.25rem' }}>
            {financial.by_court.map(c => (
              <div key={c.court_id} className="rpt-detail-row">
                <span>{c.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.count} حجز</span>
                <strong style={{ color: 'var(--color-success)' }}>{formatAmount(c.revenue)}</strong>
              </div>
            ))}
            {/* ملخص المياه */}
            {kpis.water_revenue > 0 && (
              <div className="rpt-detail-row" style={{ borderTop: '2px dashed var(--border-color)', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--color-info)' }}>💧 إيرادات المياه</span>
                <strong style={{ color: 'var(--color-info)' }}>{formatAmount(kpis.water_revenue)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* توزيع الحالات */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">📊 توزيع الحالات</h3>
          {Object.entries(financial.status_breakdown)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => {
              const pct = kpis.total_count > 0 ? Math.round(count / kpis.total_count * 100) : 0
              return (
                <div key={status} style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{STATUS_AR[status] ?? status}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[status] ?? 'var(--text-muted)', borderRadius: 99, transition: 'width 0.5s', opacity: 0.85 }} />
                  </div>
                </div>
              )
            })}

          {/* ملخص مالي */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            {[
              { label: 'المبلغ الأصلي',  value: formatAmount(kpis.total_base) },
              { label: 'الخصومات',       value: `- ${formatAmount(kpis.total_discount)}` },
              { label: 'الإيرادات الصافية', value: formatAmount(kpis.total_revenue) },
            ].map((r, i) => (
              <div key={i} className="rpt-detail-row">
                <span style={{ fontSize: '0.85rem' }}>{r.label}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{r.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* جدول الحجوزات المؤكدة */}
        <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="rpt-card-title">
            📋 الحجوزات المؤكدة ({confirmedDetails.length})
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الملعب</th>
                  <th>الفترة</th>
                  <th>العميل</th>
                  <th>الكود</th>
                  <th>المياه</th>
                  <th>الخصم</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {confirmedDetails.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>لا توجد حجوزات مؤكدة</td></tr>
                )}
                {confirmedDetails.map(b => (
                  <tr key={b.id}>
                    <td>{b.booking_date}</td>
                    <td>{getCourtName(b.court_id)}</td>
                    <td>{PERIOD_LABELS[b.period_number] ?? b.period_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.customer_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                    </td>
                    <td>
                      {b.code_used
                        ? <span style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700 }}>{b.code_used}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--color-info)' }}>
                      {(b.water_quantity ?? 0) > 0 ? `${b.water_quantity} 💧` : '—'}
                    </td>
                    <td style={{ color: 'var(--color-danger)' }}>
                      {b.discount_amount > 0 ? formatAmount(b.discount_amount) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatAmount(b.final_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
