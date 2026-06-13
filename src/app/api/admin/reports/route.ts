// ============================================================
// API Route — بيانات التقارير الموحّدة
// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // التحقق من الصلاحية
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const to   = searchParams.get('to')   ?? new Date().toISOString().split('T')[0]

    const admin = createAdminClient()

    // جلب الحجوزات في الفترة
    const { data: bookings } = await admin
      .from('bookings')
      .select('*')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('booking_date', { ascending: true })

    const all = bookings ?? []
    const confirmed = all.filter(b => b.status === 'confirmed')

    // ============================================================
    // التقرير المالي
    // ============================================================
    const totalRevenue    = confirmed.reduce((s, b) => s + (b.final_price ?? 0), 0)
    const totalDiscount   = confirmed.reduce((s, b) => s + (b.discount_amount ?? 0), 0)
    const totalBase       = confirmed.reduce((s, b) => s + (b.base_price ?? 0), 0)
    const avgBookingValue = confirmed.length > 0 ? totalRevenue / confirmed.length : 0

    // إيرادات حسب الملعب
    const revenueByCourtMap: Record<string, { revenue: number; count: number }> = {}
    confirmed.forEach(b => {
      if (!revenueByCourtMap[b.court_id]) revenueByCourtMap[b.court_id] = { revenue: 0, count: 0 }
      revenueByCourtMap[b.court_id].revenue += b.final_price ?? 0
      revenueByCourtMap[b.court_id].count++
    })
    const revenueByCourt = Object.entries(revenueByCourtMap).map(([court_id, v]) => ({ court_id, ...v }))

    // إيرادات حسب اليوم
    const revenueByDayMap: Record<string, number> = {}
    confirmed.forEach(b => {
      revenueByDayMap[b.booking_date] = (revenueByDayMap[b.booking_date] ?? 0) + (b.final_price ?? 0)
    })
    const revenueByDay = Object.entries(revenueByDayMap)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ============================================================
    // تقرير العملاء
    // ============================================================
    const customerMap: Record<string, { name: string; phone: string; count: number; revenue: number }> = {}
    confirmed.forEach(b => {
      if (!customerMap[b.customer_phone]) {
        customerMap[b.customer_phone] = { name: b.customer_name, phone: b.customer_phone, count: 0, revenue: 0 }
      }
      customerMap[b.customer_phone].count++
      customerMap[b.customer_phone].revenue += b.final_price ?? 0
    })
    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)

    const newCustomers = Object.values(customerMap).filter(c => c.count === 1).length
    const repeatCustomers = Object.values(customerMap).filter(c => c.count > 1).length

    // ============================================================
    // خريطة الإشغال (Heatmap)
    // ============================================================
    // أيام الأسبوع: 0=الأحد … 6=السبت
    const heatmap: Record<number, Record<number, { booked: number; total: number }>> = {}
    for (let d = 0; d <= 6; d++) {
      heatmap[d] = {}
      for (let p = 1; p <= 3; p++) {
        heatmap[d][p] = { booked: 0, total: 0 }
      }
    }

    // كل الحجوزات (مؤكدة وغيرها) لحساب الإشغال
    all.filter(b => ['confirmed','uploaded'].includes(b.status)).forEach(b => {
      const dow = new Date(b.booking_date + 'T00:00:00').getDay()
      const p   = b.period_number
      if (heatmap[dow] && heatmap[dow][p]) {
        heatmap[dow][p].booked++
      }
    })

    // حساب total: عدد أسابيع في الفترة × 1 (كل ملعب مرة واحدة أسبوعياً)
    const daysDiff = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
    const weeksCount = Math.max(1, Math.ceil(daysDiff / 7))
    for (let d = 0; d <= 6; d++) {
      for (let p = 1; p <= 3; p++) {
        heatmap[d][p].total = weeksCount * 3 // 3 ملاعب
      }
    }

    // ============================================================
    // تقرير الأكواد
    // ============================================================
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

    // توزيع الحالات
    const statusCount: Record<string, number> = {}
    all.forEach(b => { statusCount[b.status] = (statusCount[b.status] ?? 0) + 1 })

    return Response.json({
      meta: { from, to, generated_at: new Date().toISOString() },
      summary: {
        total_bookings: all.length,
        confirmed_bookings: confirmed.length,
        total_revenue: totalRevenue,
        total_discount: totalDiscount,
        total_base: totalBase,
        avg_booking_value: Math.round(avgBookingValue),
        status_count: statusCount,
      },
      financial: { revenue_by_court: revenueByCourt, revenue_by_day: revenueByDay },
      customers: { top_customers: topCustomers, new_customers: newCustomers, repeat_customers: repeatCustomers },
      heatmap,
      codes: { code_stats: codeStats, bookings_with_code: confirmed.filter(b => b.code_used).length },
      bookings: all, // للـ PDF والـ Excel
    })
  } catch (err) {
    console.error('[reports]', err)
    return Response.json({ error: 'فشل جلب التقارير' }, { status: 500 })
  }
}
