// GET  /api/admin/settings — جلب كل الإعدادات (admin/editor فقط)
// PATCH /api/admin/settings — تحديث إعداد أو مجموعة إعدادات (admin/editor فقط)

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'

export async function GET() {
  try {
    const auth = await requirePermission('manage_settings')
    if (!auth.ok) return auth.response

    // نستخدم Admin Client لجلب كل الإعدادات بما فيها الحساسة
    const supabase = createAdminClient()
    const { data } = await supabase.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    data?.forEach(r => { if (r.key && r.value !== null) settings[r.key] = r.value })
    return Response.json({ settings })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // 🔴 حرج — تعديل الإعدادات يشمل الأسعار والبنك وغيرها
    const auth = await requirePermission('manage_settings')
    if (!auth.ok) return auth.response

    const body = await req.json()

    // يقبل: { key, value } أو { updates: [{key,value},...] }
    const pairs: { key: string; value: string }[] = body.updates
      ? body.updates
      : [{ key: body.key, value: body.value }]

    const adminSupabase = createAdminClient()
    for (const pair of pairs) {
      await adminSupabase
        .from('settings')
        .upsert({ key: pair.key, value: pair.value }, { onConflict: 'key' })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
