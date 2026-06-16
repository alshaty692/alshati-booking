import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // التحقق من مفتاح الكرون
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  return Response.json({
    success: true,
    expired_count: expired?.length ?? 0,
    timestamp: new Date().toISOString(),
  })
}
