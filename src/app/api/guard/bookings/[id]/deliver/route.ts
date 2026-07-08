// PATCH /api/guard/bookings/[id]/deliver — تسجيل تسليم المياه
//
// يُحدِّث: water_delivered_quantity + water_delivered_at
// يُعاد: الحجز المحدَّث
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  // ── التحقق من جلسة الحارس ──────────────────────────────────
  const cookieStore = await cookies()
  const guardSession = cookieStore.get('guard_session')

  if (guardSession?.value !== 'authenticated') {
    return NextResponse.json(
      { error: 'غير مخوّل' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'معرّف الحجز مطلوب' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { delivered_quantity } = body as { delivered_quantity?: number }

    if (delivered_quantity === undefined || typeof delivered_quantity !== 'number') {
      return NextResponse.json(
        { error: 'delivered_quantity مطلوب ويجب أن يكون رقماً' },
        { status: 400 }
      )
    }

    if (delivered_quantity < 0 || delivered_quantity > 999) {
      return NextResponse.json(
        { error: 'الكمية يجب أن تكون بين 0 و999' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // التحقق من وجود الحجز وأنه مؤكد
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, status, water_quantity')
      .eq('id', id)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      )
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'لا يمكن تسجيل التسليم — الحجز غير مؤكد' },
        { status: 422 }
      )
    }

    // تسجيل التسليم
    const { data: updated, error: updateErr } = await supabase
      .from('bookings')
      .update({
        water_delivered_quantity: delivered_quantity,
        water_delivered_at:       new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, water_quantity, water_delivered_quantity, water_delivered_at')
      .single()

    if (updateErr) {
      console.error('[guard/deliver] خطأ في التحديث:', updateErr.message)
      return NextResponse.json(
        { error: 'فشل تسجيل التسليم' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { ok: true, booking: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[guard/deliver] خطأ غير متوقع:', err)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}
