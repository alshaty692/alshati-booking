// ============================================================
// GET /api/admin/bookings/[id]/pre-delete-check
// فحص ما قبل الحذف النهائي — يُستدعى قبل فتح المودال
// ============================================================
import { NextRequest } from 'next/server'
import { requireAdminRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { preDeleteCheck } from '@/lib/bookings'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // admin فقط (editor لا يحذف نهائياً)
    const auth = await requireAdminRole(['admin'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin  = createAdminClient()

    const result = await preDeleteCheck(id, admin)
    return Response.json(result)
  } catch (err) {
    console.error('[pre-delete-check]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
