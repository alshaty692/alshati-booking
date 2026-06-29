// ============================================================
// lib/closure.ts — Single Source of Truth لحالة الإغلاق الكامل
// يُقرأ من DB مباشرة (لا كاش) — نتيجة حية في كل استدعاء
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

export interface ClosureState {
  /** الإغلاق الكامل مُفعَّل من الإعدادات؟ */
  isActive: boolean
  /** الإغلاق فوري الآن؟ (isActive + (لا تاريخ أو تاريخ <= اليوم)) */
  isFullyClosedNow: boolean
  /** تاريخ البداية في المستقبل (إغلاق مجدول) أو null */
  scheduledStartDate: Date | null
  /** سلسلة التاريخ بصيغة YYYY-MM-DD للمقارنة السريعة */
  scheduledStartISO: string | null
  title: string
  message: string
}

export async function getClosureState(): Promise<ClosureState> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'closure_full_active',
      'closure_full_start',
      'closure_full_title',
      'closure_full_message',
    ])

  const s: Record<string, string> = {}
  data?.forEach(r => { if (r.key) s[r.key] = r.value ?? '' })

  const title   = s['closure_full_title']   || 'المنشأة مغلقة مؤقتاً'
  const message = s['closure_full_message'] || 'نعتذر عن الإغلاق المؤقت، سنعود قريباً بإذن الله.'

  // غير مُفعَّل
  if (s['closure_full_active'] !== 'true') {
    return { isActive: false, isFullyClosedNow: false, scheduledStartDate: null, scheduledStartISO: null, title, message }
  }

  const startStr = s['closure_full_start']?.trim()

  // مُفعَّل بلا تاريخ → إغلاق فوري
  if (!startStr) {
    return { isActive: true, isFullyClosedNow: true, scheduledStartDate: null, scheduledStartISO: null, title, message }
  }

  // احسب "اليوم" بتوقيت السعودية (منتصف الليل)
  const nowSA = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
  nowSA.setHours(0, 0, 0, 0)

  const startDate = new Date(startStr + 'T00:00:00')

  if (startDate <= nowSA) {
    // التاريخ وصل أو مضى → إغلاق فوري
    return { isActive: true, isFullyClosedNow: true, scheduledStartDate: startDate, scheduledStartISO: startStr, title, message }
  }

  // التاريخ في المستقبل → إغلاق مجدول (الموقع يشتغل، لكن التواريخ من هذا التاريخ مغلقة)
  return { isActive: true, isFullyClosedNow: false, scheduledStartDate: startDate, scheduledStartISO: startStr, title, message }
}
