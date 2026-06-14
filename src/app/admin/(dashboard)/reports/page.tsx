'use client'
// ============================================================
// صفحة التقارير الكاملة — /admin/(dashboard)/reports
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'

// ============================================================
// الأنواع
// ============================================================
interface ReportData {
  meta: { from: string; to: string; generated_at: string }
  summary: {
    total_bookings: number; confirmed_bookings: number
    total_revenue: number; total_discount: number; avg_booking_value: number
    status_count: Record<string,number>
  }
  financial: {
    revenue_by_court: { court_id: string; revenue: number; count: number }[]
    revenue_by_day: { date: string; revenue: number }[]
  }
  customers: {
    top_customers: { name: string; phone: string; count: number; revenue: number }[]
    new_customers: number; repeat_customers: number
  }
  heatmap: Record<number, Record<number, { booked: number; total: number }>>
  codes: {
    code_stats: { code: string; count: number; discount: number; revenue: number }[]
    bookings_with_code: number
  }
  bookings: {
    id: string; booking_date: string; court_id: string; period_number: number
    customer_name: string; customer_phone: string; status: string
    code_used: string | null; final_price: number; discount_amount: number
    is_manual: boolean; created_at: string
  }[]
}

// ============================================================
// ثوابت التصميم
// ============================================================
const PALETTE = {
  navy:  '#1B2A3B',
  green: '#2D5C4E',
  gold:  '#C9A96E',
  beige: '#F5F2EC',
}

const PERIOD_LABELS: Record<number, string> = { 1:'5–7م', 2:'7–9م', 3:'9–11م' }
const DAY_LABELS: Record<number, string>    = {
  0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'
}
const STATUS_AR: Record<string,string> = {
  confirmed:'مؤكد', pending:'بانتظار إيصال', uploaded:'قيد المراجعة',
  rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي'
}

function getRange(preset: string): { from: string; to: string } {
  const now   = new Date()
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  const today = fmt(now)
  switch (preset) {
    case 'today':  return { from: today, to: today }
    case 'week': {  const d = new Date(now); d.setDate(d.getDate()-6); return { from:fmt(d),to:today } }
    case 'month': { const d = new Date(now); d.setDate(d.getDate()-29); return { from:fmt(d),to:today } }
    case '3months': { const d = new Date(now); d.setDate(d.getDate()-89); return { from:fmt(d),to:today } }
    default: return { from:today, to:today }
  }
}

// ============================================================
// Heatmap
// ============================================================
function Heatmap({ data }: { data: Record<number, Record<number, { booked: number; total: number }>> }) {
  function getCellBg(booked: number, total: number): string {
    if (total === 0) return '#f8fafc'
    const p = booked / total
    if (p === 0) return '#f8fafc'
    if (p < 0.25) return '#d1fae5'
    if (p < 0.5)  return '#6ee7b7'
    if (p < 0.75) return '#2D5C4E'
    return '#1B2A3B'
  }
  function getCellText(booked: number, total: number): string {
    return total > 0 && booked/total >= 0.5 ? '#fff' : '#1B2A3B'
  }
  return (
    <div className="heatmap-wrap">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th className="heatmap-corner">اليوم / الفترة</th>
            {[1,2,3].map(p => <th key={p} className="heatmap-th">{PERIOD_LABELS[p]}</th>)}
          </tr>
        </thead>
        <tbody>
          {[0,1,2,3,4,5,6].map(day => (
            <tr key={day}>
              <td className="heatmap-day-label">{DAY_LABELS[day]}</td>
              {[1,2,3].map(period => {
                const cell = data[day]?.[period] ?? { booked:0, total:0 }
                const pct  = cell.total > 0 ? Math.round(cell.booked/cell.total*100) : 0
                return (
                  <td key={period} className="heatmap-cell"
                    style={{ background:getCellBg(cell.booked,cell.total), color:getCellText(cell.booked,cell.total) }}>
                    <div className="heatmap-pct">{pct}%</div>
                    <div className="heatmap-sub">{cell.booked}/{cell.total}</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-legend">
        <span>منخفض</span>
        <div className="legend-scale">
          {['#f8fafc','#d1fae5','#6ee7b7','#2D5C4E','#1B2A3B'].map(c => (
            <div key={c} style={{ width:28, height:14, background:c, borderRadius:3 }} />
          ))}
        </div>
        <span>ممتلئ</span>
      </div>
    </div>
  )
}

// ============================================================
// BarChart
// ============================================================
function BarChart({ items, max }: { items:{label:string;value:number}[]; max:number }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'0.6rem' }}>
      {items.map((item,i) => (
        <div key={i} style={{ display:'grid',gridTemplateColumns:'90px 1fr 80px',alignItems:'center',gap:'0.6rem' }}>
          <span style={{ fontSize:'0.8rem',fontWeight:600,textAlign:'right',color:PALETTE.navy }}>{item.label}</span>
          <div style={{ height:10,background:'#e2e8f0',borderRadius:99,overflow:'hidden' }}>
            <div style={{
              height:'100%',width:`${max>0?(item.value/max)*100:0}%`,
              background:`linear-gradient(90deg,${PALETTE.green},${PALETTE.gold})`,
              borderRadius:99,transition:'width 0.6s ease'
            }} />
          </div>
          <span style={{ fontSize:'0.8rem',fontWeight:700,color:PALETTE.green }}>{formatAmount(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// صفحة التقارير
// ============================================================
export default function ReportsPage() {
  const [preset, setPreset]    = useState('month')
  const [customFrom, setCFrom] = useState('')
  const [customTo,   setCTo]   = useState('')
  const [activeTab,  setTab]   = useState<'financial'|'customers'|'heatmap'|'codes'>('financial')
  const [data,       setData]  = useState<ReportData | null>(null)
  const [loading,    setLoading] = useState(true)
  const [settings,  setSettings] = useState<Record<string,string>>({})

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings ?? {}))
  }, [])

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/reports?from=${from}&to=${to}`)
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (preset === 'custom') { if (customFrom && customTo) fetchData(customFrom, customTo) }
    else { const { from, to } = getRange(preset); fetchData(from, to) }
  }, [preset, customFrom, customTo, fetchData])

  const { from, to } = preset === 'custom' ? { from:customFrom, to:customTo } : getRange(preset)
  const centerName   = settings.facility_name ?? 'مركز حي الشاطئ'
  const s            = data?.summary

  // ── Excel ─────────────────────────────────────────────────
  function exportExcel() {
    if (!data) return
    const rows = data.bookings.map(b => ({
      'التاريخ': b.booking_date, 'الملعب': getCourtName(b.court_id),
      'الفترة': getPeriodName(b.period_number), 'الاسم': b.customer_name,
      'الجوال': b.customer_phone, 'الحالة': STATUS_AR[b.status] ?? b.status,
      'الكود': b.code_used ?? '', 'الخصم': b.discount_amount,
      'المبلغ': b.final_price, 'نوع': b.is_manual ? 'يدوي' : 'إلكتروني',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'الحجوزات')
    XLSX.writeFile(wb, `alshati-report-${from}-${to}.xlsx`)
  }

  // ── واتساب ────────────────────────────────────────────────
  function shareWhatsApp() {
    if (!data) return
    const text = [
      `📊 *تقرير ${centerName}*`,
      `📅 من ${from} إلى ${to}`, ``,
      `✅ الحجوزات المؤكدة: ${data.summary.confirmed_bookings}`,
      `💰 إجمالي الإيرادات: ${formatAmount(data.summary.total_revenue)}`,
      `🎁 إجمالي الخصومات: ${formatAmount(data.summary.total_discount)}`,
      `📊 متوسط قيمة الحجز: ${formatAmount(data.summary.avg_booking_value)}`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ── PDF (html2canvas) ──────────────────────────────────────
  async function exportPDF() {
    if (!data) return
    const { generatePDFFromElement } = await import('@/lib/pdf-generator')
    const tabNames: Record<string,string> = {
      financial:'التقرير-المالي', customers:'تقرير-العملاء',
      heatmap:'تقرير-الإشغال', codes:'تقرير-الأكواد',
    }
    await generatePDFFromElement({
      elementId: 'report-printable',
      filename: `${centerName}-${tabNames[activeTab]}-${from}-${to}.pdf`,
    })
  }

  const maxCourtRevenue = Math.max(1, ...(data?.financial.revenue_by_court.map(c => c.revenue) ?? []))

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="reports-page">
      {/* الرأس */}
      <div className="rpt-header">
        <div>
          <h1 className="rpt-title">التقارير</h1>
          <p className="rpt-sub">
            {data
              ? `${data.meta.from} ← ${data.meta.to} · آخر تحديث: ${new Date(data.meta.generated_at).toLocaleTimeString('ar-SA')}`
              : 'جاري التحميل...'}
          </p>
        </div>
        <div className="rpt-actions">
          <button id="btn-export-excel"     className="rpt-btn rpt-btn-excel"     onClick={exportExcel}    disabled={!data}>📥 Excel</button>
          <button id="btn-share-whatsapp"   className="rpt-btn rpt-btn-whatsapp"  onClick={shareWhatsApp}  disabled={!data}>💬 واتساب</button>
          <button id="btn-export-pdf"       className="rpt-btn rpt-btn-pdf"       onClick={exportPDF}      disabled={!data}>📄 تصدير PDF</button>
        </div>
      </div>

      {/* فلتر المدة */}
      <div className="rpt-filter-bar">
        <div className="rpt-presets">
          {[
            {key:'today',label:'اليوم'},{key:'week',label:'أسبوع'},
            {key:'month',label:'شهر'},{key:'3months',label:'3 أشهر'},{key:'custom',label:'مخصص'},
          ].map(p => (
            <button key={p.key} id={`preset-${p.key}`}
              className={`rpt-preset ${preset===p.key?'active':''}`}
              onClick={() => setPreset(p.key)}>{p.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="rpt-custom-range">
            <label>من</label>
            <input type="date" className="input rpt-date-input" value={customFrom} onChange={e => setCFrom(e.target.value)} />
            <label>إلى</label>
            <input type="date" className="input rpt-date-input" value={customTo}   onChange={e => setCTo(e.target.value)} />
          </div>
        )}
      </div>

      {/* بطاقات الملخص */}
      <div className="rpt-summary-grid">
        {[
          {label:'إجمالي الحجوزات',  value:s?.total_bookings,       icon:'📋', type:'count'},
          {label:'الحجوزات المؤكدة', value:s?.confirmed_bookings,   icon:'✅', type:'count'},
          {label:'إجمالي الإيرادات', value:s?.total_revenue,        icon:'💰', type:'amount'},
          {label:'إجمالي الخصومات', value:s?.total_discount,        icon:'🏷️', type:'amount'},
          {label:'متوسط قيمة الحجز',value:s?.avg_booking_value,     icon:'📊', type:'amount'},
        ].map((c,i) => (
          <div key={i} className="rpt-stat" style={{ animationDelay:`${i*0.07}s` }}>
            <div className="rpt-stat-icon">{c.icon}</div>
            <div>
              <div className="rpt-stat-value">
                {loading ? '...' : c.type==='amount' ? formatAmount(Number(c.value??0)) : (c.value??0)}
              </div>
              <div className="rpt-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* التبويبات */}
      <div className="rpt-tabs">
        {([
          {key:'financial',label:'💰 مالي'},
          {key:'customers',label:'👥 العملاء'},
          {key:'heatmap',  label:'🔥 الإشغال'},
          {key:'codes',    label:'🏷️ الأكواد'},
        ] as const).map(t => (
          <button key={t.key} id={`tab-${t.key}`}
            className={`rpt-tab ${activeTab===t.key?'active':''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ===== المحتوى — مُغلَّف بـ id للـ PDF ===== */}
      <div id="report-printable" className="rpt-content">
        {/* هيدر الطباعة (مخفي في الشاشة، يظهر في الـ PDF) */}
        <div className="print-header" aria-hidden>
          <div className="print-header-top">
            <span className="print-center-name">{centerName}</span>
            <span className="print-report-type">
              {{ financial:'التقرير المالي', customers:'تقرير العملاء',
                 heatmap:'تقرير الإشغال', codes:'تقرير الأكواد' }[activeTab]}
            </span>
          </div>
          <div className="print-meta">
            الفترة: {from} إلى {to} · تاريخ الإصدار: {new Date().toLocaleDateString('ar-SA')}
          </div>
        </div>

        {loading ? (
          <div className="rpt-loading">
            <div className="spinner" style={{ width:'2rem',height:'2rem',borderWidth:'3px' }} />
            <p>جاري تحميل البيانات...</p>
          </div>
        ) : !data ? (
          <div className="rpt-empty">⚠️ لا يوجد بيانات للفترة المحددة</div>
        ) : (
          <>
            {/* ── تبويب: مالي ── */}
            {activeTab === 'financial' && (
              <div className="animate-fade-in rpt-grid-2">
                <div className="rpt-card">
                  <h3 className="rpt-card-title">🏟️ الإيرادات حسب الملعب</h3>
                  <BarChart max={maxCourtRevenue}
                    items={data.financial.revenue_by_court.map(c => ({ label:getCourtName(c.court_id), value:c.revenue }))} />
                  <div style={{ marginTop:'1.25rem' }}>
                    {data.financial.revenue_by_court.map(c => (
                      <div key={c.court_id} className="rpt-detail-row">
                        <span>{getCourtName(c.court_id)}</span>
                        <span>{c.count} حجز</span>
                        <strong style={{ color:PALETTE.green }}>{formatAmount(c.revenue)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rpt-card">
                  <h3 className="rpt-card-title">📊 توزيع الحالات</h3>
                  {Object.entries(data.summary.status_count).sort((a,b) => b[1]-a[1]).map(([status,count]) => {
                    const total = data.summary.total_bookings
                    const pct   = total>0 ? Math.round(count/total*100) : 0
                    const COLOR: Record<string,string> = {
                      confirmed:'#2D5C4E', uploaded:'#0ea5e9', pending:'#f59e0b',
                      rejected:'#ef4444', cancelled:'#94a3b8', expired:'#cbd5e1'
                    }
                    return (
                      <div key={status} style={{ marginBottom:'0.875rem' }}>
                        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'0.25rem',fontSize:'0.85rem' }}>
                          <span style={{ fontWeight:600 }}>{STATUS_AR[status]??status}</span>
                          <span style={{ fontWeight:700 }}>{count} <span style={{ color:'#94a3b8' }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height:8,background:'#e2e8f0',borderRadius:99,overflow:'hidden' }}>
                          <div style={{ height:'100%',width:`${pct}%`,background:COLOR[status]??'#ccc',borderRadius:99,transition:'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="rpt-card" style={{ gridColumn:'1/-1' }}>
                  <h3 className="rpt-card-title">📋 الحجوزات المؤكدة ({data.bookings.filter(b=>b.status==='confirmed').length})</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>التاريخ</th><th>الملعب</th><th>الفترة</th><th>العميل</th><th>الكود</th><th>الخصم</th><th>المبلغ</th></tr></thead>
                      <tbody>
                        {data.bookings.filter(b=>b.status==='confirmed').length===0 && (
                          <tr><td colSpan={7} style={{ textAlign:'center',color:'#94a3b8',padding:'2rem' }}>لا توجد حجوزات مؤكدة</td></tr>
                        )}
                        {data.bookings.filter(b=>b.status==='confirmed').map(b => (
                          <tr key={b.id}>
                            <td>{b.booking_date}</td>
                            <td>{getCourtName(b.court_id)}</td>
                            <td>{getPeriodName(b.period_number)}</td>
                            <td>
                              <div style={{ fontWeight:600 }}>{b.customer_name}</div>
                              <div style={{ fontSize:'0.75rem',color:'#94a3b8' }}>{b.customer_phone}</div>
                            </td>
                            <td>{b.code_used ? <span className="badge badge-confirmed">{b.code_used}</span> : <span style={{ color:'#94a3b8' }}>—</span>}</td>
                            <td style={{ color:PALETTE.green }}>{b.discount_amount>0?formatAmount(b.discount_amount):'—'}</td>
                            <td style={{ fontWeight:700,color:PALETTE.navy }}>{formatAmount(b.final_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── تبويب: العملاء ── */}
            {activeTab === 'customers' && (
              <div className="animate-fade-in rpt-grid-2">
                <div className="rpt-card">
                  <h3 className="rpt-card-title">👥 ملخص العملاء</h3>
                  {[
                    {label:'إجمالي العملاء',    value:String(data.customers.top_customers.length)},
                    {label:'عملاء جدد',         value:String(data.customers.new_customers)},
                    {label:'عملاء متكررون',     value:String(data.customers.repeat_customers)},
                    {label:'إجمالي الإيرادات',  value:formatAmount(data.summary.total_revenue)},
                  ].map((r,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span>{r.label}</span>
                      <strong style={{ color:PALETTE.navy }}>{r.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="rpt-card">
                  <h3 className="rpt-card-title">⭐ أفضل العملاء إيراداً</h3>
                  {data.customers.top_customers.slice(0,8).map((c,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span style={{ fontSize:'0.82rem' }}>
                        <span style={{ fontWeight:700,color:PALETTE.gold,marginLeft:'0.4rem' }}>#{i+1}</span>
                        {c.name}
                        <span style={{ color:'#94a3b8',marginRight:'0.4rem',fontSize:'0.75rem' }}>({c.phone})</span>
                      </span>
                      <span>
                        <span style={{ color:'#94a3b8',fontSize:'0.78rem',marginLeft:'0.5rem' }}>{c.count} حجز</span>
                        <strong style={{ color:PALETTE.green }}>{formatAmount(c.revenue)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rpt-card" style={{ gridColumn:'1/-1' }}>
                  <h3 className="rpt-card-title">📋 جدول العملاء</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>الحجوزات</th><th>الإيرادات</th></tr></thead>
                      <tbody>
                        {data.customers.top_customers.map((c,i) => (
                          <tr key={i}>
                            <td style={{ color:PALETTE.gold,fontWeight:700 }}>{i+1}</td>
                            <td style={{ fontWeight:600 }}>{c.name}</td>
                            <td style={{ direction:'ltr',textAlign:'right',color:'#94a3b8' }}>{c.phone}</td>
                            <td style={{ textAlign:'center',fontWeight:700 }}>{c.count}</td>
                            <td style={{ fontWeight:700,color:PALETTE.green }}>{formatAmount(c.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── تبويب: خريطة الإشغال ── */}
            {activeTab === 'heatmap' && (
              <div className="animate-fade-in">
                <div className="rpt-card">
                  <h3 className="rpt-card-title">🔥 خريطة حرارة الإشغال</h3>
                  <p style={{ color:'#94a3b8',fontSize:'0.85rem',marginBottom:'1.25rem' }}>
                    توزيع الحجوزات المؤكدة حسب اليوم والفترة — اللون الداكن = إشغال أعلى
                  </p>
                  <Heatmap data={data.heatmap} />
                </div>
                <div className="rpt-grid-7" style={{ marginTop:'1.25rem' }}>
                  {[1,2,3,4,5,6,0].map(day => {
                    const dayTotal = [1,2,3].reduce((s,p) => s+(data.heatmap[day]?.[p]?.booked??0),0)
                    const dayMax   = [1,2,3].reduce((s,p) => s+(data.heatmap[day]?.[p]?.total??0),0)
                    const pct      = dayMax>0 ? Math.round(dayTotal/dayMax*100) : 0
                    return (
                      <div key={day} className="rpt-day-card">
                        <div className="rpt-day-name">{DAY_LABELS[day]}</div>
                        <div className="rpt-day-pct" style={{ color:pct>60?PALETTE.navy:pct>30?PALETTE.green:'#94a3b8' }}>{pct}%</div>
                        <div className="rpt-day-count">{dayTotal} حجز</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── تبويب: الأكواد ── */}
            {activeTab === 'codes' && (
              <div className="animate-fade-in rpt-grid-2">
                <div className="rpt-card">
                  <h3 className="rpt-card-title">🏷️ ملخص الأكواد</h3>
                  {[
                    {label:'عدد الأكواد المستخدمة', value:String(data.codes.code_stats.length)},
                    {label:'حجوزات بكود',            value:String(data.codes.bookings_with_code)},
                    {label:'بدون كود',                value:String(data.summary.confirmed_bookings-data.codes.bookings_with_code)},
                    {label:'إجمالي الخصومات',        value:formatAmount(data.summary.total_discount)},
                  ].map((r,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span>{r.label}</span>
                      <strong style={{ color:PALETTE.navy }}>{r.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="rpt-card">
                  <h3 className="rpt-card-title">🏆 أكثر الأكواد استخداماً</h3>
                  {data.codes.code_stats.slice(0,8).map((c,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span>
                        <strong style={{ fontSize:'0.95rem',letterSpacing:'0.05em',marginLeft:'0.5rem' }}>{c.code}</strong>
                        <span style={{ color:'#94a3b8',fontSize:'0.78rem' }}>{c.count} استخدام</span>
                      </span>
                      <span>
                        <span style={{ color:'#ef4444',fontSize:'0.78rem',marginLeft:'0.5rem' }}>-{formatAmount(c.discount)}</span>
                        <strong style={{ color:PALETTE.green }}>{formatAmount(c.revenue)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rpt-card" style={{ gridColumn:'1/-1' }}>
                  <h3 className="rpt-card-title">📋 تفاصيل الأكواد</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>الكود</th><th>الاستخدامات</th><th>إجمالي الخصم</th><th>إجمالي الإيرادات</th></tr></thead>
                      <tbody>
                        {data.codes.code_stats.length===0 && (
                          <tr><td colSpan={4} style={{ textAlign:'center',color:'#94a3b8',padding:'2rem' }}>لا توجد أكواد مستخدمة</td></tr>
                        )}
                        {data.codes.code_stats.map((c,i) => (
                          <tr key={i}>
                            <td><strong style={{ letterSpacing:'0.08em',fontSize:'1rem' }}>{c.code}</strong></td>
                            <td style={{ textAlign:'center',fontWeight:700 }}>{c.count}</td>
                            <td style={{ color:'#ef4444',fontWeight:600 }}>{formatAmount(c.discount)}</td>
                            <td style={{ fontWeight:700,color:PALETTE.green }}>{formatAmount(c.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== CSS ===== */}
      <style>{`
        .reports-page { font-family:'Tajawal','IBM Plex Sans Arabic',sans-serif; }

        .rpt-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap; }
        .rpt-title  { font-size:1.6rem;font-weight:800;margin:0 0 0.2rem;color:${PALETTE.navy}; }
        .rpt-sub    { color:#94a3b8;font-size:0.82rem;margin:0; }

        .rpt-actions { display:flex;gap:0.6rem;flex-wrap:wrap; }
        .rpt-btn {
          display:inline-flex;align-items:center;gap:0.4rem;
          padding:0.5rem 1rem;border-radius:0.6rem;font-size:0.85rem;
          font-weight:700;cursor:pointer;border:none;
          font-family:'Tajawal',sans-serif;transition:all 0.18s;white-space:nowrap;
        }
        .rpt-btn:disabled { opacity:0.5;cursor:not-allowed; }
        .rpt-btn-excel    { background:${PALETTE.navy};color:${PALETTE.gold}; }
        .rpt-btn-whatsapp { background:#25D366;color:#fff; }
        .rpt-btn-pdf      { background:${PALETTE.green};color:#fff; }
        .rpt-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.2); }

        .rpt-filter-bar {
          display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
          background:${PALETTE.beige};border-radius:0.875rem;
          padding:0.875rem 1rem;margin-bottom:1.25rem;
        }
        .rpt-presets { display:flex;gap:0.4rem;flex-wrap:wrap; }
        .rpt-preset {
          padding:0.4rem 0.875rem;border-radius:0.5rem;font-size:0.85rem;font-weight:600;
          cursor:pointer;border:1.5px solid ${PALETTE.navy}25;background:#fff;color:${PALETTE.navy};
          font-family:'Tajawal',sans-serif;transition:all 0.15s;
        }
        .rpt-preset.active  { background:${PALETTE.navy};color:${PALETTE.gold};border-color:${PALETTE.navy}; }
        .rpt-preset:hover:not(.active) { background:${PALETTE.navy}12; }
        .rpt-custom-range {
          display:flex;align-items:center;gap:0.6rem;
          font-size:0.85rem;font-weight:600;color:${PALETTE.navy};
        }
        .rpt-date-input { width:150px;font-size:0.85rem;padding:0.4rem 0.6rem; }

        .rpt-summary-grid {
          display:grid;grid-template-columns:repeat(5,1fr);gap:0.875rem;margin-bottom:1.25rem;
        }
        @media(max-width:1000px) { .rpt-summary-grid { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:600px)  { .rpt-summary-grid { grid-template-columns:repeat(2,1fr); } }
        .rpt-stat {
          background:#fff;border-radius:0.875rem;border:1px solid #e2e8f0;padding:1rem;
          display:flex;align-items:center;gap:0.875rem;
          animation:fadeIn 0.4s ease both;transition:all 0.2s;
        }
        .rpt-stat:hover { box-shadow:0 4px 16px rgba(27,42,59,.1);transform:translateY(-2px); }
        .rpt-stat-icon  { font-size:1.6rem; }
        .rpt-stat-value { font-size:1.25rem;font-weight:800;color:${PALETTE.navy};line-height:1;margin-bottom:0.2rem; }
        .rpt-stat-label { font-size:0.72rem;color:#94a3b8;font-weight:500; }

        .rpt-tabs {
          display:flex;gap:0.4rem;margin-bottom:1.25rem;
          border-bottom:2px solid #e2e8f0;padding-bottom:0;
        }
        .rpt-tab {
          padding:0.6rem 1.25rem;border-radius:0.625rem 0.625rem 0 0;
          font-size:0.9rem;font-weight:700;cursor:pointer;border:none;
          background:transparent;color:#94a3b8;font-family:'Tajawal',sans-serif;
          transition:all 0.15s;border-bottom:3px solid transparent;margin-bottom:-2px;
        }
        .rpt-tab.active { color:${PALETTE.navy};background:${PALETTE.beige};border-bottom-color:${PALETTE.gold}; }
        .rpt-tab:hover:not(.active) { color:${PALETTE.navy};background:#f8fafc; }

        .rpt-content { min-height:400px;background:${PALETTE.beige};border-radius:0.875rem;padding:1.25rem; }
        .rpt-loading  { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:4rem;color:#94a3b8; }
        .rpt-empty    { text-align:center;padding:4rem;color:#94a3b8;font-size:1.1rem; }

        .rpt-card       { background:#fff;border-radius:0.875rem;border:1px solid #e2e8f0;padding:1.25rem; }
        .rpt-card-title { font-size:0.95rem;font-weight:800;color:${PALETTE.navy};margin:0 0 1rem; }
        .rpt-grid-2     { display:grid;grid-template-columns:1fr 1fr;gap:1.25rem; }
        .rpt-grid-7     { display:grid;grid-template-columns:repeat(7,1fr);gap:0.75rem; }
        @media(max-width:900px) { .rpt-grid-2 { grid-template-columns:1fr; } .rpt-grid-7 { grid-template-columns:repeat(4,1fr); } }
        @media(max-width:480px) { .rpt-grid-7 { grid-template-columns:repeat(2,1fr); } }

        .rpt-detail-row {
          display:flex;align-items:center;justify-content:space-between;
          padding:0.55rem 0;border-bottom:1px solid #f1f5f9;font-size:0.875rem;
        }
        .rpt-detail-row:last-child { border-bottom:none; }

        /* Heatmap */
        .heatmap-wrap   { overflow-x:auto; }
        .heatmap-table  { border-collapse:collapse;width:100%;min-width:320px; }
        .heatmap-corner { background:${PALETTE.beige};padding:0.6rem 1rem;font-size:0.8rem;font-weight:700;color:${PALETTE.navy};text-align:right; }
        .heatmap-th     { padding:0.6rem 1rem;background:${PALETTE.navy};color:${PALETTE.gold};font-size:0.85rem;font-weight:700;text-align:center; }
        .heatmap-day-label { padding:0.6rem 1rem;background:${PALETTE.beige};font-weight:700;font-size:0.85rem;color:${PALETTE.navy};white-space:nowrap; }
        .heatmap-cell   { padding:0.875rem 0.5rem;text-align:center;border:2px solid #fff;transition:all 0.2s;cursor:default; }
        .heatmap-cell:hover { transform:scale(1.05);z-index:1;position:relative; }
        .heatmap-pct    { font-weight:800;font-size:0.95rem; }
        .heatmap-sub    { font-size:0.65rem;opacity:0.75;margin-top:0.15rem; }
        .heatmap-legend { display:flex;align-items:center;gap:0.75rem;margin-top:1rem;font-size:0.8rem;color:#94a3b8; }
        .legend-scale   { display:flex;gap:3px; }

        /* Day cards */
        .rpt-day-card  { background:#fff;border-radius:0.75rem;border:1px solid #e2e8f0;padding:0.875rem 0.5rem;text-align:center; }
        .rpt-day-name  { font-size:0.72rem;font-weight:700;color:#94a3b8;margin-bottom:0.3rem; }
        .rpt-day-pct   { font-size:1.4rem;font-weight:800;margin-bottom:0.2rem; }
        .rpt-day-count { font-size:0.7rem;color:#94a3b8; }

        /* هيدر الطباعة */
        .print-header     { display:none; }
        .print-header-top { display:flex;justify-content:space-between;align-items:center;
          background:${PALETTE.navy};color:#fff;padding:0.875rem 1.25rem;border-radius:0.75rem 0.75rem 0 0;margin-bottom:0; }
        .print-center-name  { font-weight:800;font-size:1.1rem;color:${PALETTE.gold}; }
        .print-report-type  { font-weight:600;font-size:0.95rem; }
        .print-meta { background:${PALETTE.beige};padding:0.5rem 1.25rem;font-size:0.82rem;
          color:${PALETTE.navy};border-radius:0 0 0.75rem 0.75rem;margin-bottom:1rem; }

        /* ── Mobile Responsive ── */
        @media (max-width: 768px) {
          /* Header & export buttons stack */
          .rpt-header { flex-direction:column; align-items:stretch; text-align:center; }
          .rpt-actions { flex-direction:column; }
          .rpt-btn { width:100%; justify-content:center; }

          /* Filter presets wrap */
          .rpt-presets { flex-wrap:wrap; justify-content:center; }
          .rpt-filter-bar { flex-direction:column; align-items:stretch; }
          .rpt-custom-range { flex-wrap:wrap; justify-content:center; }
          .rpt-date-input { width:100%; }

          /* Summary grid 2-col */
          .rpt-summary-grid { grid-template-columns:1fr 1fr; }
          .rpt-stat-icon { font-size:1.2rem; }
          .rpt-stat-value { font-size:1rem; }

          /* Tabs: horizontal scroll */
          .rpt-tabs { overflow-x:auto; -webkit-overflow-scrolling:touch; gap:0.25rem; flex-wrap:nowrap; }
          .rpt-tab { white-space:nowrap; flex-shrink:0; padding:0.5rem 0.875rem; font-size:0.8rem; }

          /* Content cards & grids stack */
          .rpt-grid-2 { grid-template-columns:1fr; }
          .rpt-content { padding:0.875rem; }

          /* Tables scroll horizontally */
          .table-container { overflow-x:auto; -webkit-overflow-scrolling:touch; }

          /* Heatmap scroll */
          .heatmap-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }

          /* Day cards grid */
          .rpt-grid-7 { grid-template-columns:repeat(3,1fr); }
          .rpt-day-pct { font-size:1.1rem; }
        }
      `}</style>
    </div>
  )
}
