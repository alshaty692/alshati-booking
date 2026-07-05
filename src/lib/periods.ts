// ============================================================
// أوقات بداية الفترات — مصدر الحقيقة الوحيد
// أي تغيير في جدول الفترات يُعدَّل هنا فقط.
// ============================================================

/**
 * ساعة بداية كل فترة بالتوقيت المحلي (24h)
 *   1 → 5م  (17:00)
 *   2 → 7م  (19:00)
 *   3 → 9م  (21:00)
 */
export const PERIOD_START_HOUR: Record<number, number> = {
  1: 17,
  2: 19,
  3: 21,
}

/**
 * هل بدأ وقت الفترة؟
 * تقارن ساعة البداية بالساعة الحالية في الـ Date المُمرَّرة.
 * استخدم nowSA (محسوب بتوقيت الرياض) وليس new Date() مباشرة.
 */
export function isPeriodStarted(periodNumber: number, nowLocal: Date): boolean {
  const startHour = PERIOD_START_HOUR[periodNumber]
  if (startHour === undefined) return false
  return nowLocal.getHours() >= startHour
}
