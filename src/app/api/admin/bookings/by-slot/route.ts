// ============================================================
// GET /api/admin/bookings/by-slot?date=YYYY-MM-DD&court_id=X&period=N
// جلب تفاصيل الحجز الفعّال بناءً على الفترة (admin/editor فقط)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const { searchParams } = request.nextUrl
    const date      = searchParams.get('date')
    const court_id  = searchParams.get('court_id')
    const period    = searchParams.get('period')

    if (!date || !court_id || !period) {
      return Response.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select('id, booking_date, court_id, period_number, customer_name, customer_phone, status, base_price, discount_amount, final_price, code_used, water_quantity, is_manual, created_at')
      .eq('booking_date', date)
      .eq('court_id', court_id)
      .eq('period_number', Number(period))
      .not('status', 'in', '(cancelled,rejected,expired)')
      .single()

    if (!booking) return Response.json({ found: false })

    return Response.json({ found: true, booking })
  } catch {
    return Response.json({ found: false })
  }
}
