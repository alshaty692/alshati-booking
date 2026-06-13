// GET /api/settings — جلب الإعدادات العامة (للعميل)
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    data?.forEach(r => { if (r.key && r.value !== null) settings[r.key] = r.value })
    return Response.json({ settings })
  } catch {
    return Response.json({ settings: {} })
  }
}
