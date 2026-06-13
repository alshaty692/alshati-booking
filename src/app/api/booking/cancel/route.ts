// ============================================================
// API Route — إلغاء الحجز (من طرف العميل)
// شرط: قبل 24 ساعة من موعد الملعب
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ error: 'انتهت جلستك' }, { status: 401 })
    }

    const { booking_id } = await request.json()

    const supabase = createAdminClient()
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, booking_date, customer_phone')
      .eq('id', booking_id)
      .single()

    if (!booking) return Response.json({ error: 'الحجز غير موجود' }, { status: 404 })
    if (booking.customer_phone !== phone) return Response.json({ error: 'غير مصرّح' }, { status: 403 })

    if (!['pending', 'uploaded'].includes(booking.status)) {
      return Response.json(
        { error: 'لا يمكن إلغاء هذا الحجز' },
        { status: 400 }
      )
    }

    // التحقق من 24 ساعة
    const bookingDateTime = new Date(booking.booking_date + 'T17:00:00') // أبكر فترة
    const hoursUntil = (bookingDateTime.getTime() - Date.now()) / 3600000
    if (hoursUntil < 24) {
      return Response.json(
        { error: 'لا يمكن الإلغاء خلال 24 ساعة من الموعد' },
        { status: 400 }
      )
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', internal_note: 'ألغى العميل الحجز' })
      .eq('id', booking_id)

    await supabase.from('audit_log').insert({
      table_name: 'bookings',
      record_id: booking_id,
      action: 'update',
      notes: `ألغى العميل ${phone} الحجز`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[cancel-booking]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
