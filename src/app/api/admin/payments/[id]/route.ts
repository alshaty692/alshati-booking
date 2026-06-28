// ============================================================
// DELETE /api/admin/payments/[id] — حذف دفعة خاطئة (admin فقط)
// ============================================================
import { NextRequest } from 'next/server'
import { requireAdminRole } from '@/lib/auth'
import { deletePayment } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRole(['admin']) // admin فقط
    if (!auth.ok) return auth.response

    const { id } = await params

    const admin = createAdminClient()

    // جلب بيانات الدفعة قبل الحذف (للـ audit)
    const { data: payment } = await admin
      .from('payments')
      .select('invoice_id, amount, payment_method')
      .eq('id', id)
      .single()

    if (!payment) return Response.json({ error: 'الدفعة غير موجودة' }, { status: 404 })

    await deletePayment(id, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'payments',
      record_id:    id,
      action:       'delete',
      performed_by: auth.session.userId,
      notes:        `حذف دفعة ${payment.amount} ريال (${payment.payment_method}) من الفاتورة ${payment.invoice_id}`,
    })

    return Response.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ'
    console.error('[DELETE /api/admin/payments/[id]]', err)
    return Response.json({ error: msg }, { status: 400 })
  }
}
