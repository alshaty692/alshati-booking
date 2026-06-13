// ============================================================
// API Route — التحقق من كود الخصم وحساب السعر
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { court_id, code } = await request.json()

    if (!court_id) {
      return Response.json({ error: 'يرجى اختيار الملعب أولاً' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // استدعاء Function من Supabase لحساب السعر
    const { data, error } = await supabase.rpc('calculate_price', {
      p_court_id: court_id,
      p_code: code || null,
    })

    if (error) throw error

    if (data?.error) {
      return Response.json({ error: data.error }, { status: 400 })
    }

    return Response.json(data)
  } catch (err) {
    console.error('[validate-code]', err)
    return Response.json({ error: 'حدث خطأ في التحقق من الكود' }, { status: 500 })
  }
}
