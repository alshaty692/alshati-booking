// ============================================================
// API Route — جلب الفترات المتاحة
// يدمج: available_slots + blocked_slots + slot_holds
// يطبّق نافذة الحجز (booking_window_days) من الإعدادات live
// يعيد closure_info للإغلاق الكامل/المجدول
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getClosureState } from '@/lib/closure'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const cookieStore = await cookies()
    const myPhone = cookieStore.get('booking_phone')?.value ?? ''
    const now = new Date().toISOString()

    // ── جلب حالة الإغلاق + الإعدادات + slot_holds (متوازي) ──
    const [closure, { data: windowSetting }, { data: holds }] = await Promise.all([
      getClosureState(),
      supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_window_days')
        .single(),
      supabase
        .from('slot_holds')
        .select('court_id, booking_date, period_number, phone')
        .gt('expires_at', now),
    ])

    // ── حساب نطاق التواريخ ────────────────────────────────────
    const windowDays = Math.max(1, Number(windowSetting?.value) || 7)
    const nowSA   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
    const today   = `${nowSA.getFullYear()}-${String(nowSA.getMonth()+1).padStart(2,'0')}-${String(nowSA.getDate()).padStart(2,'0')}`
    const maxD    = new Date(nowSA); maxD.setDate(maxD.getDate() + windowDays)
    const maxDate = `${maxD.getFullYear()}-${String(maxD.getMonth()+1).padStart(2,'0')}-${String(maxD.getDate()).padStart(2,'0')}`

    // ── جلب الفترات + الفترات المحجوبة (متوازي) ──────────────
    const [{ data: slots, error }, { data: blocked }] = await Promise.all([
      supabase
        .from('available_slots')
        .select('day_date, court_id, period_number, is_available')
        .gte('day_date', today)
        .lte('day_date', maxDate)
        .order('day_date')
        .order('court_id')
        .order('period_number'),
      supabase
        .from('blocked_slots')
        .select('date, court_id, period_number')
        .gte('date', today)
        .lte('date', maxDate),
    ])

    if (error) throw error

    // ── بناء Sets للبحث السريع O(1) ──────────────────────────
    const blockedSet = new Set(
      (blocked ?? []).map(b => `${b.date}|${b.court_id}|${b.period_number}`)
    )

    const holdMap = new Map(
      (holds ?? []).map(h => [
        `${h.booking_date}|${h.court_id}|${h.period_number}`,
        h.phone,
      ])
    )

    // ── دمج: محجوبة أو محجوزة مؤقتاً أو ضمن إغلاق مجدول ────
    const mergedSlots = (slots ?? []).map(slot => {
      const key = `${slot.day_date}|${slot.court_id}|${slot.period_number}`
      const isBlocked          = blockedSet.has(key)
      const holdPhone          = holdMap.get(key)
      const isHeldByOther      = holdPhone && holdPhone !== myPhone
      const isFullClosureBlock = closure.scheduledStartISO
        ? slot.day_date >= closure.scheduledStartISO
        : false

      return {
        ...slot,
        is_available: slot.is_available && !isBlocked && !isHeldByOther && !isFullClosureBlock,
        is_held: !!isHeldByOther,
        is_full_closure_blocked: isFullClosureBlock,
      }
    })

    return Response.json({
      slots: mergedSlots,
      window_days: windowDays,
      closure_info: closure.isActive
        ? {
            isFullyClosedNow:    closure.isFullyClosedNow,
            scheduledStartISO:   closure.scheduledStartISO,
            title:               closure.title,
            message:             closure.message,
          }
        : null,
    })
  } catch (err) {
    console.error('[slots]', err)
    return Response.json({ error: 'فشل جلب المواعيد' }, { status: 500 })
  }
}
