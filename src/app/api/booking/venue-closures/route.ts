// GET /api/booking/venue-closures — إيقافات الملاعب النشطة (للعميل)
// قراءة فقط، بدون مصادقة — يُرجع الإيقافات الحالية والمستقبلية فقط
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // نُرجع الإيقافات التي لم تنته بعد فقط (end_date >= اليوم)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })

    const { data: closures, error } = await supabase
      .from('venue_closures')
      .select('court_id, start_date, end_date, reason')
      .gte('end_date', today)
      .order('start_date')

    if (error) throw error

    return Response.json({ closures: closures ?? [] })
  } catch {
    // في حالة الخطأ نُرجع قائمة فارغة — لا نكسر صفحة الحجز
    return Response.json({ closures: [] })
  }
}
