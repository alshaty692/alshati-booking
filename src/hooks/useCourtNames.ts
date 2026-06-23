'use client'

import { useEffect, useState } from 'react'

/**
 * أسماء الملاعب الافتراضية — تُستخدم فقط كـ fallback
 * أثناء تحميل الإعدادات أو لو فشل الاتصال
 */
const COURT_IDS = ['football', 'volleyball', 'multi'] as const
const DEFAULT_NAMES: Record<string, string> = {
  football:   'كرة القدم',
  volleyball: 'الكرة الطائرة',
  multi:      'الملعب المتعدد',
}
const COURT_ICONS: Record<string, string> = {
  football: '⚽',
  volleyball: '🏐',
  multi: '🏀',
}

export type CourtEntry = {
  id: string
  label: string
  icon: string
}

/**
 * يجلب أسماء الملاعب من إعدادات قاعدة البيانات (venue_1_name, venue_2_name, venue_3_name)
 * ويُرجع:
 *   - courts: مصفوفة { id, label, icon }
 *   - courtMap: Record<string, string> للبحث السريع بالـ id
 *   - getCourtName(id): دالة تُرجع الاسم
 *   - loading: حالة التحميل
 *
 * المصدر الوحيد للحقيقة (Single Source of Truth) لأسماء الملاعب في كل الصفحات
 */
export function useCourtNames(apiPath = '/api/settings') {
  const [courtMap, setCourtMap] = useState<Record<string, string>>(DEFAULT_NAMES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiPath)
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        const s = json.settings as Record<string, string> | undefined
        if (s && !cancelled) {
          setCourtMap({
            football:   s.venue_1_name || DEFAULT_NAMES.football,
            volleyball: s.venue_2_name || DEFAULT_NAMES.volleyball,
            multi:      s.venue_3_name || DEFAULT_NAMES.multi,
          })
        }
      } catch {
        // fallback — الأسماء الافتراضية تبقى
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiPath])

  const courts: CourtEntry[] = COURT_IDS.map(id => ({
    id,
    label: courtMap[id] ?? DEFAULT_NAMES[id],
    icon:  COURT_ICONS[id] ?? '',
  }))

  const getCourtName = (id: string) => courtMap[id] ?? DEFAULT_NAMES[id] ?? id

  return { courts, courtMap, getCourtName, loading }
}

/**
 * نسخة server-side — تجلب مباشرة من Supabase بدون hook
 * تُستخدم في Server Components و API Routes
 */
export async function fetchCourtNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Record<string, string>> {
  const keys = ['venue_1_name', 'venue_2_name', 'venue_3_name']
  const { data } = await supabase.from('settings').select('key, value').in('key', keys)
  const map: Record<string, string> = { ...DEFAULT_NAMES }
  data?.forEach((r: { key: string; value: string }) => {
    if (r.key === 'venue_1_name' && r.value) map.football   = r.value
    if (r.key === 'venue_2_name' && r.value) map.volleyball = r.value
    if (r.key === 'venue_3_name' && r.value) map.multi      = r.value
  })
  return map
}
