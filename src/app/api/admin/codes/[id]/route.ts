// GET    /api/admin/codes/[id] — جلب كود واحد
// PATCH  /api/admin/codes/[id] — تحديث كود
// DELETE /api/admin/codes/[id] — حذف كود

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    // 🔴 حرج — جلب بيانات كود خصم كامل (للتعديل)
    const auth = await requirePermission('manage_codes')
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('codes')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return Response.json({ error: 'الكود غير موجود' }, { status: 404 })
    }

    return Response.json({ code: data })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // 🔴 حرج — تعديل كود خصم
    const auth = await requirePermission('manage_codes')
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const supabase = createAdminClient()
    const body = await req.json()

    // حقول قابلة للتحديث
    const allowedFields = [
      'code', 'code_type', 'discount_type', 'discount_value',
      'court_id', 'max_uses', 'expires_at', 'is_active',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // رفع الكود لأحرف كبيرة
    if (typeof updates.code === 'string') {
      updates.code = (updates.code as string).toUpperCase()
    }

    // إذا كان الخصم مجاني
    if (updates.discount_type === 'free') {
      updates.discount_value = 100
    }

    // تحويل القيم الفارغة
    if (updates.court_id === '') updates.court_id = null
    if (updates.max_uses === '' || updates.max_uses === 0) updates.max_uses = null
    if (updates.expires_at === '') updates.expires_at = null

    const { data, error } = await supabase
      .from('codes')
      .update(updates)
      .eq('id', id)
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

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    // 🔴 حرج — حذف كود خصم نهائياً
    const auth = await requirePermission('manage_codes')
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('codes')
      .delete()
      .eq('id', id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
