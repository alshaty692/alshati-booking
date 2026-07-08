// GET /api/guard/bookings — حجوزات اليوم التشغيلي المؤكدة للحارس
//
// اليوم التشغيلي: يبدأ 05:00 فجراً بتوقيت الرياض (Asia/Riyadh = UTC+3)
// وينتهي 04:59 فجراً اليوم التالي.
//
// حساب "تاريخ اليوم التشغيلي":
//   - نأخذ وقت UTC الحالي
//   - نحوّله لتوقيت الرياض (UTC+3)
//   - لو الساعة < 5 صباحاً → يوم التشغيل هو أمس
//   - لو الساعة >= 5 صباحاً → يوم التشغيل هو اليوم
//
// لا يُعرض: رقم الجوال، المبالغ المالية
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// ── حساب تاريخ اليوم التشغيلي بتوقيت الرياض ─────────────────
function getOperationalDate(): string {
  // Intl.DateTimeFormat — آمن ومحمول (لا toLocaleString الهش)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
    hour:  '2-digit',
    hour12: false,
  })

  const now  = new Date()
  const parts = fmt.formatToParts(now)

  const year  = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day   = parts.find(p => p.type === 'day')!.value
  const hour  = parseInt(parts.find(p => p.type === 'hour')!.value, 10)

  // قبل الساعة 5 فجراً → اليوم التشغيلي لا يزال أمس
  if (hour < 5) {
    const yesterday = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day) - 1,
    ))
    const yFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    return yFmt.format(yesterday)
  }

  return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
  // ── التحقق من جلسة الحارس ──────────────────────────────────
  const cookieStore = await cookies()
  const guardSession = cookieStore.get('guard_session')

  if (guardSession?.value !== 'authenticated') {
    return NextResponse.json(
      { error: 'غير مخوّل' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  try {
    const operationalDate = getOperationalDate()
    const supabase = createAdminClient()

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        'id, booking_date, court_id, period_number, customer_name, ' +
        'water_quantity, water_delivered_quantity, water_delivered_at, status'
      )
      .eq('booking_date', operationalDate)
      .eq('status', 'confirmed')
      .order('period_number', { ascending: true })
      .order('court_id',      { ascending: true })

    if (error) {
      console.error('[guard/bookings] خطأ:', error.message)
      return NextResponse.json(
        { error: 'فشل جلب الحجوزات' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { bookings, operational_date: operationalDate },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err) {
    console.error('[guard/bookings] خطأ غير متوقع:', err)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
