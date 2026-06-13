// ============================================================
// API Route — جلب الفترات المتاحة
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    // جلب الفترات المتاحة من الـ View
    const { data: slots, error } = await supabase
      .from('available_slots')
      .select('*')
      .order('day_date')
      .order('court_id')
      .order('period_number')

    if (error) throw error

    return Response.json({ slots })
  } catch (err) {
    console.error('[slots]', err)
    return Response.json({ error: 'فشل جلب المواعيد' }, { status: 500 })
  }
}
