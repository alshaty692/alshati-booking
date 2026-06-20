'use client'
// ============================================================
// صفحة التقارير — إعادة بناء كاملة
// مبدأ: الصفحة تعرض فقط — كل الحسابات في السيرفر
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

// ──────────────────────────────────────────────────────────────
// الحالة الافتراضية للفلتر
// ──────────────────────────────────────────────────────────────
function getInitialFilter(): FilterState {
  const { from, to } = getDateRange('month')
  return { preset: 'month', from, to, court: 'all', status: 'all' }
}

// ──────────────────────────────────────────────────────────────
// مكوّن التحميل
// ──────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'5rem', color:'#94a3b8' }}>
      <div className="spinner" style={{ width:'2.5rem', height:'2.5rem', borderWidth:'3px' }} />
      <p style={{ margin:0, fontFamily:'Tajawal,sans-serif' }}>جاري تحميل التقارير…</p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
      <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>⚠️</div>
      <p style={{ fontFamily:'Tajawal,sans-serif', margin:'0 0 1rem' }}>{error}</p>
      <button
        onClick={onRetry}
        style={{ padding:'0.5rem 1.25rem', borderRadius:'0.5rem', background:'#2D5C4E', color:'#fff', border:'none', cursor:'pointer', fontFamily:'Tajawal,sans-serif', fontWeight:700 }}
      >
        إعادة المحاولة
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// الصفحة الرئيسية
// ──────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [filter,  setFilter]  = useState<FilterState>(getInitialFilter)
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})

  // جلب الإعدادات (اسم المنشأة)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setSettings(d.settings ?? {}))
      .catch(() => {})
  }, [])

  // جلب بيانات التقارير
  const fetchData = useCallback(async (f: FilterState) => {
    if (!f.from || !f.to) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        from:   f.from,
        to:     f.to,
        court:  f.court,
        status: f.status,
      })
      const res  = await fetch(`/api/admin/reports?${params}`)
      if (!res.ok) throw new Error(`خطأ ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل جلب التقارير')
    } finally {
      setLoading(false)
    }
  }, [])

  // إعادة الجلب عند تغيير الفلتر
  useEffect(() => {
    fetchData(filter)
  }, [filter, fetchData])

  const centerName = settings.facility_name ?? 'مركز حي الشاطئ'

  // ──────────────────────────────────────────────────────────────
  // دوال التصدير — القسم المالي
  // ──────────────────────────────────────────────────────────────
  async function exportFinancialPDF() {
    if (!data) return
    const { generateReport } = await import('@/lib/pdf-generator')
    await generateReport({
      centerName,
      from: filter.from,
      to:   filter.to,
      summary: {
        total_bookings:     data.kpis.total_count,
        confirmed_bookings: data.kpis.confirmed_count,
        total_revenue:      data.kpis.total_revenue,
        total_discount:     data.kpis.total_discount,
        avg_booking_value:  data.kpis.avg_booking_value,
        status_count:       data.financial.status_breakdown as unknown as Record<string, number>,
      },
      revenueByCourt: data.financial.by_court.map(c => ({
        court:   c.name,
        count:   c.count,
        revenue: c.revenue,
      })),
      customers: data.customers.top_list,
      heatmap:   data.heatmap.all,
      codeStats: data.codes.details.map(c => ({ code: c.code, count: c.count, discount: c.total_discount, revenue: c.total_revenue })),
      bookings:  data.bookings_report.details.map(b => ({
        customer_name:    b.customer_name,
        customer_phone:   b.customer_phone,
        court:            getCourtName(b.court_id),
        period:           getPeriodName(b.period_number),
        booking_date:     b.booking_date,
        final_price:      b.final_price,
        discount_amount:  b.discount_amount,
        status:           b.status,
      })),
    })
  }

  async function exportFinancialExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = centerName

    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
    const headerFont = { bold: true, color: { argb: 'FFC9A96E' }, size: 11, name: 'Tahoma' }

    // Sheet 1: ملخص مالي
    const ws = wb.addWorksheet('الملخص المالي')
    ws.columns = [
      { header: 'البند',  key: 'label',  width: 25 },
      { header: 'القيمة', key: 'value',  width: 20 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont })
    ws.addRow({ label: 'الإيرادات الصافية',  value: data.kpis.total_revenue })
    ws.addRow({ label: 'الخصومات',           value: data.kpis.total_discount })
    ws.addRow({ label: 'إيرادات المياه',      value: data.kpis.water_revenue })
    ws.addRow({ label: 'متوسط قيمة الحجز',   value: data.kpis.avg_booking_value })
    ws.addRow({ label: 'المؤكدة',             value: data.kpis.confirmed_count })
    ws.addRow({})
    data.financial.by_court.forEach(c => {
      ws.addRow({ label: c.name, value: c.revenue })
    })

    // Sheet 2: الحجوزات المؤكدة
    const ws2 = wb.addWorksheet('الحجوزات المؤكدة')
    ws2.columns = [
      { header: 'التاريخ',        key: 'date',     width: 14 },
      { header: 'الملعب',         key: 'court',    width: 18 },
      { header: 'الفترة',         key: 'period',   width: 10 },
      { header: 'الاسم',          key: 'name',     width: 22 },
      { header: 'الجوال',         key: 'phone',    width: 16 },
      { header: 'الكود',          key: 'code',     width: 12 },
      { header: 'المياه',         key: 'water',    width: 10 },
      { header: 'الخصم',          key: 'discount', width: 12 },
      { header: 'المبلغ النهائي', key: 'final',    width: 14 },
    ]
    ws2.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont })
    data.bookings_report.details.filter(b => b.status === 'confirmed').forEach(b => {
      ws2.addRow({
        date:     b.booking_date,
        court:    getCourtName(b.court_id),
        period:   getPeriodName(b.period_number),
        name:     b.customer_name,
        phone:    b.customer_phone,
        code:     b.code_used ?? '',
        water:    b.water_quantity ?? 0,
        discount: b.discount_amount,
        final:    b.final_price,
      })
    })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${centerName}-مالي-${filter.from}-${filter.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function shareFinancialWhatsApp() {
    if (!data) return
    const lines = [
      `💰 *التقرير المالي — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`,
      '',
      `✅ الحجوزات المؤكدة: ${data.kpis.confirmed_count}`,
      `💰 الإيرادات: ${formatAmount(data.kpis.total_revenue)}`,
      `🏷️ الخصومات: ${formatAmount(data.kpis.total_discount)}`,
      `💧 إيرادات المياه: ${formatAmount(data.kpis.water_revenue)}`,
      `📊 متوسط الحجز: ${formatAmount(data.kpis.avg_booking_value)}`,
      '',
      ...data.financial.by_court.map(c =>
        `🏟️ ${c.name}: ${c.count} حجز — ${formatAmount(c.revenue)}`
      ),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // ──────────────────────────────────────────────────────────────
  // دوال التصدير — قسم الحجوزات
  // ──────────────────────────────────────────────────────────────
  function shareBookingsWhatsApp() {
    if (!data) return
    const { kpis, bookings_report: br } = data
    const lines = [
      `📋 *تقرير الحجوزات — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`,
      '',
      `📋 الإجمالي: ${br.total}`,
      `✅ مؤكدة: ${kpis.confirmed_count}`,
      `❌ نسبة الإلغاء: ${kpis.cancellation_rate}%`,
      '',
      `⏰ الفترات:`,
      `   5–7م: ${br.by_period['1'] ?? 0}`,
      `   7–9م: ${br.by_period['2'] ?? 0}`,
      `   9–11م: ${br.by_period['3'] ?? 0}`,
      '',
      `🌐 أونلاين: ${br.online_count} | ✍️ يدوي: ${br.manual_count}`,
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  async function exportBookingsExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb  = new ExcelJS.Workbook()
    wb.creator = centerName
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
    const headerFont = { bold: true, color: { argb: 'FFC9A96E' }, size: 11, name: 'Tahoma' }

    const ws = wb.addWorksheet('جميع الحجوزات')
    ws.columns = [
      { header: 'التاريخ',  key: 'date',    width: 14 },
      { header: 'الملعب',   key: 'court',   width: 18 },
      { header: 'الفترة',   key: 'period',  width: 10 },
      { header: 'الاسم',    key: 'name',    width: 22 },
      { header: 'الجوال',   key: 'phone',   width: 16 },
      { header: 'الحالة',   key: 'status',  width: 14 },
      { header: 'يدوي',     key: 'manual',  width: 8  },
      { header: 'المبلغ',   key: 'final',   width: 14 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont })

    const STATUS_AR: Record<string, string> = {
      confirmed:'مؤكد', pending:'بانتظار', uploaded:'قيد المراجعة',
      rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي',
    }
    data.bookings_report.details.forEach(b => {
      ws.addRow({
        date:   b.booking_date,
        court:  getCourtName(b.court_id),
        period: getPeriodName(b.period_number),
        name:   b.customer_name,
        phone:  b.customer_phone,
        status: STATUS_AR[b.status] ?? b.status,
        manual: b.is_manual ? 'يدوي' : 'أونلاين',
        final:  b.final_price,
      })
    })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${centerName}-حجوزات-${filter.from}-${filter.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ──────────────────────────────────────────────────────────────
  // دوال التصدير — قسم العملاء
  // ──────────────────────────────────────────────────────────────
  function shareCustomersWhatsApp() {
    if (!data) return
    const { customers } = data
    const lines = [
      `👥 *تقرير العملاء — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`,
      '',
      `إجمالي العملاء: ${customers.total_unique}`,
      `جدد حقيقيون: ${customers.new_customers}`,
      `متكررون: ${customers.repeat_customers}`,
      `معدل التكرار: ${customers.repeat_rate}%`,
      '',
      `⭐ أفضل 5 عملاء:`,
      ...customers.top_list.slice(0, 5).map((c, i) =>
        `${i + 1}. ${c.name} — ${c.count} حجز — ${formatAmount(c.revenue)}`
      ),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  async function exportCustomersExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb  = new ExcelJS.Workbook()
    wb.creator = centerName
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
    const headerFont = { bold: true, color: { argb: 'FFC9A96E' }, size: 11, name: 'Tahoma' }

    const ws = wb.addWorksheet('العملاء')
    ws.columns = [
      { header: '#',              key: 'rank',   width: 6  },
      { header: 'الاسم',          key: 'name',   width: 22 },
      { header: 'الجوال',         key: 'phone',  width: 16 },
      { header: 'الحجوزات',       key: 'count',  width: 12 },
      { header: 'الإيرادات',      key: 'rev',    width: 16 },
      { header: 'التصنيف',        key: 'cls',    width: 12 },
      { header: 'أول حجز',        key: 'first',  width: 16 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont })
    data.customers.top_list.forEach((c, i) => {
      ws.addRow({
        rank:  i + 1,
        name:  c.name,
        phone: c.phone,
        count: c.count,
        rev:   c.revenue,
        cls:   c.classification ?? '',
        first: c.first_booking_at ? new Date(c.first_booking_at).toLocaleDateString('ar-SA') : '',
      })
    })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${centerName}-عملاء-${filter.from}-${filter.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ──────────────────────────────────────────────────────────────
  // دوال التصدير — قسم الأكواد
  // ──────────────────────────────────────────────────────────────
  function shareCodesWhatsApp() {
    if (!data) return
    const { codes } = data
    const lines = [
      `🏷️ *تقرير الأكواد — ${centerName}*`,
      `📅 ${filter.from} ← ${filter.to}`,
      '',
      `أكواد مستخدمة: ${codes.unique_codes_used}`,
      `إجمالي استخدامات: ${codes.total_uses}`,
      `إجمالي الخصومات: ${formatAmount(codes.total_discount)}`,
      `نسبة الاستخدام: ${codes.usage_rate}%`,
      '',
      `🏆 أفضل 5 أكواد:`,
      ...codes.details.slice(0, 5).map((c, i) =>
        `${i + 1}. ${c.code} — ${c.count} استخدام — خصم ${formatAmount(c.total_discount)}`
      ),
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  async function exportCodesExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb  = new ExcelJS.Workbook()
    wb.creator = centerName
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
    const headerFont = { bold: true, color: { argb: 'FFC9A96E' }, size: 11, name: 'Tahoma' }

    const ws = wb.addWorksheet('الأكواد')
    ws.columns = [
      { header: 'الكود',              key: 'code',    width: 14 },
      { header: 'الاستخدامات',        key: 'count',   width: 14 },
      { header: 'الحد الأقصى',        key: 'max',     width: 12 },
      { header: 'إجمالي الخصم',       key: 'disc',    width: 16 },
      { header: 'إجمالي الإيرادات',   key: 'rev',     width: 16 },
      { header: 'الحالة',              key: 'active',  width: 10 },
    ]
    ws.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont })
    data.codes.details.forEach(c => {
      ws.addRow({
        code:   c.code,
        count:  c.count,
        max:    c.max_uses ?? 'غير محدود',
        disc:   c.total_discount,
        rev:    c.total_revenue,
        active: c.is_active ? 'نشط' : 'غير نشط',
      })
    })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${centerName}-أكواد-${filter.from}-${filter.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ──────────────────────────────────────────────────────────────
  // التصدير الشامل
  // ──────────────────────────────────────────────────────────────
  async function exportAllExcel() {
    if (!data) return
    const ExcelJS = (await import('exceljs')).default
    const wb  = new ExcelJS.Workbook()
    wb.creator = centerName
    wb.created = new Date()

    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A3B' } }
    const headerFont = { bold: true, color: { argb: 'FFC9A96E' }, size: 11, name: 'Tahoma' }
    const styleRow   = (ws: InstanceType<typeof ExcelJS.Workbook>['worksheets'][0]) => {
      ws.getRow(1).eachCell(c => { c.fill = headerFill; c.font = headerFont; c.alignment = { horizontal: 'right', vertical: 'middle' } })
      ws.getRow(1).height = 28
    }

    // Sheet 1: ملخص عام
    const ws1 = wb.addWorksheet('ملخص عام')
    ws1.columns = [{ header: 'البند', key: 'label', width: 28 }, { header: 'القيمة', key: 'value', width: 20 }]
    styleRow(ws1)
    ws1.addRow({ label: 'الإيرادات الصافية',  value: data.kpis.total_revenue })
    ws1.addRow({ label: 'الخصومات الكلية',    value: data.kpis.total_discount })
    ws1.addRow({ label: 'إيرادات المياه',      value: data.kpis.water_revenue })
    ws1.addRow({ label: 'إجمالي الحجوزات',    value: data.kpis.total_count })
    ws1.addRow({ label: 'الحجوزات المؤكدة',   value: data.kpis.confirmed_count })
    ws1.addRow({ label: 'متوسط قيمة الحجز',   value: data.kpis.avg_booking_value })
    ws1.addRow({ label: 'نسبة الإشغال',        value: `${data.operations.occupancy_rate}%` })

    // Sheet 2: جميع الحجوزات
    const ws2 = wb.addWorksheet('الحجوزات')
    ws2.columns = [
      { header: 'التاريخ',  key: 'date',    width: 14 },
      { header: 'الملعب',   key: 'court',   width: 18 },
      { header: 'الفترة',   key: 'period',  width: 10 },
      { header: 'الاسم',    key: 'name',    width: 22 },
      { header: 'الجوال',   key: 'phone',   width: 16 },
      { header: 'الكود',    key: 'code',    width: 12 },
      { header: 'المياه',   key: 'water',   width: 8  },
      { header: 'الخصم',    key: 'disc',    width: 12 },
      { header: 'المبلغ',   key: 'final',   width: 14 },
      { header: 'الحالة',   key: 'status',  width: 14 },
      { header: 'المصدر',   key: 'src',     width: 10 },
    ]
    styleRow(ws2)
    const STATUS_AR: Record<string,string> = {
      confirmed:'مؤكد',pending:'بانتظار',uploaded:'قيد المراجعة',rejected:'مرفوض',cancelled:'ملغى',expired:'منتهي',
    }
    data.bookings_report.details.forEach(b => {
      ws2.addRow({
        date:   b.booking_date,
        court:  getCourtName(b.court_id),
        period: getPeriodName(b.period_number),
        name:   b.customer_name,
        phone:  b.customer_phone,
        code:   b.code_used ?? '',
        water:  b.water_quantity ?? 0,
        disc:   b.discount_amount,
        final:  b.final_price,
        status: STATUS_AR[b.status] ?? b.status,
        src:    b.is_manual ? 'يدوي' : 'أونلاين',
      })
    })

    // Sheet 3: العملاء
    const ws3 = wb.addWorksheet('العملاء')
    ws3.columns = [
      { header: '#',          key: 'rank',  width: 6  },
      { header: 'الاسم',      key: 'name',  width: 22 },
      { header: 'الجوال',     key: 'phone', width: 16 },
      { header: 'الحجوزات',   key: 'count', width: 12 },
      { header: 'الإيرادات',  key: 'rev',   width: 16 },
      { header: 'التصنيف',    key: 'cls',   width: 12 },
    ]
    styleRow(ws3)
    data.customers.top_list.forEach((c, i) => {
      ws3.addRow({ rank: i+1, name: c.name, phone: c.phone, count: c.count, rev: c.revenue, cls: c.classification ?? '' })
    })

    // Sheet 4: الأكواد
    const ws4 = wb.addWorksheet('الأكواد')
    ws4.columns = [
      { header: 'الكود',        key: 'code',  width: 14 },
      { header: 'الاستخدامات',  key: 'count', width: 14 },
      { header: 'إجمالي الخصم', key: 'disc',  width: 16 },
      { header: 'إجمالي الإير', key: 'rev',   width: 16 },
    ]
    styleRow(ws4)
    data.codes.details.forEach(c => {
      ws4.addRow({ code: c.code, count: c.count, disc: c.total_discount, rev: c.total_revenue })
    })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${centerName}-تقرير-شامل-${filter.from}-${filter.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportAllPDF() {
    if (!data) return
    await exportFinancialPDF()
  }

  // ──────────────────────────────────────────────────────────────
  // الـ UI
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="reports-page">
      {/* الرأس */}
      <div className="rpt-header">
        <div>
          <h1 className="rpt-title">التقارير</h1>
          <p className="rpt-sub">
            {data
              ? `${data.meta.from} ← ${data.meta.to} · آخر تحديث: ${new Date(data.meta.generated_at).toLocaleTimeString('ar-SA')}`
              : 'جاري التحميل…'}
          </p>
        </div>
      </div>

      {/* الفلتر الموحّد */}
      <FilterBar
        filter={filter}
        loading={loading}
        onChange={setFilter}
      />

      {/* حالة التحميل / الخطأ */}
      {loading && !data && <LoadingState />}
      {error && !loading && <ErrorState error={error} onRetry={() => fetchData(filter)} />}

      {/* المحتوى */}
      {data && (
        <>
          {/* KPIs */}
          <KpiStrip kpis={data.kpis} loading={loading} />

          {/* Heatmap */}
          <Heatmap data={data.heatmap} />

          {/* القسم المالي */}
          <FinancialSection
            financial={data.financial}
            kpis={data.kpis}
            details={data.bookings_report.details}
            from={filter.from}
            to={filter.to}
            centerName={centerName}
            waterPrice={data.meta.water_price_per_carton}
            onExportPDF={exportFinancialPDF}
            onExportExcel={exportFinancialExcel}
            onWhatsApp={shareFinancialWhatsApp}
          />

          {/* قسم الحجوزات */}
          <BookingsSection
            bookings={data.bookings_report}
            kpis={data.kpis}
            onExportPDF={exportFinancialPDF}
            onExportExcel={exportBookingsExcel}
            onWhatsApp={shareBookingsWhatsApp}
          />

          {/* قسم العملاء */}
          <CustomersSection
            customers={data.customers}
            from={filter.from}
            to={filter.to}
            onExportPDF={exportFinancialPDF}
            onExportExcel={exportCustomersExcel}
            onWhatsApp={shareCustomersWhatsApp}
          />

          {/* قسم الأكواد */}
          <CodesSection
            codes={data.codes}
            onExportPDF={exportFinancialPDF}
            onExportExcel={exportCodesExcel}
            onWhatsApp={shareCodesWhatsApp}
          />

          {/* قسم الأداء التشغيلي */}
          <OperationsSection
            operations={data.operations}
            kpis={data.kpis}
          />

          {/* التصدير الشامل */}
          <ExportAllBar
            onExportAllPDF={exportAllPDF}
            onExportAllExcel={exportAllExcel}
            loading={loading}
          />
        </>
      )}

      {/* ══ CSS موحّد ══ */}
      <style>{`
        .reports-page { font-family:'Tajawal','IBM Plex Sans Arabic',sans-serif; }

        .rpt-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap; }
        .rpt-title  { font-size:1.6rem;font-weight:800;margin:0 0 0.2rem;color:#1B2A3B; }
        .rpt-sub    { color:#94a3b8;font-size:0.82rem;margin:0; }

        /* بطاقات عامة */
        .rpt-card       { background:#fff;border-radius:0.875rem;border:1px solid #e2e8f0;padding:1.25rem; }
        .rpt-card-title { font-size:0.95rem;font-weight:800;color:#1B2A3B;margin:0 0 1rem; }

        /* شبكات */
        .rpt-grid-2 { display:grid;grid-template-columns:1fr;gap:1.25rem; }
        .rpt-grid-3 { display:grid;grid-template-columns:1fr;gap:1.25rem; }
        @media (min-width:700px) {
          .rpt-grid-2 { grid-template-columns:1fr 1fr; }
          .rpt-grid-3 { grid-template-columns:repeat(3,1fr); }
        }

        /* صف تفصيلي */
        .rpt-detail-row {
          display:flex;align-items:center;justify-content:space-between;
          padding:0.55rem 0;border-bottom:1px solid #f1f5f9;font-size:0.875rem;
        }
        .rpt-detail-row:last-child { border-bottom:none; }

        /* أقسام */
        .report-section { margin-bottom:1.5rem; }
        .section-header {
          display:flex;align-items:center;justify-content:space-between;
          flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;
        }
        .section-title { font-size:1.15rem;font-weight:800;color:#1B2A3B;margin:0; }
        .section-actions { display:flex;gap:0.5rem;flex-wrap:wrap; }

        /* أزرار الأقسام */
        .sec-btn {
          display:inline-flex;align-items:center;gap:0.35rem;
          padding:0.4rem 0.875rem;border-radius:0.5rem;font-size:0.8rem;
          font-weight:700;cursor:pointer;border:none;
          font-family:'Tajawal',sans-serif;transition:all 0.15s;white-space:nowrap;
        }
        .sec-btn:disabled { opacity:0.5;cursor:not-allowed; }
        .sec-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.15); }
        .sec-btn-pdf   { background:#1B2A3B;color:#C9A96E; }
        .sec-btn-excel { background:#2D5C4E;color:#fff; }
        .sec-btn-wa    { background:#25D366;color:#fff; }

        /* جداول */
        .table-container { overflow-x:auto;-webkit-overflow-scrolling:touch; }
        .table { width:100%;border-collapse:collapse;font-size:0.85rem; }
        .table th {
          background:#1B2A3B;color:#C9A96E;padding:0.6rem 0.75rem;
          text-align:right;font-size:0.8rem;white-space:nowrap;
        }
        .table td { padding:0.6rem 0.75rem;border-bottom:1px solid #f1f5f9; }
        .table tbody tr:hover { background:#f8fafc; }

        /* شارات */
        .badge { display:inline-block;padding:0.15rem 0.5rem;border-radius:1rem;font-size:0.72rem;font-weight:700; }
        .badge-confirmed { background:#dcfce7;color:#16a34a; }

        @media (max-width:700px) {
          .section-header { flex-direction:column;align-items:flex-start; }
          .section-actions { width:100%; }
          .sec-btn { flex:1;justify-content:center; }
        }
      `}</style>
    </div>
  )
}
