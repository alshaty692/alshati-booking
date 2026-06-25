// ============================================================
// Rate Limiting — مبني على Supabase (بدون خدمة خارجية)
// ============================================================
// الاستخدام:
//   const limited = await isRateLimited('otp:0512345678', 3, 10 * 60 * 1000)
//   if (limited) return Response.json({ error: '...' }, { status: 429 })
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

/**
 * يتحقق هل تجاوز المفتاح الحد المسموح خلال النافذة الزمنية.
 * إذا لم يتجاوز — يسجّل المحاولة الحالية أيضاً.
 *
 * @param key          معرّف المحاولة، مثل "otp:0512345678" أو "code:1.2.3.4"
 * @param maxAttempts  أقصى عدد محاولات مسموح بها
 * @param windowMs     النافذة الزمنية بالميلي ثانية (مثل 10 * 60 * 1000 = 10 دقائق)
 * @returns            true = وصل للحد → ارفض الطلب | false = مسموح → تابع
 */
export async function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  try {
    const supabase  = createAdminClient()
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    // عدّ المحاولات الموجودة في النافذة الزمنية
    const { count, error: countErr } = await supabase
      .from('rate_limit_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart)

    if (countErr) {
      // عند خطأ في DB → لا نوقف الخدمة، نسمح بالمرور (fail-open)
      console.error('[rate-limit] count error:', countErr.message)
      return false
    }

    if ((count ?? 0) >= maxAttempts) {
      return true // وصل للحد — ارفض
    }

    // سجّل المحاولة الحالية
    const { error: insertErr } = await supabase
      .from('rate_limit_attempts')
      .insert({ key })

    if (insertErr) {
      console.error('[rate-limit] insert error:', insertErr.message)
    }

    return false // لم يصل للحد — اسمح
  } catch (err) {
    // خطأ غير متوقع → fail-open (لا نوقف الخدمة)
    console.error('[rate-limit] unexpected error:', err)
    return false
  }
}

/**
 * يُستدعى من cron job لتنظيف السجلات القديمة وتجنب تضخم الجدول.
 * احذف كل السجلات الأقدم من maxAgeMs (الافتراضي: 24 ساعة)
 */
export async function cleanupRateLimitAttempts(
  maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    const supabase  = createAdminClient()
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString()

    const { count, error } = await supabase
      .from('rate_limit_attempts')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)

    if (error) {
      console.error('[rate-limit] cleanup error:', error.message)
      return 0
    }

    return count ?? 0
  } catch (err) {
    console.error('[rate-limit] cleanup unexpected error:', err)
    return 0
  }
}

/**
 * مساعد: يستخرج IP المستخدم من الطلب بشكل آمن
 * (يدعم Vercel's x-forwarded-for)
 */
export function getClientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
