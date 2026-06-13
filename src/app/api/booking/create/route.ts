// ============================================================
// API Route — إنشاء حجز جديد
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
    const { booking_date, court_id, period_number, customer_name, code_used } = body

    // تحقق أساسي
    if (!booking_date || !court_id || !period_number || !customer_name) {
      return Response.json({ error: 'يرجى إكمال بيانات الحجز' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // التحقق من حد الحجوزات المعلّقة لهذا الجوال
    const { data: limitOk } = await supabase.rpc('check_pending_limit', {
      p_phone: phone,
    })
    if (!limitOk) {
      return Response.json(
        { error: 'لديك حجوزات معلّقة، يرجى إكمالها أو انتظار إلغائها التلقائي' },
        { status: 429 }
      )
    }

    // التحقق من أن العميل غير موقوف
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

    // حساب السعر
    const { data: priceData } = await supabase.rpc('calculate_price', {
      p_court_id: court_id,
      p_code: code_used || null,
    })

    if (priceData?.error) {
      return Response.json({ error: priceData.error }, { status: 400 })
    }

    // إنشاء الحجز — الـ UNIQUE constraint يمنع التضارب تلقائياً
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
        final_price: priceData.final_price,
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

    // تحديث عداد استخدام الكود
    if (code_used) {
      await supabase
        .from('codes')
        .update({ used_count: supabase.rpc('used_count + 1' as never) })
        .eq('code', code_used)
    }

    // تسجيل في audit_log
    await supabase.from('audit_log').insert({
      table_name: 'bookings',
      record_id: booking.id,
      action: 'insert',
      new_data: booking,
      notes: `حجز جديد من ${phone}`,
    })

    return Response.json({ success: true, booking_id: booking.id })
  } catch (err) {
    console.error('[create-booking]', err)
    return Response.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 })
  }
}
