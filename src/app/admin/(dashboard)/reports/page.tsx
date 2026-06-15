'use client'
// ============================================================
// صفحة التقارير — /admin/(dashboard)/reports
// إصدار v2: فلاتر + filteredBookings + PDF احترافي + Excel متعدد + واتساب مفصّل
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'

// ============================================================
// الأنواع
// ============================================================
interface Booking {
  id: string; booking_date: string; court_id: string; period_number: number
  customer_name: string; customer_phone: string; status: string
  code_used: string | null; final_price: number; discount_amount: number
  base_price?: number; is_manual: boolean; created_at: string
}
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
  bookings: Booking[]
}

// ============================================================
// ثوابت
// ============================================================
const PALETTE = {
  navy:  '#1B2A3B',
  green: '#2D5C4E',
  gold:  '#C9A96E',
  beige: '#F5F2EC',
}

const PERIOD_LABELS: Record<number, string> = { 1:'5–7م', 2:'7–9م', 3:'9–11م' }
const DAY_LABELS: Record<number, string> = {
  0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'
}
const STATUS_AR: Record<string,string> = {
  confirmed:'مؤكد', pending:'بانتظار إيصال', uploaded:'قيد المراجعة',
  rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي'
}
const COURTS = [
  { id: 'all',        label: 'كل الملاعب',     icon: '🏟️' },
  { id: 'football',   label: 'كرة القدم',      icon: '⚽' },
  { id: 'volleyball', label: 'الكرة الطائرة',  icon: '🏐' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏟️' },
]
const STATUSES = [
  { id: 'all',       label: 'كل الحالات' },
  { id: 'confirmed', label: 'مؤكد' },
  { id: 'pending',   label: 'بانتظار' },
  { id: 'uploaded',  label: 'قيد المراجعة' },
  { id: 'cancelled', label: 'ملغى' },
]

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
// Heatmap Component
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
// BarChart Component
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
  // ── الحالات ──
  const [preset, setPreset]        = useState('month')
  const [customFrom, setCFrom]     = useState('')
  const [customTo,   setCTo]       = useState('')
  const [activeTab,  setTab]       = useState<'financial'|'customers'|'heatmap'|'codes'>('financial')
  const [data,       setData]      = useState<ReportData | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [settings,   setSettings]  = useState<Record<string,string>>({})
  // ── فلاتر جديدة ──
  const [courtFilter,  setCourtFilter]  = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  // ============================================================
  // filteredBookings — القلب الجديد
  // ============================================================
  const filteredBookings = useMemo(() => {
    if (!data) return []
    let result = data.bookings
    if (courtFilter !== 'all') {
      result = result.filter(b => b.court_id === courtFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter(b => b.status === statusFilter)
    }
    return result
  }, [data, courtFilter, statusFilter])

  // ============================================================
  // filteredStats — إعادة حساب كل الإحصائيات
  // ============================================================
  const filteredStats = useMemo(() => {
    const all = filteredBookings
    const confirmed = all.filter(b => b.status === 'confirmed')
    const totalRevenue  = confirmed.reduce((s, b) => s + (b.final_price ?? 0), 0)
    const totalDiscount = confirmed.reduce((s, b) => s + (b.discount_amount ?? 0), 0)
    const avgValue = confirmed.length > 0 ? Math.round(totalRevenue / confirmed.length) : 0

    // حالات
    const statusCount: Record<string, number> = {}
    all.forEach(b => { statusCount[b.status] = (statusCount[b.status] ?? 0) + 1 })

    // إيرادات حسب الملعب
    const courtMap: Record<string, { revenue: number; count: number }> = {}
    confirmed.forEach(b => {
      if (!courtMap[b.court_id]) courtMap[b.court_id] = { revenue: 0, count: 0 }
      courtMap[b.court_id].revenue += b.final_price ?? 0
      courtMap[b.court_id].count++
    })
    const revenueByCourt = Object.entries(courtMap).map(([court_id, v]) => ({ court_id, ...v }))

    // عملاء
    const custMap: Record<string, { name: string; phone: string; count: number; revenue: number }> = {}
    confirmed.forEach(b => {
      if (!custMap[b.customer_phone]) {
        custMap[b.customer_phone] = { name: b.customer_name, phone: b.customer_phone, count: 0, revenue: 0 }
      }
      custMap[b.customer_phone].count++
      custMap[b.customer_phone].revenue += b.final_price ?? 0
    })
    const topCustomers = Object.values(custMap).sort((a, b) => b.revenue - a.revenue)

    // أكواد
    const codeMap: Record<string, { count: number; discount: number; revenue: number }> = {}
    confirmed.filter(b => b.code_used).forEach(b => {
      const code = b.code_used!
      if (!codeMap[code]) codeMap[code] = { count: 0, discount: 0, revenue: 0 }
      codeMap[code].count++
      codeMap[code].discount += b.discount_amount ?? 0
      codeMap[code].revenue  += b.final_price ?? 0
    })
    const codeStats = Object.entries(codeMap)
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.count - a.count)

    return {
      total_bookings: all.length,
      confirmed_bookings: confirmed.length,
      total_revenue: totalRevenue,
      total_discount: totalDiscount,
      avg_booking_value: avgValue,
      status_count: statusCount,
      revenue_by_court: revenueByCourt,
      top_customers: topCustomers,
      new_customers: topCustomers.filter(c => c.count === 1).length,
      repeat_customers: topCustomers.filter(c => c.count > 1).length,
      code_stats: codeStats,
      bookings_with_code: confirmed.filter(b => b.code_used).length,
    }
  }, [filteredBookings])

  // ============================================================
  // Excel متعدد الشيتات (ExcelJS)
  // ============================================================
  async function exportExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = centerName
    wb.created = new Date()

    const headerFill = { type:'pattern' as const, pattern:'solid' as const, fgColor:{ argb:'FF1B2A3B' } }
    const headerFont = { bold:true, color:{ argb:'FFC9A96E' }, size:11, name:'Tahoma' }
    const confirmedFill = { type:'pattern' as const, pattern:'solid' as const, fgColor:{ argb:'FFE8F5E9' } }
    const pendingFill   = { type:'pattern' as const, pattern:'solid' as const, fgColor:{ argb:'FFFFFDE7' } }
    const cancelledFill  = { type:'pattern' as const, pattern:'solid' as const, fgColor:{ argb:'FFF5F5F5' } }

    function getStatusFill(status: string) {
      if (status === 'confirmed') return confirmedFill
      if (['pending','uploaded'].includes(status)) return pendingFill
      if (['cancelled','rejected','expired'].includes(status)) return cancelledFill
      return undefined
    }

    function styleHeaders(ws: any) {
      const row = ws.getRow(1)
      row.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal:'right', vertical:'middle' }
      })
      row.height = 28
    }

    const bookingCols = [
      { header:'الاسم',         key:'name',     width:22 },
      { header:'الجوال',        key:'phone',    width:16 },
      { header:'الكود',         key:'code',     width:12 },
      { header:'الفترة',        key:'period',   width:10 },
      { header:'التاريخ',       key:'date',     width:14 },
      { header:'المبلغ الأصلي', key:'base',     width:14 },
      { header:'الخصم',         key:'discount', width:12 },
      { header:'المبلغ النهائي', key:'final',    width:14 },
      { header:'الحالة',        key:'status',   width:14 },
    ]

    function addBookingsToSheet(ws: any, bookings: Booking[]) {
      bookings.forEach(b => {
        const row = ws.addRow({
          name: b.customer_name,
          phone: b.customer_phone,
          code: b.code_used ?? '',
          period: getPeriodName(b.period_number),
          date: b.booking_date,
          base: b.base_price ?? b.final_price + b.discount_amount,
          discount: b.discount_amount,
          final: b.final_price,
          status: STATUS_AR[b.status] ?? b.status,
        })
        const fill = getStatusFill(b.status)
        if (fill) {
          row.eachCell((cell: any) => { cell.fill = fill })
        }
      })
    }

    // ── شيت ١: ملخص عام ──
    const ws1 = wb.addWorksheet('ملخص عام')
    ws1.columns = [
      { header:'البند', key:'label', width:25 },
      { header:'القيمة', key:'value', width:20 },
    ]
    styleHeaders(ws1)
    ws1.addRow({ label:'إجمالي الحجوزات', value: filteredStats.total_bookings })
    ws1.addRow({ label:'الحجوزات المؤكدة', value: filteredStats.confirmed_bookings })
    ws1.addRow({ label:'إجمالي الإيرادات', value: filteredStats.total_revenue })
    ws1.addRow({ label:'إجمالي الخصومات', value: filteredStats.total_discount })
    ws1.addRow({ label:'متوسط قيمة الحجز', value: filteredStats.avg_booking_value })
    ws1.addRow({})
    ws1.addRow({ label:'── مقارنة الملاعب ──', value:'' })
    const cmpHeaders = ws1.addRow({ label:'الملعب', value:'الحجوزات' })
    // Add revenue column
    ws1.getColumn(3).header = 'الإيرادات'
    ws1.getColumn(3).width = 18
    cmpHeaders.getCell(3).value = 'الإيرادات'
    cmpHeaders.eachCell(cell => { cell.fill = headerFill; cell.font = headerFont })
    filteredStats.revenue_by_court.forEach(c => {
      ws1.addRow({ label: getCourtName(c.court_id), value: c.count }).getCell(3).value = c.revenue
    })

    // ── شيت ٢-٤: حسب الملعب ──
    const courtIds = ['football', 'volleyball', 'multi'] as const
    const courtNames: Record<string, string> = { football:'كرة القدم', volleyball:'الكرة الطائرة', multi:'الملعب المتعدد' }
    courtIds.forEach(courtId => {
      const courtBookings = filteredBookings.filter(b => b.court_id === courtId)
      const ws = wb.addWorksheet(courtNames[courtId])
      ws.columns = bookingCols
      styleHeaders(ws)
      addBookingsToSheet(ws, courtBookings)
    })

    // ── شيت ٥: العملاء ──
    const ws5 = wb.addWorksheet('العملاء')
    ws5.columns = [
      { header:'الاسم',         key:'name',    width:22 },
      { header:'الجوال',        key:'phone',   width:16 },
      { header:'عدد الحجوزات', key:'count',   width:14 },
      { header:'إجمالي المدفوعات', key:'revenue', width:18 },
    ]
    styleHeaders(ws5)
    filteredStats.top_customers.forEach(c => {
      ws5.addRow({ name:c.name, phone:c.phone, count:c.count, revenue:c.revenue })
    })

    // حفظ
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${centerName}-تقرير-${from}-${to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ============================================================
  // واتساب مفصّل
  // ============================================================
  function shareWhatsApp() {
    if (!data) return
    const confirmed = filteredBookings.filter(b => b.status === 'confirmed')

    function courtStats(courtId: string, icon: string, name: string): string {
      const courtAll = filteredBookings.filter(b => b.court_id === courtId)
      const courtConf = courtAll.filter(b => b.status === 'confirmed')
      if (courtAll.length === 0) return ''
      const rev = courtConf.reduce((s,b) => s + (b.final_price ?? 0), 0)
      const disc = courtConf.reduce((s,b) => s + (b.discount_amount ?? 0), 0)
      // أكثر فترة طلباً
      const periodCount: Record<number, number> = {}
      courtConf.forEach(b => { periodCount[b.period_number] = (periodCount[b.period_number] ?? 0) + 1 })
      const topPeriod = Object.entries(periodCount).sort((a,b) => Number(b[1]) - Number(a[1]))[0]
      const topPeriodLabel = topPeriod ? PERIOD_LABELS[Number(topPeriod[0])] ?? '' : '—'

      return [
        `━━━━━━━━━━━━━━━━━━━━━`,
        `${icon} *${name}*`,
        `الحجوزات: ${courtAll.length} (مؤكدة: ${courtConf.length})`,
        `الإيرادات: ${formatAmount(rev)}`,
        `الخصومات: ${formatAmount(disc)}`,
        `أكثر فترة طلباً: ${topPeriodLabel}`,
      ].join('\n')
    }

    const statusCounts = filteredStats.status_count
    const lines = [
      `📊 *تقرير ${centerName}*`,
      `📅 من ${from} إلى ${to}`,
      `🕐 صدر: ${new Date().toLocaleString('ar-SA')}`,
      '',
    ]

    // إضافة إحصائيات كل ملعب (فقط لو فيه بيانات)
    if (courtFilter === 'all') {
      const f = courtStats('football', '⚽', 'كرة القدم')
      const v = courtStats('volleyball', '🏐', 'الكرة الطائرة')
      const m = courtStats('multi', '🏟️', 'الملعب المتعدد')
      if (f) lines.push(f)
      if (v) lines.push(v)
      if (m) lines.push(m)
    } else {
      const info = COURTS.find(c => c.id === courtFilter)
      if (info) {
        const s = courtStats(courtFilter, info.icon, info.label)
        if (s) lines.push(s)
      }
    }

    lines.push(
      '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📦 *الإجمالي*`,
      `إجمالي الحجوزات: ${filteredStats.total_bookings}`,
      `✅ مؤكدة: ${filteredStats.confirmed_bookings} | 🟡 معلقة: ${(statusCounts['pending'] ?? 0) + (statusCounts['uploaded'] ?? 0)} | ❌ ملغاة: ${statusCounts['cancelled'] ?? 0}`,
      `💰 إجمالي الإيرادات: ${formatAmount(filteredStats.total_revenue)}`,
      `🎁 إجمالي الخصومات: ${formatAmount(filteredStats.total_discount)}`,
      `📊 متوسط الحجز: ${formatAmount(filteredStats.avg_booking_value)}`,
    )

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // ============================================================
  // PDF احترافي
  // ============================================================
  async function exportPDF() {
    if (!data) return
    const { generateReport } = await import('@/lib/pdf-generator')
    await generateReport({
      centerName,
      from, to,
      summary: {
        total_bookings: filteredStats.total_bookings,
        confirmed_bookings: filteredStats.confirmed_bookings,
        total_revenue: filteredStats.total_revenue,
        total_discount: filteredStats.total_discount,
        avg_booking_value: filteredStats.avg_booking_value,
        status_count: filteredStats.status_count,
      },
      revenueByCourt: filteredStats.revenue_by_court.map(c => ({
        court: getCourtName(c.court_id), count: c.count, revenue: c.revenue,
      })),
      bookings: filteredBookings.map(b => ({
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        court: getCourtName(b.court_id),
        period: getPeriodName(b.period_number),
        booking_date: b.booking_date,
        final_price: b.final_price,
        discount_amount: b.discount_amount,
        status: b.status,
      })),
    })
  }

  const maxCourtRevenue = Math.max(1, ...filteredStats.revenue_by_court.map(c => c.revenue))

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

      {/* ── فلتر المدة + الملعب + الحالة ── */}
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

        {/* فلتر الملعب */}
        <select
          id="filter-court"
          className="rpt-select"
          value={courtFilter}
          onChange={e => setCourtFilter(e.target.value)}
        >
          {COURTS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>

        {/* فلتر الحالة */}
        <select
          id="filter-status"
          className="rpt-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUSES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* بطاقات الملخص — من filteredStats */}
      <div className="rpt-summary-grid">
        {[
          {label:'إجمالي الحجوزات',  value:filteredStats.total_bookings,       icon:'📋', type:'count'},
          {label:'الحجوزات المؤكدة', value:filteredStats.confirmed_bookings,   icon:'✅', type:'count'},
          {label:'إجمالي الإيرادات', value:filteredStats.total_revenue,        icon:'💰', type:'amount'},
          {label:'إجمالي الخصومات', value:filteredStats.total_discount,        icon:'🏷️', type:'amount'},
          {label:'متوسط قيمة الحجز',value:filteredStats.avg_booking_value,     icon:'📊', type:'amount'},
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

      {/* ===== المحتوى ===== */}
      <div id="report-printable" className="rpt-content">
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
                    items={filteredStats.revenue_by_court.map(c => ({ label:getCourtName(c.court_id), value:c.revenue }))} />
                  <div style={{ marginTop:'1.25rem' }}>
                    {filteredStats.revenue_by_court.map(c => (
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
                  {Object.entries(filteredStats.status_count).sort((a,b) => b[1]-a[1]).map(([status,count]) => {
                    const total = filteredStats.total_bookings
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
                  <h3 className="rpt-card-title">📋 الحجوزات المؤكدة ({filteredBookings.filter(b=>b.status==='confirmed').length})</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>التاريخ</th><th>الملعب</th><th>الفترة</th><th>العميل</th><th>الكود</th><th>الخصم</th><th>المبلغ</th></tr></thead>
                      <tbody>
                        {filteredBookings.filter(b=>b.status==='confirmed').length===0 && (
                          <tr><td colSpan={7} style={{ textAlign:'center',color:'#94a3b8',padding:'2rem' }}>لا توجد حجوزات مؤكدة</td></tr>
                        )}
                        {filteredBookings.filter(b=>b.status==='confirmed').map(b => (
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
                    {label:'إجمالي العملاء',    value:String(filteredStats.top_customers.length)},
                    {label:'عملاء جدد',         value:String(filteredStats.new_customers)},
                    {label:'عملاء متكررون',     value:String(filteredStats.repeat_customers)},
                    {label:'إجمالي الإيرادات',  value:formatAmount(filteredStats.total_revenue)},
                  ].map((r,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span>{r.label}</span>
                      <strong style={{ color:PALETTE.navy }}>{r.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="rpt-card">
                  <h3 className="rpt-card-title">⭐ أفضل العملاء إيراداً</h3>
                  {filteredStats.top_customers.slice(0,8).map((c,i) => (
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
                        {filteredStats.top_customers.map((c,i) => (
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
            {activeTab === 'heatmap' && data.heatmap && (
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
                    {label:'عدد الأكواد المستخدمة', value:String(filteredStats.code_stats.length)},
                    {label:'حجوزات بكود',            value:String(filteredStats.bookings_with_code)},
                    {label:'بدون كود',                value:String(filteredStats.confirmed_bookings-filteredStats.bookings_with_code)},
                    {label:'إجمالي الخصومات',        value:formatAmount(filteredStats.total_discount)},
                  ].map((r,i) => (
                    <div key={i} className="rpt-detail-row">
                      <span>{r.label}</span>
                      <strong style={{ color:PALETTE.navy }}>{r.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="rpt-card">
                  <h3 className="rpt-card-title">🏆 أكثر الأكواد استخداماً</h3>
                  {filteredStats.code_stats.slice(0,8).map((c,i) => (
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
                        {filteredStats.code_stats.length===0 && (
                          <tr><td colSpan={4} style={{ textAlign:'center',color:'#94a3b8',padding:'2rem' }}>لا توجد أكواد مستخدمة</td></tr>
                        )}
                        {filteredStats.code_stats.map((c,i) => (
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

        /* ── فلتر Select ── */
        .rpt-select {
          padding:0.4rem 0.875rem;border-radius:0.5rem;font-size:0.85rem;font-weight:600;
          border:1.5px solid ${PALETTE.navy}25;background:#fff;color:${PALETTE.navy};
          font-family:'Tajawal',sans-serif;cursor:pointer;min-width:130px;
          appearance:auto;
        }
        .rpt-select:focus { outline:none;border-color:${PALETTE.gold};box-shadow:0 0 0 3px ${PALETTE.gold}33; }

        .rpt-summary-grid {
          display:grid !important;grid-template-columns:1fr 1fr !important;gap:0.75rem !important;margin-bottom:1.25rem;
        }
        @media(min-width:601px)  { .rpt-summary-grid { grid-template-columns:repeat(3,1fr) !important; gap:0.875rem !important; } }
        @media(min-width:1001px) { .rpt-summary-grid { grid-template-columns:repeat(5,1fr) !important; gap:0.875rem !important; } }
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
        .rpt-grid-2     { display:grid !important;grid-template-columns:1fr !important;gap:1.25rem; }
        .rpt-grid-7     { display:grid !important;grid-template-columns:repeat(2,1fr) !important;gap:0.75rem; }
        @media(min-width:481px) { .rpt-grid-7 { grid-template-columns:repeat(4,1fr) !important; } }
        @media(min-width:901px) { .rpt-grid-2 { grid-template-columns:1fr 1fr !important; } .rpt-grid-7 { grid-template-columns:repeat(7,1fr) !important; } }

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

        /* ── Mobile Responsive ── */
        @media (max-width: 768px) {
          .rpt-header { flex-direction:column !important; align-items:stretch !important; text-align:center !important; }
          .rpt-actions { flex-direction:column !important; }
          .rpt-btn { width:100% !important; justify-content:center !important; }

          .rpt-presets { flex-wrap:wrap !important; justify-content:center !important; }
          .rpt-filter-bar { flex-direction:column !important; align-items:stretch !important; }
          .rpt-custom-range { flex-wrap:wrap !important; justify-content:center !important; }
          .rpt-date-input { width:100% !important; }
          .rpt-select { width:100% !important; }

          .rpt-summary-grid { grid-template-columns:1fr 1fr !important; gap:0.75rem !important; }
          .rpt-stat-icon { font-size:1.2rem !important; }
          .rpt-stat-value { font-size:1rem !important; }
          .rpt-stat { padding:0.75rem !important; gap:0.6rem !important; }

          .rpt-tabs { overflow-x:auto !important; -webkit-overflow-scrolling:touch; gap:0.25rem !important; flex-wrap:nowrap !important; }
          .rpt-tab { white-space:nowrap !important; flex-shrink:0 !important; padding:0.5rem 0.875rem !important; font-size:0.8rem !important; }

          .rpt-grid-2 { grid-template-columns:1fr !important; }
          .rpt-content { padding:0.875rem !important; }
          .table-container { overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
          .heatmap-wrap { overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
          .rpt-grid-7 { grid-template-columns:repeat(3,1fr) !important; }
          .rpt-day-pct { font-size:1.1rem !important; }
        }
      `}</style>
    </div>
  )
}
