// ============================================================
// GET /api/booking/prices — جلب أسعار الملاعب من قاعدة البيانات مباشرة
// لا يحتاج auth — معلومات عامة للعملاء
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

// يضمن إن Next.js يجلب من Supabase مباشرة كل مرة بدون تخزين مؤقت
export const dynamic = 'force-dynamic'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    // جلب مفاتيح الأسعار من جدول settings
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'price_football_normal',
        'price_volleyball_normal',
        'price_multi_normal',
      ])

    if (error) throw error

    const prices: Record<string, number> = {
      football:   0,
      volleyball: 0,
      multi:      0,
    }

    data?.forEach(row => {
      if (row.key === 'price_football_normal')   prices.football   = Number(row.value) || 0
      if (row.key === 'price_volleyball_normal') prices.volleyball = Number(row.value) || 0
      if (row.key === 'price_multi_normal')      prices.multi      = Number(row.value) || 0
    })

    return Response.json({ prices }, { headers: NO_CACHE_HEADERS })
  } catch (err) {
    console.error('[prices]', err)
    return Response.json({ prices: { football: 0, volleyball: 0, multi: 0 } }, { headers: NO_CACHE_HEADERS })
  }
}
