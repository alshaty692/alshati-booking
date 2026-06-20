'use client'
// ============================================================
// CodesSection — قسم أكواد الخصم
// بيانات مُثراة بـ JOIN مع جدول codes في السيرفر
// ============================================================
import { formatAmount } from '@/lib/utils'
import type { ReportCodes } from '@/types/reports'

interface Props {
  codes:         ReportCodes
  onExportPDF:   () => void
  onExportExcel: () => void
  onWhatsApp:    () => void
}

export default function CodesSection({ codes, onExportPDF, onExportExcel, onWhatsApp }: Props) {
  return (
    <section id="section-codes" className="report-section">
      <div className="section-header">
        <h2 className="section-title">🏷️ تقرير أكواد الخصم</h2>
        <div className="section-actions">
          <button id="btn-cd-pdf"   className="sec-btn sec-btn-pdf"   onClick={onExportPDF}>📄 PDF</button>
          <button id="btn-cd-excel" className="sec-btn sec-btn-excel" onClick={onExportExcel}>📊 Excel</button>
          <button id="btn-cd-wa"    className="sec-btn sec-btn-wa"    onClick={onWhatsApp}>💬 واتساب</button>
        </div>
      </div>

      <div className="rpt-grid-2">
        {/* ملخص */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">🏷️ ملخص الأكواد</h3>
          {[
            { label: 'عدد الأكواد المستخدمة',  value: String(codes.unique_codes_used), color: '#1B2A3B' },
            { label: 'إجمالي الاستخدامات',     value: String(codes.total_uses),        color: '#1B2A3B' },
            { label: 'إجمالي الخصومات',        value: formatAmount(codes.total_discount), color: '#ef4444' },
            { label: 'نسبة استخدام الأكواد',   value: `${codes.usage_rate}%`,          color: '#C9A96E' },
          ].map((r, i) => (
            <div key={i} className="rpt-detail-row">
              <span>{r.label}</span>
              <strong style={{ color: r.color }}>{r.value}</strong>
            </div>
          ))}
        </div>

        {/* أكثر الأكواد استخداماً */}
        <div className="rpt-card">
          <h3 className="rpt-card-title">🏆 الأكثر استخداماً</h3>
          {codes.details.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>لا توجد أكواد مستخدمة في هذه الفترة</p>
          )}
          {codes.details.slice(0, 8).map((c, i) => (
            <div key={i} className="rpt-detail-row">
              <span>
                <span style={{ fontWeight: 700, color: '#C9A96E', marginLeft: '0.4rem' }}>#{i + 1}</span>
                <strong style={{ fontSize: '0.95rem', letterSpacing: '0.05em' }}>{c.code}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginRight: '0.4rem' }}>
                  {c.count} استخدام
                  {c.max_uses ? ` / ${c.max_uses}` : ''}
                </span>
                {!c.is_active && (
                  <span style={{ fontSize: '0.65rem', color: '#ef4444', background: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: '1rem', marginRight: '0.25rem' }}>
                    غير نشط
                  </span>
                )}
              </span>
              <span>
                <span style={{ color: '#ef4444', fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                  -{formatAmount(c.total_discount)}
                </span>
                <strong style={{ color: '#2D5C4E' }}>{formatAmount(c.total_revenue)}</strong>
              </span>
            </div>
          ))}
        </div>

        {/* جدول تفصيلي */}
        <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="rpt-card-title">📋 تفاصيل الأكواد</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>النوع</th>
                  <th>الاستخدامات</th>
                  <th>الحد الأقصى</th>
                  <th>إجمالي الخصم</th>
                  <th>إجمالي الإيرادات</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {codes.details.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>لا توجد أكواد</td></tr>
                )}
                {codes.details.map((c, i) => (
                  <tr key={i}>
                    <td><strong style={{ letterSpacing: '0.08em', fontSize: '1rem' }}>{c.code}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {c.discount_type === 'percent'
                        ? `${c.discount_value}%`
                        : c.discount_value ? formatAmount(c.discount_value) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.count}</td>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{c.max_uses ?? '∞'}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>{formatAmount(c.total_discount)}</td>
                    <td style={{ fontWeight: 700, color: '#2D5C4E' }}>{formatAmount(c.total_revenue)}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                        background: c.is_active ? '#dcfce7' : '#fee2e2',
                        color: c.is_active ? '#16a34a' : '#ef4444', fontWeight: 700,
                      }}>
                        {c.is_active ? 'نشط' : 'غير نشط'}
                      </span>
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
