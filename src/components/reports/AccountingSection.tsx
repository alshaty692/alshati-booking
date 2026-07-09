'use client'
// ============================================================
// AccountingSection — التحليل المالي المتقدم
// 1. رسم بياني — التحصيل عبر الزمن (SVG نظيف، لا dependency خارجية)
// 2. أعمار الذمم المدينة — بطاقات ملوّنة قابلة للتوسيع
// 3. ملخص العمولات — جدول بالمستفيد
// ============================================================
import { useState } from 'react'
import { formatAmount } from '@/lib/utils'
import type { ReportFinancial, ReportKpis, AgingReport, CommissionBeneficiary, DayRevenue } from '@/types/reports'

// ── تجميع by_day حسب الوحدة الزمنية ──────────────────────────
function groupTimeline(
  days: DayRevenue[],
  from: string,
  to: string,
): { label: string; amount: number }[] {
  if (days.length === 0) return []

  const fromD = new Date(from)
  const toD   = new Date(to)
  const diffMs = toD.getTime() - fromD.getTime()
  const diffDays = diffMs / 86400000

  // أقل من 14 يوم → يومي
  if (diffDays <= 13) {
    return days.map(d => ({
      label:  new Date(d.date + 'T00:00:00').toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }),
      amount: d.revenue,
    }))
  }

  // أقل من 90 يوم → أسبوعي
  if (diffDays <= 89) {
    const weeks: Record<string, number> = {}
    days.forEach(d => {
      const dt  = new Date(d.date + 'T00:00:00')
      const mon = new Date(dt)
      mon.setDate(dt.getDate() - dt.getDay() + 1)  // Monday
      const key = mon.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
      weeks[key] = (weeks[key] ?? 0) + d.revenue
    })
    return Object.entries(weeks).map(([label, amount]) => ({ label, amount }))
  }

  // 90+ يوم → شهري
  const months: Record<string, number> = {}
  days.forEach(d => {
    const key = d.date.slice(0, 7)  // YYYY-MM
    months[key] = (months[key] ?? 0) + d.revenue
  })
  return Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, amount]) => {
      const [y, m] = k.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })
      return { label, amount }
    })
}

// ── رسم بياني SVG للتحصيل ─────────────────────────────────────
function CollectionChart({ data }: { data: { label: string; amount: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
        <p style={{ margin: 0 }}>لا توجد دفعات في هذه الفترة</p>
      </div>
    )
  }

  const W = 700, H = 220, PL = 10, PR = 10, PT = 20, PB = 40
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const maxVal = Math.max(...data.map(d => d.amount), 1)
  const barW   = Math.max(4, Math.floor(chartW / data.length) - 4)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', direction: 'ltr', display: 'block' }}
        aria-label="رسم بياني للتحصيل عبر الزمن"
      >
        {/* خطوط شبكية */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PT + chartH * (1 - pct)
          return (
            <g key={pct}>
              <line
                x1={PL} y1={y} x2={W - PR} y2={y}
                stroke="rgba(127,127,127,0.12)" strokeWidth={1}
              />
              {pct > 0 && (
                <text
                  x={PL + 4} y={y - 3}
                  fontSize={9} fill="rgba(127,127,127,0.5)"
                  textAnchor="start"
                >
                  {formatAmount(maxVal * pct).replace(' ر.س', '')}
                </text>
              )}
            </g>
          )
        })}

        {/* الأعمدة */}
        {data.map((d, i) => {
          const x      = PL + (i / data.length) * chartW + (chartW / data.length - barW) / 2
          const barH   = Math.max(2, (d.amount / maxVal) * chartH)
          const y      = PT + chartH - barH
          const active = hoveredIdx === i

          return (
            <g key={i}>
              {/* ظل خلف العمود */}
              <rect
                x={x - 1} y={PT} width={barW + 2} height={chartH}
                fill="transparent"
                rx={3}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {/* العمود نفسه */}
              <rect
                x={x} y={y} width={barW} height={barH}
                rx={3}
                fill={active
                  ? 'var(--color-lime)'
                  : 'var(--color-lime-dim)'}
                style={{
                  transition: 'fill 0.15s',
                  filter: active ? 'drop-shadow(0 0 6px var(--color-lime))' : 'none',
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {/* تلميح القيمة عند التحوّم */}
              {active && (
                <g>
                  <rect
                    x={Math.min(x + barW / 2 - 50, W - PR - 105)}
                    y={y - 32}
                    width={105} height={24}
                    rx={5}
                    fill="var(--bg-elevated)"
                    stroke="var(--color-lime-dim)"
                    strokeWidth={1}
                  />
                  <text
                    x={Math.min(x + barW / 2 - 50, W - PR - 105) + 52}
                    y={y - 14}
                    fontSize={10}
                    fontWeight="700"
                    fill="var(--color-lime)"
                    textAnchor="middle"
                    style={{ fontFamily: 'Tajawal, sans-serif' }}
                  >
                    {formatAmount(d.amount)}
                  </text>
                </g>
              )}
              {/* تسمية المحور X (تظهر كل n عنصر) */}
              {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && (
                <text
                  x={x + barW / 2} y={H - 5}
                  fontSize={8.5} fill="rgba(127,127,127,0.65)"
                  textAnchor="middle"
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── قسم الرسم البياني ─────────────────────────────────────────
function TimelineSection({
  financial, from, to, totalCollected,
}: {
  financial: ReportFinancial
  from: string
  to: string
  totalCollected: number
}) {
  const chartData = groupTimeline(financial.by_day, from, to)
  // حسابات المحور الزمني
  const diffDays = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  const unit = diffDays <= 13 ? 'يومي' : diffDays <= 89 ? 'أسبوعي' : 'شهري'

  return (
    <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="rpt-card-title" style={{ margin: 0 }}>
          📈 التحصيل عبر الزمن
          <span style={{
            marginRight: '0.75rem',
            fontSize: '0.72rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            background: 'var(--bg-elevated)',
            padding: '0.2rem 0.6rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
          }}>
            {unit}
          </span>
        </h3>
        <div style={{
          background: 'var(--color-lime-muted)',
          border: '1px solid var(--color-lime-dim)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.6rem 1rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-lime-dim)', fontWeight: 600, marginBottom: '0.1rem' }}>
            إجمالي التحصيل
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-lime)' }}>
            {formatAmount(totalCollected)}
          </div>
        </div>
      </div>
      <CollectionChart data={chartData} />
    </div>
  )
}

// ── أعمار الذمم المدينة ───────────────────────────────────────

const AGING_BUCKETS = [
  { key: '0_7'    as const, label: '0–7 أيام',   sub: 'جديدة',         color: 'var(--color-lime)',    bg: 'var(--color-lime-muted)',    border: 'var(--color-lime-dim)' },
  { key: '8_30'   as const, label: '8–30 يوم',   sub: 'تحتاج متابعة',  color: 'var(--color-warning)', bg: 'var(--color-warning-bg)',    border: 'rgba(245,166,35,.35)' },
  { key: '31_60'  as const, label: '31–60 يوم',  sub: 'متأخرة',        color: 'var(--color-info)',    bg: 'var(--color-info-bg)',       border: 'rgba(74,158,191,.35)' },
  { key: '60_plus'as const, label: '60+ يوم',    sub: 'حرجة جداً ⚠️',  color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',     border: 'rgba(224,85,85,.4)' },
]

function AgingSection({ aging }: { aging: AgingReport }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const totalCount = AGING_BUCKETS.reduce((s, b) => s + aging[b.key].count, 0)
  const totalDue   = AGING_BUCKETS.reduce((s, b) => s + aging[b.key].total, 0)

  if (totalCount === 0) {
    return (
      <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="rpt-card-title">⏱️ أعمار الذمم المدينة</h3>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <p style={{ margin: 0, fontWeight: 600 }}>لا توجد فواتير مستحقة — ممتاز!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="rpt-card-title" style={{ margin: 0 }}>⏱️ أعمار الذمم المدينة</h3>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--color-danger)' }}>{totalCount}</strong> فاتورة ·
          إجمالي <strong style={{ color: 'var(--color-danger)' }}>{formatAmount(totalDue)}</strong>
        </div>
      </div>

      {/* بطاقات الفئات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
        {AGING_BUCKETS.map(b => {
          const bucket = aging[b.key]
          return (
            <button
              key={b.key}
              onClick={() => bucket.count > 0 && toggle(b.key)}
              style={{
                background: b.bg,
                border: `1px solid ${b.border}`,
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'right',
                cursor: bucket.count > 0 ? 'pointer' : 'default',
                transition: 'transform 0.15s, box-shadow 0.15s',
                opacity: bucket.count === 0 ? 0.45 : 1,
              }}
              onMouseEnter={e => {
                if (bucket.count > 0) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 16px ${b.border}`
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = ''
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = ''
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: b.color, lineHeight: 1.1 }}>
                {bucket.count}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: b.color, marginTop: '0.25rem' }}>
                {b.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {b.sub}
              </div>
              {bucket.count > 0 && (
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                  {formatAmount(bucket.total)}
                </div>
              )}
              {bucket.count > 0 && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {expanded[b.key] ? '▲ إخفاء التفاصيل' : '▼ عرض التفاصيل'}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* جداول التفاصيل المنسدلة */}
      {AGING_BUCKETS.map(b => {
        const bucket = aging[b.key]
        if (!expanded[b.key] || bucket.invoices.length === 0) return null
        return (
          <div key={b.key} style={{
            marginBottom: '1rem',
            border: `1px solid ${b.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{
              background: b.bg,
              padding: '0.6rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: b.color,
              borderBottom: `1px solid ${b.border}`,
            }}>
              {b.label} — {bucket.count} فاتورة · {formatAmount(bucket.total)}
            </div>
            <div className="table-container">
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>العميل</th>
                    <th>المبلغ المستحق</th>
                    <th>تاريخ الإصدار</th>
                    <th>العمر (أيام)</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.invoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700 }}>
                        {inv.invoice_no ?? inv.id.slice(0, 8) + '…'}
                      </td>
                      <td>{inv.customer}</td>
                      <td style={{ fontWeight: 700, color: b.color }}>
                        {formatAmount(inv.amount)}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(inv.issued_at).toLocaleDateString('ar-SA')}
                      </td>
                      <td>
                        <span style={{
                          background: b.bg,
                          color: b.color,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          border: `1px solid ${b.border}`,
                        }}>
                          {inv.age_days} يوم
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {inv.payment_status === 'partial' ? 'جزئي' : 'غير مسدد'}
                        </span>
                      </td>
                      <td>
                        <a
                          href={`/admin/invoices/${inv.id}`}
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--color-lime)',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          عرض ←
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── ملخص العمولات ──────────────────────────────────────────────
function CommissionsSection({ data }: { data: CommissionBeneficiary[] }) {
  if (data.length === 0) {
    return (
      <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="rpt-card-title">👥 ملخص العمولات بالمستفيد</h3>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <p style={{ margin: 0 }}>لا توجد عمولات في هذه الفترة</p>
        </div>
      </div>
    )
  }

  const grandTotal    = data.reduce((s, d) => s + d.total, 0)
  const grandPending  = data.reduce((s, d) => s + d.pending, 0)
  const grandIncluded = data.reduce((s, d) => s + d.included, 0)

  return (
    <div className="rpt-card" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="rpt-card-title" style={{ margin: 0 }}>👥 ملخص العمولات بالمستفيد</h3>
        <a
          href="/admin/commissions"
          style={{
            fontSize: '0.78rem', color: 'var(--color-lime)',
            textDecoration: 'none', fontWeight: 600,
            padding: '0.35rem 0.75rem',
            border: '1px solid var(--color-lime-dim)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          إدارة العمولات →
        </a>
      </div>

      {/* إجماليات مختصرة */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { label: 'إجمالي العمولات', value: formatAmount(grandTotal),    color: 'var(--text-primary)' },
          { label: 'معلّقة (لم تُصرف)', value: formatAmount(grandPending),  color: 'var(--color-warning)' },
          { label: 'مدرجة براتب',     value: formatAmount(grandIncluded), color: 'var(--color-success)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1rem',
            flex: '1 1 140px',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* الجدول */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>المستفيد</th>
              <th>المنصب</th>
              <th>عدد العمولات</th>
              <th>إجمالي العمولات</th>
              <th>معلّقة</th>
              <th>مدرجة براتب</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.profile_id}>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.name}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {row.position ?? '—'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    background: 'var(--color-lime-muted)',
                    color: 'var(--color-lime)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-lime-dim)',
                  }}>
                    {row.count}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatAmount(row.total)}
                </td>
                <td>
                  {row.pending > 0 ? (
                    <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                      {formatAmount(row.pending)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td>
                  {row.included > 0 ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      {formatAmount(row.included)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── المكوّن الرئيسي ────────────────────────────────────────────
interface Props {
  financial:            ReportFinancial
  kpis:                 ReportKpis
  from:                 string
  to:                   string
  aging?:               AgingReport
  commissions_summary?: CommissionBeneficiary[]
}

export default function AccountingSection({
  financial, kpis, from, to, aging, commissions_summary,
}: Props) {
  return (
    <section id="section-accounting" className="report-section">
      {/* رأس القسم */}
      <div className="section-header">
        <h2 className="section-title">💼 التحليل المالي المتقدم</h2>
      </div>

      <div className="rpt-grid-2">
        {/* 1. الرسم البياني */}
        <TimelineSection
          financial={financial}
          from={from}
          to={to}
          totalCollected={kpis.total_collected}
        />

        {/* 2. أعمار الذمم المدينة */}
        {aging ? (
          <AgingSection aging={aging} />
        ) : (
          <div className="rpt-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            <p style={{ margin: 0 }}>بيانات الذمم غير متاحة</p>
          </div>
        )}

        {/* 3. ملخص العمولات */}
        {commissions_summary !== undefined ? (
          <CommissionsSection data={commissions_summary} />
        ) : (
          <div className="rpt-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            <p style={{ margin: 0 }}>بيانات العمولات غير متاحة</p>
          </div>
        )}
      </div>
    </section>
  )
}
