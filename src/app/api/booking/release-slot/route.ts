// ============================================================
// API Route — تحرير الحجز المؤقت
// يُستدعى عند: العودة لخطوة سابقة / تغيير الاختيار / مغادرة الصفحة
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ error: 'غير مصرّح' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // حذف كل الـ holds لهذا العميل
    await supabase
      .from('slot_holds')
      .delete()
      .eq('phone', phone)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[release-slot]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
