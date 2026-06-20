// ============================================================
// API Route — حجوزات المستخدم الحالي
// يُرجع التقييم (لو موجود) مع كل حجز عبر LEFT JOIN
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

    // جلب الحجوزات مع التقييم (LEFT JOIN)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        rating:booking_ratings(id, rating, comment, created_at)
      `)
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    // تحويل rating من array إلى object مفرد (LEFT JOIN يُرجع array)
    const normalized = (bookings ?? []).map(b => ({
      ...b,
      rating: Array.isArray(b.rating) && b.rating.length > 0 ? b.rating[0] : null,
    }))

    return Response.json({ bookings: normalized })
  } catch (err) {
    console.error('[my-bookings]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
