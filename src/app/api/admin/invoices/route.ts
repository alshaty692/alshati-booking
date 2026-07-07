// ============================================================
// GET /api/admin/invoices
// قائمة الفواتير مع فلاتر: status، month، search (اسم/كود عميل)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_invoices')
    if (!auth.ok) return auth.response

    const admin  = createAdminClient()
    const params = new URL(request.url).searchParams
    const status    = params.get('status')     // 'issued' | 'cancelled' | null = all
    const month     = params.get('month')      // 'YYYY-MM' | null
    const search    = params.get('search')     // نص البحث (اسم العميل أو customer_code)
    const bookingId = params.get('booking_id') // فلترة جديدة: UUID الحجز
    const page      = Math.max(1, Number(params.get('page') ?? 1))
    const limit     = bookingId ? 10 : 20      // لما يجلب بحجز محدد النتائج محدودة أصلاً
    const offset    = (page - 1) * limit

    // بناء الاستعلام
    let query = admin
      .from('invoices')
      .select(`
        id,
        invoice_number,
        status,
        payment_status,
        issued_at,
        cancelled_at,
        total_amount,
        court_amount,
        base_price,
        discount_amount,
        discount_code,
        discount_percentage,
        water_quantity,
        water_unit_price,
        water_total,
        batch_id,
        booking_id,
        customer_id,
        customers (
          id,
          name,
          phone,
          customer_code
        ),
        bookings (
          id,
          booking_date,
          court_id,
          period_number
        )
      `, { count: 'exact' })
      .order('issued_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (bookingId) query = query.eq('booking_id', bookingId)

    const paymentStatus = params.get('payment_status') // 'unpaid'|'partial'|'paid'
    if (paymentStatus) query = query.eq('payment_status', paymentStatus)

    if (month) {
      const [year, mon] = month.split('-')
      const start = `${year}-${mon}-01`
      const end   = new Date(Number(year), Number(mon), 0).toISOString().split('T')[0]
      query = query.gte('issued_at', start).lte('issued_at', end + 'T23:59:59Z')
    }

    const { data: invoices, error, count } = await query

    if (error) throw error

    // فلترة بالبحث النصي (server-side بعد الجلب — العدد صغير عادةً)
    let filtered = invoices ?? []
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter(inv => {
        const cust = inv.customers as { name?: string; phone?: string; customer_code?: string } | null
        return (
          cust?.name?.toLowerCase().includes(q) ||
          cust?.phone?.includes(q) ||
          cust?.customer_code?.toLowerCase().includes(q) ||
          inv.invoice_number.toLowerCase().includes(q)
        )
      })
    }

    return Response.json({
      invoices: filtered,
      total: count ?? 0,
      page,
      pages: Math.ceil((count ?? 0) / limit),
    })
  } catch (err) {
    console.error('[admin/invoices]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
