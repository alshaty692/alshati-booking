// GET /api/admin/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { slots, blocked, settings }

import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    if (!from || !to) {
      return Response.json({ error: 'Missing from/to params' }, { status: 400 })
    }

    // 1) الفترات المتاحة من view
    const { data: slots, error: slotsError } = await supabase
      .from('available_slots')
      .select('*')
      .gte('date', from)
      .lte('date', to)

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
      .in('key', ['closure_active', 'closure_reason', 'closure_return_date', 'closure_message'])

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
  } catch (e) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
