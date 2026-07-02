// ============================================================
// POST /api/admin/bookings/[id]/delete-permanently
// الحذف النهائي للحجز — admin فقط
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'
import { deleteBookingPermanently } from '@/lib/bookings'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // admin فقط — editor ممنوع
    const auth = await requirePermission('hard_delete_booking')
    if (!auth.ok) return auth.response

    const { id } = await params

    const body = await request.json()
    const { reason, blockSlot } = body as { reason?: string; blockSlot?: boolean }

    if (!reason?.trim()) {
      return Response.json({ error: 'سبب الحذف مطلوب' }, { status: 400 })
    }

    const admin  = createAdminClient()
    const result = await deleteBookingPermanently({
      bookingId:   id,
      reason:      reason.trim(),
      blockSlot:   blockSlot ?? true,
      adminUserId: auth.userId,
      supabase:    admin,
    })

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 })
    }

    return Response.json({ success: true, warning: result.warning ?? null })
  } catch (err) {
    console.error('[delete-permanently]', err)
    return Response.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
