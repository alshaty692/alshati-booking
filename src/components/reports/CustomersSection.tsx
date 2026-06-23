'use client'
// ============================================================
// CustomersSection — قسم العملاء
// عملاء جدد حقيقيون: من customers.first_booking_at >= from
// ============================================================
import { formatAmount } from '@/lib/utils'
import type { ReportCustomers } from '@/types/reports'

const CLASSIFICATION_LABEL: Record<string, string> = {
  new:      'جديد',
  regular:  'منتظم',
  gold:     '🥇 ذهبي',
  inactive: 'غير نشط',
}
const CLASSIFICATION_COLOR: Record<string, string> = {
  new:      '#0ea5e9',
  regular:  '#2D5C4E',
  gold:     '#C9A96E',
  inactive: '#94a3b8',
}

interface Props {
  customers:     ReportCustomers
  from:          string
  to:            string
  onExportPDF:   () => void
  onExportExcel: () => void
  onWhatsApp:    () => void
}

export default function CustomersSection({ customers, from, to, onExportPDF, onExportExcel, onWhatsApp }: Props) {
  return (
    <section id="section-customers" className="report-section">
      <div className="section-header">
        <h2 className="section-title">👥 تقرير العملاء</h2>
        <div className="section-actions">
          <button id="btn-cust-pdf"   className="sec-btn sec-btn-pdf"   onClick={onExportPDF}>📄 PDF</button>
          <button id="btn-cust-excel" className="sec-btn sec-btn-excel" onClick={onExportExcel}>📊 Excel</button>
          <button id="btn-cust-wa"    className="sec-btn sec-btn-wa"    onClick={onWhatsApp}>💬 واتساب</button>
        </div>
      </div>

      <div className="rpt-grid-2">
        {/* ملخص العملاء */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">👥 ملخص العملاء</h3>
          {[
            { label: 'إجمالي العملاء في الفترة',  value: String(customers.total_unique), color: '#1B2A3B' },
            {
              label: 'عملاء جدد حقيقيون ✓',
              value: String(customers.new_customers),
              color: '#0ea5e9',
              note: `أول حجز لهم >= ${from}`,
            },
            { label: 'عملاء متكررون',   value: String(customers.repeat_customers), color: '#2D5C4E' },
            { label: 'معدل التكرار',    value: `${customers.repeat_rate}%`,          color: '#C9A96E' },
            {
              label: 'متوسط رضا العملاء ⭐',
              value: customers.avg_rating != null
                ? `${customers.avg_rating} / 5`
                : 'لا تقييمات بعد',
              color: '#f59e0b',
            },
          ].map((r, i) => (
            <div key={i} className="rpt-detail-row">
              <div>
                <span>{r.label}</span>
                {r.note && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{r.note}</div>}
              </div>
              <strong style={{ color: r.color }}>{r.value}</strong>
            </div>
          ))}

          {/* توزيع التصنيف */}
          {customers.top_list.some(c => c.classification) && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>التصنيف</div>
              {(['new', 'regular', 'gold', 'inactive'] as const).map(cls => {
                const count = customers.top_list.filter(c => c.classification === cls).length
                if (count === 0) return null
                return (
                  <div key={cls} className="rpt-detail-row">
                    <span style={{ color: CLASSIFICATION_COLOR[cls] }}>
                      {CLASSIFICATION_LABEL[cls]}
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* أفضل العملاء إيراداً */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">⭐ أفضل العملاء إيراداً</h3>
          {customers.top_list.slice(0, 8).map((c, i) => (
            <div key={i} className="rpt-detail-row">
              <span style={{ fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-lime)', marginLeft: '0.4rem' }}>#{i + 1}</span>
                {c.is_vip && <span style={{ marginLeft: '0.25rem' }}>⭐</span>}
                {c.name}
                {c.classification && (
                  <span style={{
                    fontSize: '0.65rem', marginRight: '0.35rem', padding: '0.1rem 0.4rem',
                    borderRadius: '1rem', background: `${CLASSIFICATION_COLOR[c.classification]}20`,
                    color: CLASSIFICATION_COLOR[c.classification], fontWeight: 700,
                  }}>
                    {CLASSIFICATION_LABEL[c.classification]}
                  </span>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.phone}</div>
              </span>
              <span style={{ textAlign: 'left' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{c.count} حجز</div>
                <strong style={{ color: 'var(--color-success)' }}>{formatAmount(c.revenue)}</strong>
              </span>
            </div>
          ))}
        </div>

        {/* جدول كامل */}
        <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="rpt-card-title">📋 جدول العملاء ({customers.total_unique})</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>الحجوزات</th>
                  <th>الإيرادات</th>
                  <th>التصنيف</th>
                  <th>أول حجز</th>
                </tr>
              </thead>
              <tbody>
                {customers.top_list.map((c, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--color-lime)', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.is_vip && '⭐ '}{c.name}
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right', color: 'var(--text-muted)' }}>{c.phone}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{c.count}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatAmount(c.revenue)}</td>
                    <td>
                      {c.classification ? (
                        <span style={{
                          fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                          background: `${CLASSIFICATION_COLOR[c.classification]}20`,
                          color: CLASSIFICATION_COLOR[c.classification], fontWeight: 700,
                        }}>
                          {CLASSIFICATION_LABEL[c.classification]}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.first_booking_at
                        ? new Date(c.first_booking_at).toLocaleDateString('ar-SA')
                        : '—'}
                    </td>
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
