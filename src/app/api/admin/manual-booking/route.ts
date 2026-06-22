// ============================================================
// API Route — الحجز اليدوي (من الإدارة)
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { data: adminUser } = await supabase.from('admin_users').select('role').eq('id', user.id).single()
    if (!['admin','editor'].includes(adminUser?.role ?? '')) {
      return Response.json({ error: 'ليس لديك صلاحية الحجز اليدوي' }, { status: 403 })
    }

    const body = await request.json()
    const {
      booking_date, court_id, period_number,
      customer_name, customer_phone,
      code_used, final_price, internal_note,
      water_quantity,
      status: requestedStatus,
    } = body

    if (!booking_date || !court_id || !period_number || !customer_name || !customer_phone) {
      return Response.json({ error: 'يرجى إكمال البيانات المطلوبة' }, { status: 400 })
    }

    // الحالات المسموحة للحجز اليدوي
    const ALLOWED_STATUSES = ['confirmed', 'pending', 'uploaded']
    const finalStatus: string = ALLOWED_STATUSES.includes(requestedStatus) ? requestedStatus : 'confirmed'
    const isConfirmed = finalStatus === 'confirmed'

    const admin = createAdminClient()

    // حساب السعر
    const { data: priceData } = await admin.rpc('calculate_price', {
      p_court_id: court_id,
      p_code: code_used || null,
    })

    const effectiveFinalPrice = final_price ? Number(final_price) : (priceData?.final_price ?? 0)
    const waterQty = Number(water_quantity ?? 0)

    // إنشاء الحجز
    const { data: booking, error } = await admin
      .from('bookings')
      .insert({
        booking_date, court_id,
        period_number: Number(period_number),
        customer_phone,
        customer_name,
        code_used: code_used || null,
        base_price: priceData?.base_price ?? effectiveFinalPrice,
        discount_amount: priceData?.discount_amount ?? 0,
        final_price: effectiveFinalPrice,
        water_quantity: waterQty,
        status: finalStatus,
        is_manual: true,
        ...(isConfirmed ? { confirmed_by: user.id, confirmed_at: new Date().toISOString() } : {}),
        internal_note: internal_note || null,
      })
      .select().single()

    if (error) {
      if (error.code === '23505') return Response.json({ error: 'هذه الفترة محجوزة بالفعل' }, { status: 409 })
      throw error
    }

    // تفعيل كود الخصم إن وُجد
    if (code_used) {
      try {
        await admin.rpc('increment_code_usage', { p_code: code_used })
      } catch { /* تجاهل خطأ الكود */ }
    }

    // خصم مخزون المياه إن كان الحجز مؤكداً وفيه مياه
    if (isConfirmed && waterQty > 0) {
      const { data: stockRow } = await admin
        .from('settings').select('value').eq('key', 'water_stock_available').single()
      const current = Number(stockRow?.value ?? 0)
      if (current >= waterQty) {
        await admin.from('settings')
          .upsert({ key: 'water_stock_available', value: String(current - waterQty) }, { onConflict: 'key' })
      }
    }

    await admin.from('audit_log').insert({
      table_name: 'bookings', record_id: booking.id, action: 'insert',
      performed_by: user.id,
      notes: `حجز يدوي (${finalStatus}) بواسطة الإدارة لـ ${customer_phone}`,
    })

    return Response.json({ success: true, booking_id: booking.id })
  } catch (err) {
    console.error('[manual-booking]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
