// POST /api/admin/codes — إنشاء كود جديد

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json()

    const { code, code_type, discount_type, discount_value, court_id, max_uses, expires_at } = body

    // التحقق من الحقول المطلوبة
    if (!code || !code_type || !discount_type) {
      return Response.json(
        { error: 'الحقول المطلوبة: الكود، نوع الكود، نوع الخصم' },
        { status: 400 }
      )
    }

    // إذا كان الخصم مجاني، القيمة = 100
    const finalDiscountValue = discount_type === 'free' ? 100 : (discount_value ?? 0)

    const { data, error } = await supabase
      .from('codes')
      .insert({
        code: code.toUpperCase(),
        code_type,
        discount_type,
        discount_value: finalDiscountValue,
        court_id: court_id || null,
        max_uses: max_uses || null,
        expires_at: expires_at || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ code: data })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
