// ============================================================
// API Route — إلغاء تلقائي للحجوزات المنتهية (Vercel Cron)
// يُشغَّل يومياً بواسطة Vercel Cron (vercel.json)
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'
import { cleanupRateLimitAttempts } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // ── SEC-04: التحقق من CRON_SECRET ──────────────────────────
  const secret = process.env.CRON_SECRET

  // حماية مزدوجة: لو CRON_SECRET غير معرّف في البيئة، يُرفض فوراً
  // يمنع قبول "Bearer undefined" بالخطأ
  if (!secret) {
    console.error('[cron/cancel-expired] CRON_SECRET غير معرّف في متغيرات البيئة')
    return Response.json(
      { error: 'Server misconfiguration — CRON_SECRET not set' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ────────────────────────────────────────────────────────────

  const supabase = createAdminClient()

  // جلب مدة انتهاء الحجز المعلّق من الإعدادات (الافتراضي 24 ساعة)
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['pending_expiry_hours'])

  const expiryHours =
    Number(settings?.find((s) => s.key === 'pending_expiry_hours')?.value) || 24

  // إلغاء الحجوزات المعلّقة المنتهية
  const cutoff = new Date(Date.now() - expiryHours * 3600000).toISOString()

  const { data: expired } = await supabase
    .from('bookings')
    .update({
      status: 'expired',
      internal_note: 'انتهت مهلة رفع الإيصال — إلغاء تلقائي',
    })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  // تنظيف حجوزات السلوت المنتهية
  await supabase
    .from('slot_holds')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // تنظيف سجلات Rate Limiting القديمة (أقدم من 24 ساعة)
  const rateLimitCleaned = await cleanupRateLimitAttempts()

  return Response.json({
    success: true,
    expired_count: expired?.length ?? 0,
    rate_limit_cleaned: rateLimitCleaned,
    timestamp: new Date().toISOString(),
  })
}
