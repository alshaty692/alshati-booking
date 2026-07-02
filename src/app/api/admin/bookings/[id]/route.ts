// ============================================================
// DELETE /api/admin/bookings/[id]
// حذف ناعم (Soft Delete) لحجز ملغى/مرفوض/منتهي
// لا يُسمح بحذف حجز مؤكد أو معلق
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

const DELETABLE_STATUSES = ['cancelled', 'rejected', 'expired'] as const

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ── مصادقة ───────────────────────────────────────────────
    const auth = await requirePermission('soft_delete_booking')
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    // ── جلب الحجز ────────────────────────────────────────────
    const { data: booking, error: fetchError } = await admin
      .from('bookings')
      .select('id, status, deleted_at, customer_name, booking_date, court_id, period_number')
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      return Response.json({ error: 'الحجز غير موجود' }, { status: 404 })
    }

    if (booking.deleted_at) {
      return Response.json({ error: 'الحجز محذوف بالفعل' }, { status: 400 })
    }

    // ── التحقق من الحالة ─────────────────────────────────────
    if (!(DELETABLE_STATUSES as readonly string[]).includes(booking.status)) {
      return Response.json({
        error: `لا يمكن حذف حجز بحالة "${booking.status}". يُسمح بالحذف فقط للحجوزات: ملغاة، مرفوضة، منتهية.`,
      }, { status: 400 })
    }

    // ── تطبيق الحذف الناعم ───────────────────────────────────
    const { error: updateError } = await admin
      .from('bookings')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[admin/bookings/[id] DELETE]', updateError)
      throw updateError
    }

    // ── تسجيل في audit_log ───────────────────────────────────
    await admin.from('audit_log').insert({
      table_name: 'bookings',
      record_id:  id,
      action:     'soft_delete',
      performed_by: user.id,
      notes: `حذف ناعم للحجز (${booking.customer_name} — ${booking.booking_date})`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings/[id] DELETE]', err)
    return Response.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
