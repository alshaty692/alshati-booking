// ============================================================
// POST /api/booking/rate
// تقييم حجز مؤكد منتهي — العميل المجهول
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { booking_id, rating, comment } = body as {
      booking_id: string
      rating:     number
      comment?:   string
    }

    // ── ١. التحقق من هوية العميل عبر cookie ──────────────────
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    // ── ٢. التحقق من المدخلات ──────────────────────────────────
    if (!booking_id || typeof booking_id !== 'string') {
      return Response.json({ error: 'معرّف الحجز مطلوب' }, { status: 400 })
    }
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return Response.json({ error: 'التقييم يجب أن يكون بين 1 و 5' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── ٣. التحقق من الحجز (phone + status + date) ──────────────
    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, customer_phone, status, booking_date')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return Response.json({ error: 'الحجز غير موجود' }, { status: 404 })
    }

    // التحقق أن الهاتف يطابق صاحب الحجز (في الكود، ليس فقط RLS)
    if (booking.customer_phone !== phone) {
      return Response.json({ error: 'لا تملك صلاحية تقييم هذا الحجز' }, { status: 403 })
    }

    // يجب أن يكون مؤكداً
    if (booking.status !== 'confirmed') {
      return Response.json({ error: 'يمكن تقييم الحجوزات المؤكدة فقط' }, { status: 400 })
    }

    // يجب أن يكون تاريخ الحجز قبل اليوم
    const nowSA = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
    const today = `${nowSA.getFullYear()}-${String(nowSA.getMonth()+1).padStart(2,'0')}-${String(nowSA.getDate()).padStart(2,'0')}`
    if (booking.booking_date >= today) {
      return Response.json({ error: 'يمكن التقييم بعد انتهاء موعد الحجز فقط' }, { status: 400 })
    }

    // ── ٤. منع التقييم المكرر ───────────────────────────────────
    const { data: existing } = await admin
      .from('booking_ratings')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'لقد قيّمت هذا الحجز مسبقاً' }, { status: 409 })
    }

    // ── ٥. حفظ التقييم ─────────────────────────────────────────
    const { data: newRating, error: insertErr } = await admin
      .from('booking_ratings')
      .insert({
        booking_id,
        phone,
        rating,
        comment: comment?.trim() || null,
      })
      .select()
      .single()

    if (insertErr) {
      // UNIQUE constraint violation (حماية مزدوجة)
      if (insertErr.code === '23505') {
        return Response.json({ error: 'لقد قيّمت هذا الحجز مسبقاً' }, { status: 409 })
      }
      console.error('[rate]', insertErr)
      return Response.json({ error: 'فشل حفظ التقييم' }, { status: 500 })
    }

    return Response.json({ success: true, rating: newRating }, { status: 201 })

  } catch (err) {
    console.error('[rate]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
