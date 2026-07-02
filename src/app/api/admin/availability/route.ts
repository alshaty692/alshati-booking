// GET /api/admin/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { slots, blocked, settings } — admin/editor/viewer

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    if (!from || !to) {
      return Response.json({ error: 'Missing from/to params' }, { status: 400 })
    }

    // نستخدم Admin Client لتجاوز RLS
    const supabase = createAdminClient()

    // 1) الفترات المتاحة من view
    const { data: slots, error: slotsError } = await supabase
      .from('available_slots')
      .select('*')
      .gte('day_date', from)
      .lte('day_date', to)

    // 2) الفترات المحجوبة من المدير
    const { data: blocked, error: blockedError } = await supabase
      .from('blocked_slots')
      .select('*')
      .gte('date', from)
      .lte('date', to)

    // 3) الإعدادات (إغلاق)
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['closure_active', 'closure_reason', 'closure_return_date', 'closure_message',
                   'closure_full_active', 'closure_full_start', 'closure_full_message'])

    const settings: Record<string, string> = {}
    settingsData?.forEach(r => { if (r.key) settings[r.key] = r.value ?? '' })

    return Response.json({
      slots:   slots   ?? [],
      blocked: blocked ?? [],
      settings,
      errors: {
        slots:   slotsError?.message   ?? null,
        blocked: blockedError?.message ?? null,
      }
    })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
