// ============================================================
// POST /api/admin/bookings/cancel
// إلغاء حجز من قِبَل الأدمن مع سبب اختياري
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cancelInvoicesForBooking } from '@/lib/invoices'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { data: adminUser } = await supabase
      .from('admin_users').select('role').eq('id', user.id).single()
    if (!['admin', 'editor'].includes(adminUser?.role ?? '')) {
      return Response.json({ error: 'ليس لديك صلاحية الإلغاء' }, { status: 403 })
    }

    const body = await request.json()
    const { booking_id, cancellation_reason } = body
    if (!booking_id) return Response.json({ error: 'booking_id مطلوب' }, { status: 400 })

    const admin = createAdminClient()

    // جلب الحجز أولاً للتحقق من وجوده + حالته + كمية المياه
    const { data: booking, error: fetchError } = await admin
      .from('bookings')
      .select('id, status, water_quantity, court_id, booking_date, period_number, customer_phone')
      .eq('id', booking_id)
      .single()

    if (fetchError || !booking) {
      return Response.json({ error: 'الحجز غير موجود' }, { status: 404 })
    }
    if (['cancelled', 'rejected', 'expired'].includes(booking.status)) {
      return Response.json({ error: 'الحجز ملغى أو مرفوض بالفعل' }, { status: 400 })
    }

    // إعادة مخزون المياه لو كان الحجز مؤكداً وفيه مياه
    if (booking.status === 'confirmed' && (booking.water_quantity ?? 0) > 0) {
      const { data: stockRow } = await admin
        .from('settings').select('value').eq('key', 'water_stock_available').single()
      const current = Number(stockRow?.value ?? 0)
      await admin.from('settings')
        .upsert(
          { key: 'water_stock_available', value: String(current + booking.water_quantity) },
          { onConflict: 'key' }
        )
    }

    // إلغاء الحجز — نستخدم internal_note لحفظ السبب بدلاً من cancellation_reason
    const noteText = cancellation_reason
      ? `إلغاء إداري — السبب: ${cancellation_reason}`
      : 'إلغاء إداري'

    const { error: updateError } = await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        internal_note: noteText,
      })
      .eq('id', booking_id)

    if (updateError) {
      console.error('[admin/bookings/cancel] updateError:', updateError)
      throw updateError
    }

    // إلغاء الفاتورة المرتبطة تلقائياً
    try {
      await cancelInvoicesForBooking(
        booking_id,
        cancellation_reason ? `إلغاء إداري: ${cancellation_reason}` : 'إلغاء إداري',
        admin
      )
    } catch (invErr) {
      console.warn('[admin/bookings/cancel] فشل إلغاء الفاتورة (غير حرج):', invErr)
    }

    // audit log
    await admin.from('audit_log').insert({
      table_name: 'bookings',
      record_id: booking_id,
      action: 'update',
      performed_by: user.id,
      notes: `إلغاء إداري للحجز. السبب: ${cancellation_reason || 'لم يُذكر'}`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings/cancel]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
