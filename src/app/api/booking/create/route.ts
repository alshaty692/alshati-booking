// ============================================================
// API Route — إنشاء حجز جديد
// يدعم: حجز مؤقت (hold) + إيقاف ملاعب + المياه
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json(
        { error: 'انتهت جلستك، يرجى تسجيل الدخول مرة أخرى' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { booking_date, court_id, period_number, customer_name, code_used, water_quantity } = body

    // تحقق أساسي
    if (!booking_date || !court_id || !period_number || !customer_name) {
      return Response.json({ error: 'يرجى إكمال بيانات الحجز' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── التحقق من إيقاف الملعب ──────────────────────────────
    const { data: closures } = await supabase
      .from('venue_closures')
      .select('id, reason')
      .eq('court_id', court_id)
      .lte('start_date', booking_date)
      .gte('end_date', booking_date)
      .limit(1)

    if (closures && closures.length > 0) {
      return Response.json(
        { error: `الملعب موقوف: ${closures[0].reason ?? 'صيانة'}` },
        { status: 400 }
      )
    }

    // ── جلب حد الحجوزات المعلّقة من الإعدادات (live) ───────────────
    const { data: pendingLimitRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_pending_bookings')
      .single()

    const maxPending = Math.max(1, Number(pendingLimitRow?.value) || 3)

    // عد الحجوزات المعلّقة الحالية لهذا الجوال
    const { count: pendingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_phone', phone)
      .eq('status', 'pending')

    if ((pendingCount ?? 0) >= maxPending) {
      return Response.json(
        { error: `لديك حجوزات معلّقة (الحد: ${maxPending}). يرجى إكمالها أو انتظار إلغائها التلقائي` },
        { status: 429 }
      )
    }

    // ── التحقق من أن العميل غير موقوف ────────────────────────
    const { data: customer } = await supabase
      .from('customers')
      .select('is_suspended, suspension_reason')
      .eq('phone', phone)
      .single()

    if (customer?.is_suspended) {
      return Response.json(
        { error: `حسابك موقوف. السبب: ${customer.suspension_reason ?? 'تواصل مع الإدارة'}` },
        { status: 403 }
      )
    }

    // ── حساب السعر ──────────────────────────────────────────
    const { data: priceData } = await supabase.rpc('calculate_price', {
      p_court_id: court_id,
      p_code: code_used || null,
    })

    if (priceData?.error) {
      return Response.json({ error: priceData.error }, { status: 400 })
    }

    // ── حساب سعر المياه + التحقق من المخزون ────────────────
    let waterTotal = 0
    const waterQty = Math.max(0, Math.min(Number(water_quantity) || 0, 50)) // حد أمان
    if (waterQty > 0) {
      const { data: waterSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['water_price_per_carton', 'water_max_cartons', 'water_stock_available'])
      
      const pricePerCarton = Number(waterSettings?.find(s => s.key === 'water_price_per_carton')?.value) || 20
      const maxCartons = Number(waterSettings?.find(s => s.key === 'water_max_cartons')?.value) || 10
      const stockAvailable = Number(waterSettings?.find(s => s.key === 'water_stock_available')?.value ?? '999')
      
      // التحقق من المخزون
      if (stockAvailable <= 0) {
        return Response.json({ error: 'المياه غير متوفرة حالياً' }, { status: 400 })
      }
      if (waterQty > stockAvailable) {
        return Response.json({ error: `الكمية المتوفرة حالياً ${stockAvailable} كرتون فقط` }, { status: 400 })
      }

      const clampedQty = Math.min(waterQty, maxCartons)
      waterTotal = clampedQty * pricePerCarton
    }

    const finalPrice = (priceData.final_price ?? 0) + waterTotal

    // ── إنشاء الحجز — الـ UNIQUE constraint يمنع التضارب ────
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        booking_date,
        court_id,
        period_number,
        customer_phone: phone,
        customer_name,
        code_used: code_used || null,
        base_price: priceData.base_price,
        discount_amount: priceData.discount_amount,
        final_price: finalPrice,
        water_quantity: waterQty,
        status: 'pending',
        is_manual: false,
      })
      .select()
      .single()

    if (error) {
      // خطأ UNIQUE = الفترة محجوزة
      if (error.code === '23505') {
        return Response.json(
          { error: 'عذراً، هذه الفترة محجوزة. يرجى اختيار فترة أخرى' },
          { status: 409 }
        )
      }
      throw error
    }

    // ── تحديث عداد استخدام الكود (atomic — آمن من التزامن) ────
    if (code_used) {
      await supabase.rpc('increment_code_usage', { p_code: code_used })
    }

    // ── حذف الحجز المؤقت (hold) بعد نجاح الحجز الفعلي ──────
    await supabase
      .from('slot_holds')
      .delete()
      .eq('phone', phone)

    // ── تسجيل في audit_log ───────────────────────────────────
    await supabase.from('audit_log').insert({
      table_name: 'bookings',
      record_id: booking.id,
      action: 'insert',
      new_data: booking,
      notes: `حجز جديد من ${phone}${waterQty > 0 ? ` + ${waterQty} كرتون ماء` : ''}`,
    })

    return Response.json({ success: true, booking_id: booking.id })
  } catch (err) {
    console.error('[create-booking]', err)
    return Response.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 })
  }
}

