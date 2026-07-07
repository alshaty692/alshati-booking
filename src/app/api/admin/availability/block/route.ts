// POST /api/admin/availability/block — حجب فترة
// DELETE /api/admin/availability/block — إلغاء حجب فترة

import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const { court_id, date, period_number, reason } = await req.json()
    if (!court_id || !date || !period_number) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({ court_id, date, period_number, reason: reason ?? null, blocked_by: auth.userId })
      .select()
      .single()

    if (error) {
      // UNIQUE violation → already blocked
      if (error.code === '23505') {
        return Response.json({ error: 'Already blocked' }, { status: 409 })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const { court_id, date, period_number } = await req.json()
    if (!court_id || !date || !period_number) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('court_id', court_id)
      .eq('date', date)
      .eq('period_number', period_number)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
