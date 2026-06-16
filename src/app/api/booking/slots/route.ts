// ============================================================
// API Route — جلب الفترات المتاحة
// يدمج: available_slots + blocked_slots + slot_holds
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const cookieStore = await cookies()
    const myPhone = cookieStore.get('booking_phone')?.value ?? ''

    // ١) جلب الفترات المتاحة من الـ View
    const { data: slots, error } = await supabase
      .from('available_slots')
      .select('day_date, court_id, period_number, is_available')
      .order('day_date')
      .order('court_id')
      .order('period_number')

    if (error) throw error

    // ٢) جلب الفترات المحجوبة من المدير
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('date, court_id, period_number')

    // ٣) جلب الحجوزات المؤقتة النشطة (غير منتهية)
    const { data: holds } = await supabase
      .from('slot_holds')
      .select('court_id, booking_date, period_number, phone')
      .gt('expires_at', new Date().toISOString())

    // ٤) بناء Sets للبحث السريع O(1)
    const blockedSet = new Set(
      (blocked ?? []).map(b => `${b.date}|${b.court_id}|${b.period_number}`)
    )

    const holdMap = new Map(
      (holds ?? []).map(h => [
        `${h.booking_date}|${h.court_id}|${h.period_number}`,
        h.phone,
      ])
    )

    // ٥) دمج: محجوبة أو محجوزة مؤقتاً (ما عدا من العميل نفسه) → غير متاحة
    const mergedSlots = (slots ?? []).map(slot => {
      const key = `${slot.day_date}|${slot.court_id}|${slot.period_number}`
      const isBlocked = blockedSet.has(key)
      const holdPhone = holdMap.get(key)
      const isHeldByOther = holdPhone && holdPhone !== myPhone

      return {
        ...slot,
        is_available: slot.is_available && !isBlocked && !isHeldByOther,
        is_held: !!isHeldByOther, // للتمييز في الواجهة بين "محجوز" و"قيد الحجز"
      }
    })

    return Response.json({ slots: mergedSlots })
  } catch (err) {
    console.error('[slots]', err)
    return Response.json({ error: 'فشل جلب المواعيد' }, { status: 500 })
  }
}
