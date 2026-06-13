// ============================================================
// API Route — حجوزات المستخدم الحالي
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ error: 'غير مصرّح' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return Response.json({ bookings: bookings ?? [] })
  } catch (err) {
    console.error('[my-bookings]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
