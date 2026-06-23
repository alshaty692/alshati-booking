'use client'
// ============================================================
// صفحة التقارير — نظام التبديل بين أنواع التقارير
// كل نوع يعرض أقسامه فقط + تصدير مستقل
// ============================================================
import { useState, useEffect, useCallback } from 'react'

import FilterBar, { getDateRange } from '@/components/reports/FilterBar'
import KpiStrip from '@/components/reports/KpiStrip'
import Heatmap from '@/components/reports/Heatmap'
import FinancialSection from '@/components/reports/FinancialSection'
import BookingsSection from '@/components/reports/BookingsSection'
import CustomersSection from '@/components/reports/CustomersSection'
import CodesSection from '@/components/reports/CodesSection'
import OperationsSection from '@/components/reports/OperationsSection'
import ExportAllBar from '@/components/reports/ExportAllBar'

import type { FilterState, ReportData } from '@/types/reports'
import { formatAmount, getCourtName, getPeriodName } from '@/lib/utils'

// ── نوع التقرير ──
type ReportType = 'all' | 'financial' | 'bookings' | 'customers' | 'codes'
const REPORT_TYPES: { id: ReportType; label: string; icon: string }[] = [
  { id: 'all',       label: 'شامل',         icon: '📊' },
  { id: 'financial', label: 'مالي',          icon: '💰' },
  { id: 'bookings',  label: 'الحجوزات',      icon: '📋' },
  { id: 'customers', label: 'العملاء',        icon: '👥' },
  { id: 'codes',     label: 'أكواد الخصم',   icon: '🏷️' },
]

function getInitialFilter(): FilterState {
  const { from, to } = getDateRange('month')
  return { preset: 'month', from, to, court: 'all', status: 'all' }
}

function LoadingState() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'5rem', color:'var(--text-muted)' }}>
      <div className="spinner" style={{ width:'2.5rem', height:'2.5rem', borderWidth:'3px' }} />
      <p style={{ margin:0 }}>جاري تحميل التقارير…</p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-muted)' }}>
      <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>⚠️</div>
      <p style={{ margin:'0 0 1rem' }}>{error}</p>
      <button onClick={onRetry} style={{
        padding:'0.5rem 1.25rem', borderRadius:'0.5rem',
        background:'var(--color-lime)', color:'var(--text-on-lime)',
        border:'none', cursor:'pointer', fontWeight:700,
      }}>إعادة المحاولة</button>
    </div>
  )
}

// ── مساعد تنزيل الملف ──
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── مساعد بناء PDF (html2canvas) ──
async function buildSectionPDF(html: string, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-9999;'
  container.innerHTML = html
  document.body.appendChild(container)
  await document.fonts.ready
  await new Promise(r => setTimeout(r, 200))
  const el = container.querySelector('.pdf-report') as HTMLElement
  if (!el) { document.body.removeChild(container); return }
  const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false, windowWidth:800 })
  document.body.removeChild(container)
  const imgW = 210, pageH = 297
  const imgH = (canvas.height * imgW) / canvas.width
  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  let left = imgH, pos = 0
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, imgW, imgH)
  left -= pageH
  while (left > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, imgW, imgH); left -= pageH }
  pdf.save(filename)
}

// ── هيكل HTML مشترك للـ PDF ──
const PDF_CSS = `
  * { box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal','IBM Plex Sans Arabic',Arial,sans-serif;direction:rtl; }
  .pdf-report { width:760px;padding:20px;background:#fff;color:#1B2A3B; }
  .pdf-header { background:#1B2A3B;color:#fff;padding:18px 22px;border-radius:10px;text-align:center;margin-bottom:18px; }
  .pdf-header h1 { color:#C8FF3E;font-size:20px;font-weight:800;margin-bottom:4px; }
  .pdf-header p  { font-size:11px;color:#94a3b8; }
  .pdf-section { margin-bottom:20px; }
  .pdf-section-title { font-size:15px;font-weight:800;color:#2D5C4E;margin-bottom:10px;padding-bottom:5px;border-bottom:2px solid #C8FF3E; }
  .pdf-stats { display:flex;gap:10px;margin-bottom:14px; }
  .pdf-stat  { flex:1;background:#f0f5f1;border-radius:8px;padding:12px;text-align:center; }
  .pdf-stat-val { font-size:16px;font-weight:800;color:#1B2A3B; }
  .pdf-stat-lbl { font-size:10px;color:#94a3b8;margin-top:2px; }
  table { width:100%;border-collapse:collapse;font-size:11px; }
  th { background:#1B2A3B;color:#C8FF3E;padding:7px 9px;text-align:right;font-weight:700; }
  td { padding:6px 9px;border-bottom:1px solid #e2e8f0;text-align:right; }
  tr:nth-child(even) td { background:#f8f9fa; }
  .footer { text-align:center;color:#94a3b8;font-size:9px;margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0; }
`

// ═══════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [filter,      setFilter]      = useState<FilterState>(getInitialFilter)
  const [data,        setData]        = useState<ReportData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [settings,    setSettings]    = useState<Record<string, string>>({})
  const [reportType,  setReportType]  = useState<ReportType>('all')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings ?? {})).catch(() => {})
  }, [])

  const fetchData = useCallback(async (f: FilterState) => {
    if (!f.from || !f.to) return
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ from: f.from, to: f.to, court: f.court, status: f.status })
      const res = await fetch(`/api/admin/reports?${params}`)
      if (!res.ok) throw new Error(`خطأ ${res.status}`)
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل جلب التقارير')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(filter) }, [filter, fetchData])

  const centerName = settings.facility_name ?? 'مركز حي الشاطئ'

  // ═══════════════════════════════════════════════════════════
  // دوال PDF — مخصصة لكل قسم
  // ═══════════════════════════════════════════════════════════
  async function exportFinancialPDF() {
    if (!data) return
    const { kpis, financial } = data
    const fmt = (n: number) => n.toLocaleString('ar-SA') + ' ر.س'
    const html = `<style>${PDF_CSS}</style>
    <div class="pdf-report">
      <div class="pdf-header">
        <h1>${centerName}</h1>
        <p>التقرير المالي · ${filter.from} ← ${filter.to}</p>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">💰 الملخص المالي</div>
        <div class="pdf-stats">
          <div class="pdf-stat"><div class="pdf-stat-val">${fmt(kpis.total_revenue)}</div><div class="pdf-stat-lbl">الإيرادات الصافية</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${fmt(kpis.total_discount)}</div><div class="pdf-stat-lbl">الخصومات</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${fmt(kpis.water_revenue)}</div><div class="pdf-stat-lbl">إيرادات المياه</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${fmt(kpis.avg_booking_value)}</div><div class="pdf-stat-lbl">متوسط الحجز</div></div>
        </div>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">🏟️ الإيرادات حسب الملعب</div>
        <table><thead><tr><th>الملعب</th><th>الحجوزات</th><th>الإيرادات</th></tr></thead>
        <tbody>${financial.by_court.map(c => `<tr><td>${c.name}</td><td>${c.count}</td><td>${fmt(c.revenue)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="footer">تم الإنشاء بواسطة النظام الداخلي · ${new Date().toLocaleString('ar-SA')}</div>
    </div>`
    await buildSectionPDF(html, `${centerName}-مالي-${filter.from}-${filter.to}.pdf`)
  }

  async function exportBookingsPDF() {
    if (!data) return
    const { kpis, bookings_report: br } = data
    const STATUS_AR: Record<string, string> = { confirmed:'مؤكد',pending:'بانتظار',uploaded:'قيد المراجعة',rejected:'مرفوض',cancelled:'ملغى',expired:'منتهي' }
    const html = `<style>${PDF_CSS}</style>
    <div class="pdf-report">
      <div class="pdf-header">
        <h1>${centerName}</h1>
        <p>تقرير الحجوزات · ${filter.from} ← ${filter.to}</p>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">📋 ملخص الحجوزات</div>
        <div class="pdf-stats">
          <div class="pdf-stat"><div class="pdf-stat-val">${br.total}</div><div class="pdf-stat-lbl">الإجمالي</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${kpis.confirmed_count}</div><div class="pdf-stat-lbl">المؤكدة</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${kpis.cancellation_rate}%</div><div class="pdf-stat-lbl">نسبة الإلغاء</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${br.online_count}</div><div class="pdf-stat-lbl">أونلاين</div></div>
        </div>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">📋 تفاصيل الحجوزات (${br.details.length})</div>
        <table><thead><tr><th>الاسم</th><th>الملعب</th><th>الفترة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead>
        <tbody>${br.details.slice(0, 100).map(b => `<tr><td>${b.customer_name}</td><td>${getCourtName(b.court_id)}</td><td>${getPeriodName(b.period_number)}</td><td>${b.booking_date}</td><td>${b.final_price.toLocaleString('ar-SA')} ر.س</td><td>${STATUS_AR[b.status]??b.status}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="footer">تم الإنشاء بواسطة النظام الداخلي · ${new Date().toLocaleString('ar-SA')}</div>
    </div>`
    await buildSectionPDF(html, `${centerName}-حجوزات-${filter.from}-${filter.to}.pdf`)
  }

  async function exportCustomersPDF() {
    if (!data) return
    const { customers } = data
    const html = `<style>${PDF_CSS}</style>
    <div class="pdf-report">
      <div class="pdf-header">
        <h1>${centerName}</h1>
        <p>تقرير العملاء · ${filter.from} ← ${filter.to}</p>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">👥 ملخص العملاء</div>
        <div class="pdf-stats">
          <div class="pdf-stat"><div class="pdf-stat-val">${customers.total_unique}</div><div class="pdf-stat-lbl">إجمالي العملاء</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${customers.new_customers}</div><div class="pdf-stat-lbl">عملاء جدد</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${customers.repeat_customers}</div><div class="pdf-stat-lbl">متكررون</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${customers.repeat_rate}%</div><div class="pdf-stat-lbl">معدل التكرار</div></div>
        </div>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">🏆 أفضل العملاء</div>
        <table><thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>الحجوزات</th><th>الإيرادات</th></tr></thead>
        <tbody>${customers.top_list.slice(0, 30).map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.phone}</td><td>${c.count}</td><td>${c.revenue.toLocaleString('ar-SA')} ر.س</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="footer">تم الإنشاء بواسطة النظام الداخلي · ${new Date().toLocaleString('ar-SA')}</div>
    </div>`
    await buildSectionPDF(html, `${centerName}-عملاء-${filter.from}-${filter.to}.pdf`)
  }

  async function exportCodesPDF() {
    if (!data) return
    const { codes } = data
    const fmt = (n: number) => n.toLocaleString('ar-SA') + ' ر.س'
    const html = `<style>${PDF_CSS}</style>
    <div class="pdf-report">
      <div class="pdf-header">
        <h1>${centerName}</h1>
        <p>تقرير أكواد الخصم · ${filter.from} ← ${filter.to}</p>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">🏷️ ملخص الأكواد</div>
        <div class="pdf-stats">
          <div class="pdf-stat"><div class="pdf-stat-val">${codes.unique_codes_used}</div><div class="pdf-stat-lbl">أكواد مستخدمة</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${codes.total_uses}</div><div class="pdf-stat-lbl">إجمالي الاستخدامات</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${fmt(codes.total_discount)}</div><div class="pdf-stat-lbl">إجمالي الخصومات</div></div>
          <div class="pdf-stat"><div class="pdf-stat-val">${codes.usage_rate}%</div><div class="pdf-stat-lbl">نسبة الاستخدام</div></div>
        </div>
      </div>
      <div class="pdf-section">
        <div class="pdf-section-title">📋 تفاصيل الأكواد</div>
        <table><thead><tr><th>الكود</th><th>الاستخدامات</th><th>الحد الأقصى</th><th>إجمالي الخصم</th><th>إجمالي الإيرادات</th><th>الحالة</th></tr></thead>
        <tbody>${codes.details.map(c => `<tr><td><strong>${c.code}</strong></td><td>${c.count}</td><td>${c.max_uses ?? '∞'}</td><td>${fmt(c.total_discount)}</td><td>${fmt(c.total_revenue)}</td><td>${c.is_active ? 'نشط' : 'غير نشط'}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="footer">تم الإنشاء بواسطة النظام الداخلي · ${new Date().toLocaleString('ar-SA')}</div>
    </div>`
    await buildSectionPDF(html, `${centerName}-أكواد-${filter.from}-${filter.to}.pdf`)
  }

  async function exportAllPDF() {
    if (!data) return
    // الشامل يصدر كل الأقسام = يستخدم PDF المالي + الحجوزات
    await exportFinancialPDF()
    await exportBookingsPDF()
  }

  // ═══════════════════════════════════════════════════════════
  // دوال Excel
  // ═══════════════════════════════════════════════════════════
  const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
  const HEADER_FONT = { bold: true, color: { argb: 'FFC8FF3E' }, size: 11, name: 'Tahoma' }
  const STATUS_AR: Record<string, string> = { confirmed:'مؤكد',pending:'بانتظار',uploaded:'قيد المراجعة',rejected:'مرفوض',cancelled:'ملغى',expired:'منتهي' }

  async function exportFinancialExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); wb.creator = centerName
    // Sheet 1: ملخص مالي
    const ws = wb.addWorksheet('الملخص المالي')
    ws.columns = [{ header:'البند', key:'label', width:28 }, { header:'القيمة', key:'value', width:20 }]
    ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
    ws.addRow({ label:'الإيرادات الصافية', value:data.kpis.total_revenue })
    ws.addRow({ label:'الخصومات', value:data.kpis.total_discount })
    ws.addRow({ label:'إيرادات المياه', value:data.kpis.water_revenue })
    ws.addRow({ label:'متوسط قيمة الحجز', value:data.kpis.avg_booking_value })
    ws.addRow({})
    data.financial.by_court.forEach(c => ws.addRow({ label:c.name, value:c.revenue }))
    // Sheet 2: تفاصيل مالية
    const ws2 = wb.addWorksheet('التفاصيل المالية')
    ws2.columns = [
      { header:'التاريخ', key:'date', width:14 }, { header:'الملعب', key:'court', width:18 },
      { header:'الاسم', key:'name', width:22 }, { header:'الجوال', key:'phone', width:16 },
      { header:'الكود', key:'code', width:12 }, { header:'المياه', key:'water', width:10 },
      { header:'المبلغ الأصلي', key:'base', width:14 }, { header:'الخصم', key:'disc', width:12 },
      { header:'المبلغ النهائي', key:'final', width:14 },
    ]
    ws2.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
    data.bookings_report.details.filter(b => b.status === 'confirmed').forEach(b => {
      ws2.addRow({ date:b.booking_date, court:getCourtName(b.court_id), name:b.customer_name,
        phone:b.customer_phone, code:b.code_used??'', water:b.water_quantity??0,
        base:b.base_price, disc:b.discount_amount, final:b.final_price })
    })
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${centerName}-مالي-${filter.from}-${filter.to}.xlsx`)
  }

  async function exportBookingsExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); wb.creator = centerName
    const ws = wb.addWorksheet('جميع الحجوزات')
    ws.columns = [
      { header:'التاريخ', key:'date', width:14 }, { header:'الملعب', key:'court', width:18 },
      { header:'الفترة', key:'period', width:10 }, { header:'الاسم', key:'name', width:22 },
      { header:'الجوال', key:'phone', width:16 }, { header:'الحالة', key:'status', width:14 },
      { header:'المصدر', key:'src', width:10 }, { header:'المبلغ', key:'final', width:14 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
    data.bookings_report.details.forEach(b => {
      ws.addRow({ date:b.booking_date, court:getCourtName(b.court_id),
        period:getPeriodName(b.period_number), name:b.customer_name, phone:b.customer_phone,
        status:STATUS_AR[b.status]??b.status, src:b.is_manual?'يدوي':'أونلاين', final:b.final_price })
    })
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${centerName}-حجوزات-${filter.from}-${filter.to}.xlsx`)
  }

  async function exportCustomersExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); wb.creator = centerName
    const ws = wb.addWorksheet('العملاء')
    ws.columns = [
      { header:'#', key:'rank', width:6 }, { header:'الاسم', key:'name', width:22 },
      { header:'الجوال', key:'phone', width:16 }, { header:'الحجوزات', key:'count', width:12 },
      { header:'الإيرادات', key:'rev', width:16 }, { header:'التصنيف', key:'cls', width:12 },
      { header:'أول حجز', key:'first', width:16 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
    data.customers.top_list.forEach((c, i) => {
      ws.addRow({ rank:i+1, name:c.name, phone:c.phone, count:c.count, rev:c.revenue,
        cls:c.classification??'',
        first:c.first_booking_at ? new Date(c.first_booking_at).toLocaleDateString('ar-SA') : '' })
    })
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${centerName}-عملاء-${filter.from}-${filter.to}.xlsx`)
  }

  async function exportCodesExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); wb.creator = centerName
    const ws = wb.addWorksheet('الأكواد')
    ws.columns = [
      { header:'الكود', key:'code', width:14 }, { header:'الاستخدامات', key:'count', width:14 },
      { header:'الحد الأقصى', key:'max', width:12 }, { header:'إجمالي الخصم', key:'disc', width:16 },
      { header:'إجمالي الإيرادات', key:'rev', width:16 }, { header:'الحالة', key:'active', width:10 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
    data.codes.details.forEach(c => {
      ws.addRow({ code:c.code, count:c.count, max:c.max_uses??'غير محدود',
        disc:c.total_discount, rev:c.total_revenue, active:c.is_active?'نشط':'غير نشط' })
    })
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${centerName}-أكواد-${filter.from}-${filter.to}.xlsx`)
  }

  async function exportAllExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); wb.creator = centerName; wb.created = new Date()
    const styleRow = (ws: InstanceType<typeof ExcelJS.Workbook>['worksheets'][0]) => {
      ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { horizontal:'right', vertical:'middle' } })
      ws.getRow(1).height = 28
    }
    // Sheet 1: ملخص
    const ws1 = wb.addWorksheet('ملخص عام')
    ws1.columns = [{ header:'البند', key:'label', width:28 }, { header:'القيمة', key:'value', width:20 }]
    styleRow(ws1)
    ws1.addRow({ label:'الإيرادات الصافية', value:data.kpis.total_revenue })
    ws1.addRow({ label:'الخصومات الكلية', value:data.kpis.total_discount })
    ws1.addRow({ label:'إيرادات المياه', value:data.kpis.water_revenue })
    ws1.addRow({ label:'إجمالي الحجوزات', value:data.kpis.total_count })
    ws1.addRow({ label:'الحجوزات المؤكدة', value:data.kpis.confirmed_count })
    ws1.addRow({ label:'متوسط قيمة الحجز', value:data.kpis.avg_booking_value })
    ws1.addRow({ label:'نسبة الإشغال', value:`${data.operations.occupancy_rate}%` })
    // Sheet 2: الحجوزات
    const ws2 = wb.addWorksheet('الحجوزات')
    ws2.columns = [
      { header:'التاريخ', key:'date', width:14 }, { header:'الملعب', key:'court', width:18 },
      { header:'الفترة', key:'period', width:10 }, { header:'الاسم', key:'name', width:22 },
      { header:'الجوال', key:'phone', width:16 }, { header:'الكود', key:'code', width:12 },
      { header:'المياه', key:'water', width:8 }, { header:'الخصم', key:'disc', width:12 },
      { header:'المبلغ', key:'final', width:14 }, { header:'الحالة', key:'status', width:14 },
      { header:'المصدر', key:'src', width:10 },
    ]
    styleRow(ws2)
    data.bookings_report.details.forEach(b => {
      ws2.addRow({ date:b.booking_date, court:getCourtName(b.court_id), period:getPeriodName(b.period_number),
        name:b.customer_name, phone:b.customer_phone, code:b.code_used??'', water:b.water_quantity??0,
        disc:b.discount_amount, final:b.final_price, status:STATUS_AR[b.status]??b.status, src:b.is_manual?'يدوي':'أونلاين' })
    })
    // Sheet 3: العملاء
    const ws3 = wb.addWorksheet('العملاء')
    ws3.columns = [
      { header:'#', key:'rank', width:6 }, { header:'الاسم', key:'name', width:22 },
      { header:'الجوال', key:'phone', width:16 }, { header:'الحجوزات', key:'count', width:12 },
      { header:'الإيرادات', key:'rev', width:16 }, { header:'التصنيف', key:'cls', width:12 },
    ]
    styleRow(ws3)
    data.customers.top_list.forEach((c, i) => {
      ws3.addRow({ rank:i+1, name:c.name, phone:c.phone, count:c.count, rev:c.revenue, cls:c.classification??'' })
    })
    // Sheet 4: الأكواد
    const ws4 = wb.addWorksheet('الأكواد')
    ws4.columns = [
      { header:'الكود', key:'code', width:14 }, { header:'الاستخدامات', key:'count', width:14 },
      { header:'إجمالي الخصم', key:'disc', width:16 }, { header:'إجمالي الإيرادات', key:'rev', width:16 },
    ]
    styleRow(ws4)
    data.codes.details.forEach(c => ws4.addRow({ code:c.code, count:c.count, disc:c.total_discount, rev:c.total_revenue }))

    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${centerName}-تقرير-شامل-${filter.from}-${filter.to}.xlsx`)
  }

  // ═══════════════════════════════════════════════════════════
  // WhatsApp — مخصص لكل قسم
  // ═══════════════════════════════════════════════════════════
  function shareFinancialWhatsApp() {
    if (!data) return
    const { kpis, financial } = data
    const lines = [
      `💰 *التقرير المالي — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`, '',
      `✅ مؤكدة: ${kpis.confirmed_count}`,
      `💰 الإيرادات: ${formatAmount(kpis.total_revenue)}`,
      `🏷️ الخصومات: ${formatAmount(kpis.total_discount)}`,
      `💧 المياه: ${formatAmount(kpis.water_revenue)}`,
      `📊 متوسط: ${formatAmount(kpis.avg_booking_value)}`, '',
      ...financial.by_court.map(c => `🏟️ ${c.name}: ${c.count} حجز — ${formatAmount(c.revenue)}`),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  function shareBookingsWhatsApp() {
    if (!data) return
    const { kpis, bookings_report: br } = data
    const lines = [
      `📋 *تقرير الحجوزات — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`, '',
      `📋 الإجمالي: ${br.total}`,
      `✅ مؤكدة: ${kpis.confirmed_count}`,
      `❌ نسبة الإلغاء: ${kpis.cancellation_rate}%`, '',
      `🌐 أونلاين: ${br.online_count} | ✍️ يدوي: ${br.manual_count}`,
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  function shareCustomersWhatsApp() {
    if (!data) return
    const { customers } = data
    const lines = [
      `👥 *تقرير العملاء — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`, '',
      `إجمالي العملاء: ${customers.total_unique}`,
      `جدد: ${customers.new_customers}`,
      `متكررون: ${customers.repeat_customers}`,
      `معدل التكرار: ${customers.repeat_rate}%`, '',
      `⭐ أفضل 5 عملاء:`,
      ...customers.top_list.slice(0, 5).map((c, i) => `${i+1}. ${c.name} — ${c.count} حجز — ${formatAmount(c.revenue)}`),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  function shareCodesWhatsApp() {
    if (!data) return
    const { codes } = data
    const lines = [
      `🏷️ *تقرير الأكواد — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`, '',
      `أكواد مستخدمة: ${codes.unique_codes_used}`,
      `إجمالي الاستخدامات: ${codes.total_uses}`,
      `إجمالي الخصومات: ${formatAmount(codes.total_discount)}`,
      `نسبة الاستخدام: ${codes.usage_rate}%`, '',
      `🏆 أفضل 5 أكواد:`,
      ...codes.details.slice(0, 5).map((c, i) => `${i+1}. ${c.code} — ${c.count} استخدام — ${formatAmount(c.total_discount)}`),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // ═══════════════════════════════════════════════════════════
  // دوال PDF/Excel حسب النوع الحالي
  // ═══════════════════════════════════════════════════════════
  function currentPDF() {
    const map: Record<ReportType, () => void> = {
      all: exportAllPDF, financial: exportFinancialPDF,
      bookings: exportBookingsPDF, customers: exportCustomersPDF, codes: exportCodesPDF,
    }
    return map[reportType] ?? exportAllPDF
  }
  function currentExcel() {
    const map: Record<ReportType, () => void> = {
      all: exportAllExcel, financial: exportFinancialExcel,
      bookings: exportBookingsExcel, customers: exportCustomersExcel, codes: exportCodesExcel,
    }
    return map[reportType] ?? exportAllExcel
  }
  function currentWhatsApp() {
    const map: Record<ReportType, () => void> = {
      all: shareFinancialWhatsApp, financial: shareFinancialWhatsApp,
      bookings: shareBookingsWhatsApp, customers: shareCustomersWhatsApp, codes: shareCodesWhatsApp,
    }
    return map[reportType] ?? shareFinancialWhatsApp
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="reports-page">
      {/* ─── الرأس ─── */}
      <div className="rpt-header">
        <div>
          <h1 className="rpt-title">📈 التقارير</h1>
          <p className="rpt-sub">
            {data
              ? `${data.meta.from} ← ${data.meta.to} · آخر تحديث: ${new Date(data.meta.generated_at).toLocaleTimeString('ar-SA')}`
              : 'جاري التحميل…'}
          </p>
        </div>
        {/* أزرار التصدير الشاملة — تصدر التقرير الحالي */}
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
          <button
            className="sec-btn sec-btn-pdf"
            onClick={currentPDF()}
            disabled={!data || loading}
          >📄 PDF</button>
          <button
            className="sec-btn sec-btn-excel"
            onClick={currentExcel()}
            disabled={!data || loading}
          >📊 Excel</button>
          <button
            className="sec-btn sec-btn-wa"
            onClick={currentWhatsApp()}
            disabled={!data || loading}
          >💬 واتساب</button>
        </div>
      </div>

      {/* ─── شريط نوع التقرير ─── */}
      <div className="report-type-bar">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.id}
            className={`report-type-btn${reportType === rt.id ? ' active' : ''}`}
            onClick={() => setReportType(rt.id)}
          >
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* ─── الفلتر ─── */}
      <FilterBar filter={filter} loading={loading} onChange={setFilter} />

      {/* ─── حالات التحميل ─── */}
      {loading && !data && <LoadingState />}
      {error && !loading && <ErrorState error={error} onRetry={() => fetchData(filter)} />}

      {/* ─── المحتوى ─── */}
      {data && (
        <>
          {/* KPIs — تظهر دائماً */}
          <KpiStrip kpis={data.kpis} loading={loading} />

          {/* الشامل */}
          {(reportType === 'all') && (
            <>
              <Heatmap data={data.heatmap} />
              <FinancialSection
                financial={data.financial} kpis={data.kpis} details={data.bookings_report.details}
                from={filter.from} to={filter.to} centerName={centerName}
                waterPrice={data.meta.water_price_per_carton}
                onExportPDF={exportFinancialPDF} onExportExcel={exportFinancialExcel} onWhatsApp={shareFinancialWhatsApp}
              />
              <BookingsSection
                bookings={data.bookings_report} kpis={data.kpis}
                onExportPDF={exportBookingsPDF} onExportExcel={exportBookingsExcel} onWhatsApp={shareBookingsWhatsApp}
              />
              <CustomersSection
                customers={data.customers} from={filter.from} to={filter.to}
                onExportPDF={exportCustomersPDF} onExportExcel={exportCustomersExcel} onWhatsApp={shareCustomersWhatsApp}
              />
              <CodesSection
                codes={data.codes}
                onExportPDF={exportCodesPDF} onExportExcel={exportCodesExcel} onWhatsApp={shareCodesWhatsApp}
              />
              <OperationsSection operations={data.operations} kpis={data.kpis} />
              <ExportAllBar onExportAllPDF={exportAllPDF} onExportAllExcel={exportAllExcel} loading={loading} />
            </>
          )}

          {/* مالي */}
          {reportType === 'financial' && (
            <FinancialSection
              financial={data.financial} kpis={data.kpis} details={data.bookings_report.details}
              from={filter.from} to={filter.to} centerName={centerName}
              waterPrice={data.meta.water_price_per_carton}
              onExportPDF={exportFinancialPDF} onExportExcel={exportFinancialExcel} onWhatsApp={shareFinancialWhatsApp}
            />
          )}

          {/* حجوزات */}
          {reportType === 'bookings' && (
            <>
              <Heatmap data={data.heatmap} />
              <BookingsSection
                bookings={data.bookings_report} kpis={data.kpis}
                onExportPDF={exportBookingsPDF} onExportExcel={exportBookingsExcel} onWhatsApp={shareBookingsWhatsApp}
              />
            </>
          )}

          {/* عملاء */}
          {reportType === 'customers' && (
            <CustomersSection
              customers={data.customers} from={filter.from} to={filter.to}
              onExportPDF={exportCustomersPDF} onExportExcel={exportCustomersExcel} onWhatsApp={shareCustomersWhatsApp}
            />
          )}

          {/* أكواد */}
          {reportType === 'codes' && (
            <CodesSection
              codes={data.codes}
              onExportPDF={exportCodesPDF} onExportExcel={exportCodesExcel} onWhatsApp={shareCodesWhatsApp}
            />
          )}
        </>
      )}
    </div>
  )
}
