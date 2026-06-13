// GET  /api/admin/settings — جلب كل الإعدادات (مع Auth)
// PATCH /api/admin/settings — تحديث إعداد أو مجموعة إعدادات

import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // يقبل: { key, value } أو { updates: [{key,value},...] }
    const pairs: { key: string; value: string }[] = body.updates
      ? body.updates
      : [{ key: body.key, value: body.value }]

    for (const pair of pairs) {
      await supabase
        .from('settings')
        .upsert({ key: pair.key, value: pair.value }, { onConflict: 'key' })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
