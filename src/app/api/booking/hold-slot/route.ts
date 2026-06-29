// ============================================================
// API Route — حجز مؤقت للفترة (Slot Hold)
// يحجز الفترة لمدة 10 دقائق أثناء إكمال عملية الحجز
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getClosureState } from '@/lib/closure'

export async function POST(request: NextRequest) {
  try {
    // ── فحص الإغلاق الكامل ──────────────────────────────────
    const closure = await getClosureState()
    if (closure.isFullyClosedNow) {
      return Response.json(
        { error: `المنشأة مغلقة حالياً — لا يمكن الحجز` },
        { status: 403 }
      )
    }

    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json(
        { error: 'انتهت جلستك، يرجى تسجيل الدخول مرة أخرى' },
        { status: 401 }
      )
    }

    const { court_id, booking_date, period_number } = await request.json()

    if (!court_id || !booking_date || !period_number) {
      return Response.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    // ── فحص الإغلاق المجدول ──────────────────────────────────
    if (closure.scheduledStartISO && booking_date >= closure.scheduledStartISO) {
      return Response.json(
        { error: `المنشأة مغلقة في هذا التاريخ` },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // تنظيف الـ holds المنتهية أولاً
    await supabase
      .from('slot_holds')
      .delete()
      .lt('expires_at', new Date().toISOString())

    // حذف أي hold سابق لنفس العميل (عميل واحد = hold واحد فقط)
    await supabase
      .from('slot_holds')
      .delete()
      .eq('phone', phone)

    // محاولة إنشاء hold جديد
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 دقائق

    const { error } = await supabase
      .from('slot_holds')
      .insert({
        court_id,
        booking_date,
        period_number,
        phone,
        expires_at: expiresAt,
      })

    if (error) {
      // UNIQUE constraint = فترة محجوزة مؤقتاً من عميل آخر
      if (error.code === '23505') {
        return Response.json(
          { error: 'هذه الفترة قيد الحجز من عميل آخر، حاول بعد قليل' },
          { status: 409 }
        )
      }
      throw error
    }

    return Response.json({
      success: true,
      expires_at: expiresAt,
      message: 'تم حجز الفترة مؤقتاً لمدة 10 دقائق',
    })
  } catch (err) {
    console.error('[hold-slot]', err)
    return Response.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 })
  }
}
