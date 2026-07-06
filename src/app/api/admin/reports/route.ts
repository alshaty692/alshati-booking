// ============================================================
// API Route — التقارير الموحّدة (إعادة بناء كاملة)
// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&court=all&status=all
//
// مبدأ أساسي: كل الحسابات هنا في السيرفر فقط
// الواجهة تعرض فقط — لا تُعيد حساب أي رقم
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'
import type {
  ReportData, ReportMeta, ReportKpis, ReportFinancial,
  ReportBookings, ReportCustomers, ReportCodes,
  ReportHeatmap, ReportOperations, HeatGrid, HeatCell,
  CourtFilter, StatusFilter, BookingRow
} from '@/types/reports'

// ──────────────────────────────────────────────────────────────
// مساعدات
// ──────────────────────────────────────────────────────────────
// أسماء الملاعب تُجلب ديناميكياً من settings في GET handler

function emptyHeatGrid(): HeatGrid {
  const g: HeatGrid = {}
  for (let d = 0; d <= 6; d++) {
    g[d] = {}
    for (let p = 1; p <= 3; p++) {
      g[d][p] = { booked: 0, total: 0, pct: 0 }
    }
  }
  return g
}

function buildHeatGrid(rows: BookingRow[], weeksCount: number, courtCount: number): HeatGrid {
  const g = emptyHeatGrid()
  rows.forEach(b => {
    const dow = new Date(b.booking_date + 'T00:00:00').getDay()
    const p   = b.period_number
    if (g[dow] && g[dow][p]) g[dow][p].booked++
  })
  // total = عدد الأسابيع × عدد الملاعب المفلترة فعلياً
  for (let d = 0; d <= 6; d++) {
    for (let p = 1; p <= 3; p++) {
      g[d][p].total = weeksCount * courtCount
      g[d][p].pct   = g[d][p].total > 0
        ? Math.round(g[d][p].booked / g[d][p].total * 100)
        : 0
    }
  }
  return g
}

// ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // 1. التحقق من الصلاحية — view_reports (admin/editor/viewer)
    const auth = await requirePermission('view_reports')
    if (!auth.ok) return auth.response

    // 2. قراءة الفلاتر من الـ URL
    const { searchParams } = new URL(request.url)
    const nowSA = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
    const fmtSA = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const today = fmtSA(nowSA)
    const defaultFrom = new Date(nowSA); defaultFrom.setDate(defaultFrom.getDate() - 29)
    const from   = searchParams.get('from')   ?? fmtSA(defaultFrom)
    const to     = searchParams.get('to')     ?? today
    const court  = (searchParams.get('court')  ?? 'all') as CourtFilter
    const status = (searchParams.get('status') ?? 'all') as StatusFilter

    const admin = createAdminClient()

    // 3. جلب الإعدادات (water_price_per_carton)
    const { data: settingsRows } = await admin
      .from('settings')
      .select('key,value')
    const settings: Record<string, string> = {}
    ;(settingsRows ?? []).forEach(s => { settings[s.key] = s.value })
    const waterPrice = parseFloat(settings['water_price_per_carton'] ?? '20') || 20

    // أسماء الملاعب من الإعدادات (مصدر وحيد للحقيقة)
    const COURT_NAMES: Record<string, string> = {
      football:   settings['venue_1_name'] || 'كرة القدم',
      volleyball: settings['venue_2_name'] || 'الكرة الطائرة',
      multi:      settings['venue_3_name'] || 'الملعب المتعدد',
    }

    // 4. جلب الحجوزات في الفترة مع الفلاتر
    let query = admin
      .from('bookings')
      .select('id,booking_date,court_id,period_number,customer_phone,customer_name,code_used,base_price,discount_amount,final_price,water_quantity,status,is_manual,confirmed_by,confirmed_at,created_at,updated_at')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('booking_date', { ascending: true })

    if (court  !== 'all') query = query.eq('court_id', court)
    if (status !== 'all') query = query.eq('status', status)

    const { data: rawBookings } = await query
    const allBookings = (rawBookings ?? []) as BookingRow[]
    const confirmed   = allBookings.filter(b => b.status === 'confirmed')

    // 5. جلب أكواد الخصم لإثراء بيانات الأكواد
    const { data: codesData } = await admin
      .from('codes')
      .select('code,max_uses,is_active,discount_type,discount_value')
    const codesMap: Record<string, { max_uses: number | null; is_active: boolean; discount_type: string | null; discount_value: number | null }> = {}
    ;(codesData ?? []).forEach(c => {
      codesMap[c.code] = { max_uses: c.max_uses, is_active: c.is_active, discount_type: c.discount_type, discount_value: c.discount_value }
    })

    // 6. جلب بيانات العملاء للحجوزات في الفترة
    const phonesInPeriod = [...new Set(confirmed.map(b => b.customer_phone))]
    let customersMap: Record<string, { classification: string | null; is_vip: boolean; preferred_court: string | null; first_booking_at: string | null }> = {}

    if (phonesInPeriod.length > 0) {
      const { data: custData } = await admin
        .from('customers')
        .select('phone,classification,is_vip,preferred_court,first_booking_at')
        .in('phone', phonesInPeriod)
      ;(custData ?? []).forEach(c => {
        customersMap[c.phone] = {
          classification:   c.classification,
          is_vip:           c.is_vip ?? false,
          preferred_court:  c.preferred_court,
          first_booking_at: c.first_booking_at,
        }
      })
    }

    // ──────────────────────────────────────────────────────────
    // ٧. بناء KPIs
    // ──────────────────────────────────────────────────────────
    const totalRevenue   = confirmed.reduce((s, b) => s + (b.final_price ?? 0), 0)
    const totalDiscount  = confirmed.reduce((s, b) => s + (b.discount_amount ?? 0), 0)
    const totalBase      = confirmed.reduce((s, b) => s + (b.base_price ?? 0), 0)
    const waterRevenue   = confirmed.reduce((s, b) => s + ((b.water_quantity ?? 0) * waterPrice), 0)
    const avgBookingVal  = confirmed.length > 0 ? Math.round(totalRevenue / confirmed.length) : 0

    const cancelledCount = allBookings.filter(b => ['cancelled', 'rejected', 'expired'].includes(b.status)).length
    const cancellationRate = allBookings.length > 0
      ? Math.round(cancelledCount / allBookings.length * 100)
      : 0

    const kpis: ReportKpis = {
      total_revenue:          totalRevenue,
      total_discount:         totalDiscount,
      total_base:             totalBase,
      water_revenue:          waterRevenue,
      confirmed_count:        confirmed.length,
      total_count:            allBookings.length,
      avg_booking_value:      avgBookingVal,
      cancellation_rate:      cancellationRate,
      // حقول التحصيل — تُملأ بعد استعلام DB (placeholder حتى تُحسب لاحقاً)
      total_collected:        0,
      total_balance_due:      0,
      partial_invoices_count: 0,
    }

    // ── تحصيل حقيقي: استعلام payments + invoices ──
    // نجمع الدفعات المسجّلة في نفس فترة البحث
    try {
      const { data: paymentsInPeriod } = await admin
        .from('payments')
        .select('amount')
        .gte('payment_date', from)
        .lte('payment_date', to)

      kpis.total_collected = (paymentsInPeriod ?? []).reduce((s, p) => s + Number(p.amount), 0)

      // فواتير غير مكتملة السداد (ليست paid) — مقيّدة بالفترة المفلترة فقط
      // نفلتر بـ issued_at لنعكس الفواتير الصادرة ضمن النطاق الزمني المختار
      const { data: unpaidInvoices } = await admin
        .from('invoices')
        .select('id, total_amount, payment_status')
        .eq('status', 'issued')
        .neq('payment_status', 'paid')
        .gte('issued_at', from)
        .lte('issued_at', to + 'T23:59:59')

      const unpaid = unpaidInvoices ?? []
      kpis.partial_invoices_count = unpaid.filter(inv => inv.payment_status === 'partial').length

      // لحساب balance_due لكل فاتورة: نجلب إجمالي الدفعات لكل فاتورة
      if (unpaid.length > 0) {
        const invoiceIds = unpaid.map(inv => inv.id)
        const { data: paymentsForUnpaid } = await admin
          .from('payments')
          .select('invoice_id, amount')
          .in('invoice_id', invoiceIds)

        // تجميع الدفعات بالفاتورة
        const paidPerInvoice: Record<string, number> = {}
        ;(paymentsForUnpaid ?? []).forEach(p => {
          paidPerInvoice[p.invoice_id] = (paidPerInvoice[p.invoice_id] ?? 0) + Number(p.amount)
        })

        // جمع المتبقي لكل فاتورة
        kpis.total_balance_due = unpaid.reduce((sum, inv) => {
          const paid = paidPerInvoice[inv.id] ?? 0
          return sum + Math.max(0, Number(inv.total_amount) - paid)
        }, 0)
      }
    } catch (_e) {
      // جدول payments قد لا يكون موجوداً بعد — نحتفظ بالقيم الافتراضية 0
    }

    // ──────────────────────────────────────────────────────────
    // ٨. القسم المالي
    // ──────────────────────────────────────────────────────────
    const courtFinMap: Record<string, { count: number; base: number; discount: number; revenue: number; water: number }> = {}
    confirmed.forEach(b => {
      if (!courtFinMap[b.court_id]) courtFinMap[b.court_id] = { count: 0, base: 0, discount: 0, revenue: 0, water: 0 }
      courtFinMap[b.court_id].count++
      courtFinMap[b.court_id].base    += b.base_price ?? 0
      courtFinMap[b.court_id].discount += b.discount_amount ?? 0
      courtFinMap[b.court_id].revenue  += b.final_price ?? 0
      courtFinMap[b.court_id].water    += (b.water_quantity ?? 0) * waterPrice
    })

    const statusBreakdown = { confirmed: 0, pending: 0, uploaded: 0, cancelled: 0, rejected: 0, expired: 0 }
    allBookings.forEach(b => {
      if (b.status in statusBreakdown) {
        (statusBreakdown as Record<string, number>)[b.status]++
      }
    })

    const dayRevMap: Record<string, { revenue: number; count: number }> = {}
    confirmed.forEach(b => {
      if (!dayRevMap[b.booking_date]) dayRevMap[b.booking_date] = { revenue: 0, count: 0 }
      dayRevMap[b.booking_date].revenue += b.final_price ?? 0
      dayRevMap[b.booking_date].count++
    })

    const financial: ReportFinancial = {
      by_court: Object.entries(courtFinMap).map(([court_id, v]) => ({
        court_id,
        name:         COURT_NAMES[court_id] ?? court_id,
        count:        v.count,
        base:         v.base,
        discount:     v.discount,
        revenue:      v.revenue,
        water_revenue: v.water,
      })),
      by_day: Object.entries(dayRevMap)
        .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      status_breakdown: statusBreakdown,
    }

    // ──────────────────────────────────────────────────────────
    // ٩. قسم الحجوزات
    // ──────────────────────────────────────────────────────────
    const byPeriod: Record<string, number> = { '1': 0, '2': 0, '3': 0 }
    confirmed.forEach(b => {
      const k = String(b.period_number)
      if (k in byPeriod) byPeriod[k]++
    })

    const bookingsReport: ReportBookings = {
      total:         allBookings.length,
      by_period:     byPeriod,
      manual_count:  allBookings.filter(b => b.is_manual).length,
      online_count:  allBookings.filter(b => !b.is_manual).length,
      details:       allBookings,
    }

    // ──────────────────────────────────────────────────────────
    // ١٠. قسم العملاء
    // ──────────────────────────────────────────────────────────
    const custRevMap: Record<string, { name: string; count: number; revenue: number }> = {}
    confirmed.forEach(b => {
      if (!custRevMap[b.customer_phone]) {
        custRevMap[b.customer_phone] = { name: b.customer_name, count: 0, revenue: 0 }
      }
      custRevMap[b.customer_phone].count++
      custRevMap[b.customer_phone].revenue += b.final_price ?? 0
    })

    const topList = Object.entries(custRevMap).map(([phone, v]) => {
      const info = customersMap[phone]
      return {
        phone,
        name:             v.name,
        count:            v.count,
        revenue:          v.revenue,
        classification:   info?.classification ?? null,
        is_vip:           info?.is_vip ?? false,
        preferred_court:  info?.preferred_court ?? null,
        // first_booking_at من جدول customers — هذا هو أول حجز حقيقي للعميل
        first_booking_at: info?.first_booking_at ?? null,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    // عميل جديد حقيقي: first_booking_at >= from (أول حجز له في حياته ضمن الفترة)
    const newCustomers    = topList.filter(c => c.first_booking_at && c.first_booking_at >= from).length
    const repeatCustomers = topList.length - newCustomers
    const repeatRate      = topList.length > 0 ? Math.round(repeatCustomers / topList.length * 100) : 0

    // متوسط رضا العملاء من booking_ratings للحجوزات ضمن الفترة
    let avgRating: number | null = null
    try {
      const bookingIdsInPeriod = confirmed.map(b => b.id)
      if (bookingIdsInPeriod.length > 0) {
        const { data: ratingsData } = await admin
          .from('booking_ratings')
          .select('rating')
          .in('booking_id', bookingIdsInPeriod)
        if (ratingsData && ratingsData.length > 0) {
          const sum = ratingsData.reduce((s, r) => s + (r.rating ?? 0), 0)
          avgRating = Math.round((sum / ratingsData.length) * 10) / 10
        }
      }
    } catch (_e) {
      // جدول booking_ratings قد لا يكون موجوداً بعد
      avgRating = null
    }

    const customers: ReportCustomers = {
      total_unique:     topList.length,
      new_customers:    newCustomers,
      repeat_customers: repeatCustomers,
      repeat_rate:      repeatRate,
      avg_rating:       avgRating,
      top_list:         topList,
    }


    // ──────────────────────────────────────────────────────────
    // ١١. قسم الأكواد
    // ──────────────────────────────────────────────────────────
    const codeRevMap: Record<string, { count: number; total_discount: number; total_revenue: number }> = {}
    confirmed.filter(b => b.code_used).forEach(b => {
      const code = b.code_used!
      if (!codeRevMap[code]) codeRevMap[code] = { count: 0, total_discount: 0, total_revenue: 0 }
      codeRevMap[code].count++
      codeRevMap[code].total_discount += b.discount_amount ?? 0
      codeRevMap[code].total_revenue  += b.final_price ?? 0
    })

    const totalWithCode = confirmed.filter(b => b.code_used).length
    const usageRate     = confirmed.length > 0 ? Math.round(totalWithCode / confirmed.length * 100) : 0

    const codes: ReportCodes = {
      unique_codes_used: Object.keys(codeRevMap).length,
      total_uses:        totalWithCode,
      total_discount:    Object.values(codeRevMap).reduce((s, v) => s + v.total_discount, 0),
      usage_rate:        usageRate,
      details: Object.entries(codeRevMap)
        .map(([code, v]) => ({
          code,
          ...v,
          max_uses:       codesMap[code]?.max_uses ?? null,
          is_active:      codesMap[code]?.is_active ?? false,
          discount_type:  codesMap[code]?.discount_type ?? null,
          discount_value: codesMap[code]?.discount_value ?? null,
        }))
        .sort((a, b) => b.count - a.count),
    }

    // ──────────────────────────────────────────────────────────
    // ١٢. الخريطة الحرارية — منفصلة لكل ملعب + الكل
    // ──────────────────────────────────────────────────────────
    const daysDiff   = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
    const weeksCount = Math.max(1, Math.ceil(daysDiff / 7))

    // فقط الحجوزات المؤكدة أو uploaded للإشغال
    const occupiedBookings = allBookings.filter(b => ['confirmed', 'uploaded'].includes(b.status))

    // عدد الملاعب الكلي — ديناميكي من COURT_NAMES حتى يتحدث تلقائياً عند إضافة ملاعب
    const totalCourtsCount = Object.keys(COURT_NAMES).length
    // عند فلترة ملعب واحد المقام = 1، عند "كل الملاعب" المقام = العدد الحقيقي
    const filteredCourtsCount = court !== 'all' ? 1 : totalCourtsCount

    const heatmap: ReportHeatmap = {
      all:        buildHeatGrid(occupiedBookings, weeksCount, totalCourtsCount),
      football:   buildHeatGrid(occupiedBookings.filter(b => b.court_id === 'football'),   weeksCount, filteredCourtsCount),
      volleyball: buildHeatGrid(occupiedBookings.filter(b => b.court_id === 'volleyball'), weeksCount, filteredCourtsCount),
      multi:      buildHeatGrid(occupiedBookings.filter(b => b.court_id === 'multi'),      weeksCount, filteredCourtsCount),
    }

    // ──────────────────────────────────────────────────────────
    // ١٣. قسم الأداء التشغيلي
    // ──────────────────────────────────────────────────────────
    // نسبة الإشغال: المواعيد المؤكدة / إجمالي المواعيد الممكنة
    // = حجوزات مؤكدة / (عدد أيام الفترة × عدد الملاعب × 3 فترات)
    const totalSlots   = daysDiff * totalCourtsCount * 3
    const occupancyRate = totalSlots > 0
      ? Math.round(confirmed.length / totalSlots * 100)
      : 0

    // أكثر يوم
    const dayCountMap: Record<string, number> = {}
    confirmed.forEach(b => { dayCountMap[b.booking_date] = (dayCountMap[b.booking_date] ?? 0) + 1 })
    const topDayEntry = Object.entries(dayCountMap).sort((a, b) => b[1] - a[1])[0]

    // أكثر فترة
    const periodCountMap: Record<number, number> = {}
    confirmed.forEach(b => { periodCountMap[b.period_number] = (periodCountMap[b.period_number] ?? 0) + 1 })
    const topPeriodEntry = Object.entries(periodCountMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

    // أكثر ملعب
    const courtCountMap: Record<string, number> = {}
    confirmed.forEach(b => { courtCountMap[b.court_id] = (courtCountMap[b.court_id] ?? 0) + 1 })
    const topCourtEntry = Object.entries(courtCountMap).sort((a, b) => b[1] - a[1])[0]

    // متوسط وقت التأكيد (بالدقائق)
    const confirmationTimes = confirmed
      .filter(b => b.confirmed_at && b.created_at)
      .map(b => (new Date(b.confirmed_at!).getTime() - new Date(b.created_at).getTime()) / 60000)
      .filter(t => t > 0 && t < 10080) // إزالة الشاذات (أكثر من أسبوع)

    const avgConfirmMins = confirmationTimes.length > 0
      ? Math.round(confirmationTimes.reduce((s, t) => s + t, 0) / confirmationTimes.length)
      : 0

    const operations: ReportOperations = {
      occupancy_rate:           occupancyRate,
      top_day:                  topDayEntry    ? { date: topDayEntry[0],                count: topDayEntry[1] }    : null,
      top_period:               topPeriodEntry ? { period: Number(topPeriodEntry[0]),   count: Number(topPeriodEntry[1]) } : null,
      top_court:                topCourtEntry  ? { court_id: topCourtEntry[0],          count: topCourtEntry[1] }  : null,
      avg_confirmation_minutes: avgConfirmMins,
    }

    // ──────────────────────────────────────────────────────────
    // ١٤. تجميع الـ Response
    // ──────────────────────────────────────────────────────────
    const meta: ReportMeta = {
      from,
      to,
      generated_at:           new Date().toISOString(),
      water_price_per_carton: waterPrice,
      court_filter:           court,
      status_filter:          status,
    }

    const response: ReportData = {
      meta,
      kpis,
      financial,
      bookings_report: bookingsReport,
      customers,
      codes,
      heatmap,
      operations,
    }

    return Response.json(response)

  } catch (err) {
    console.error('[reports-v2]', err)
    return Response.json({ error: 'فشل جلب التقارير' }, { status: 500 })
  }
}
