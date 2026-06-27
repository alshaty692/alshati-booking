// ============================================================
// API Route — جلب الفترات المتاحة
// يدمج: available_slots + blocked_slots + slot_holds
// يطبّق نافذة الحجز (booking_window_days) من الإعدادات live
// [TIMING] نسخة مؤقتة لقياس الأداء — تُحذف بعد التحليل
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const T = { start: performance.now() } as Record<string, number>

  try {
    // ── [T1] بدء إنشاء Supabase Client ───────────────────────
    T.t1_client_start = performance.now()
    const supabase = createAdminClient()
    T.t1_client_done = performance.now()

    // ── [T2] قراءة الـ cookies ────────────────────────────────
    T.t2_cookies_start = performance.now()
    const cookieStore = await cookies()
    const myPhone = cookieStore.get('booking_phone')?.value ?? ''
    T.t2_cookies_done = performance.now()

    // ── [T3] استعلام 1: settings (window_days) ───────────────
    T.t3_settings_start = performance.now()
    const { data: windowSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'booking_window_days')
      .single()
    T.t3_settings_done = performance.now()

    const windowDays = Math.max(1, Number(windowSetting?.value) || 7)
    const nowSA   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
    const today   = `${nowSA.getFullYear()}-${String(nowSA.getMonth()+1).padStart(2,'0')}-${String(nowSA.getDate()).padStart(2,'0')}`
    const maxD    = new Date(nowSA); maxD.setDate(maxD.getDate() + windowDays)
    const maxDate = `${maxD.getFullYear()}-${String(maxD.getMonth()+1).padStart(2,'0')}-${String(maxD.getDate()).padStart(2,'0')}`

    // ── [T4] استعلام 2: available_slots (view) ───────────────
    T.t4_slots_start = performance.now()
    const { data: slots, error } = await supabase
      .from('available_slots')
      .select('day_date, court_id, period_number, is_available')
      .gte('day_date', today)
      .lte('day_date', maxDate)
      .order('day_date')
      .order('court_id')
      .order('period_number')
    T.t4_slots_done = performance.now()

    if (error) throw error

    // ── [T5] استعلام 3: blocked_slots ────────────────────────
    T.t5_blocked_start = performance.now()
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('date, court_id, period_number')
      .gte('date', today)
      .lte('date', maxDate)
    T.t5_blocked_done = performance.now()

    // ── [T6] استعلام 4: slot_holds ───────────────────────────
    T.t6_holds_start = performance.now()
    const { data: holds } = await supabase
      .from('slot_holds')
      .select('court_id, booking_date, period_number, phone')
      .gt('expires_at', new Date().toISOString())
    T.t6_holds_done = performance.now()

    // ── [T7] معالجة البيانات (CPU) ───────────────────────────
    T.t7_process_start = performance.now()
    const blockedSet = new Set(
      (blocked ?? []).map(b => `${b.date}|${b.court_id}|${b.period_number}`)
    )
    const holdMap = new Map(
      (holds ?? []).map(h => [
        `${h.booking_date}|${h.court_id}|${h.period_number}`,
        h.phone,
      ])
    )
    const mergedSlots = (slots ?? []).map(slot => {
      const key = `${slot.day_date}|${slot.court_id}|${slot.period_number}`
      const isBlocked = blockedSet.has(key)
      const holdPhone = holdMap.get(key)
      const isHeldByOther = holdPhone && holdPhone !== myPhone
      return {
        ...slot,
        is_available: slot.is_available && !isBlocked && !isHeldByOther,
        is_held: !!isHeldByOther,
      }
    })
    T.t7_process_done = performance.now()

    // ── [T8] بناء الاستجابة ───────────────────────────────────
    T.t8_response_start = performance.now()
    const totalMs = T.t8_response_start - T.start

    // Timeline مفصّل لكل مرحلة
    const timeline = {
      total_ms: Math.round(totalMs),
      steps: {
        '1_client_init':     Math.round(T.t1_client_done - T.t1_client_start),
        '2_cookies':         Math.round(T.t2_cookies_done - T.t2_cookies_start),
        '3_sql_settings':    Math.round(T.t3_settings_done - T.t3_settings_start),
        '4_sql_slots_view':  Math.round(T.t4_slots_done - T.t4_slots_start),
        '5_sql_blocked':     Math.round(T.t5_blocked_done - T.t5_blocked_start),
        '6_sql_holds':       Math.round(T.t6_holds_done - T.t6_holds_start),
        '7_cpu_processing':  Math.round(T.t7_process_done - T.t7_process_start),
      },
      db_total_ms: Math.round(
        (T.t3_settings_done - T.t3_settings_start) +
        (T.t4_slots_done   - T.t4_slots_start)   +
        (T.t5_blocked_done - T.t5_blocked_start) +
        (T.t6_holds_done   - T.t6_holds_start)
      ),
      note: 'TIMING BUILD — يُحذف بعد التحليل',
    }

    console.log('[slots/timing]', JSON.stringify(timeline))

    return Response.json({
      slots: mergedSlots,
      window_days: windowDays,
      _timing: timeline,  // مؤقت — للتحليل فقط
    })
  } catch (err) {
    console.error('[slots]', err)
    return Response.json({ error: 'فشل جلب المواعيد' }, { status: 500 })
  }
}
