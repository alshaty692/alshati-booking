// ============================================================
// DELETE /api/admin/commissions/[id] — حذف عمولة مُخصَّصة
// ============================================================
// حماية: لا يُسمح بحذف عمولة مُدرجة في راتب مصروف
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_payroll')
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin  = createAdminClient()

    // جلب بيانات العمولة أولاً
    const { data: commission, error: fetchErr } = await admin
      .from('commissions')
      .select('id, included_in_salary_payment_id')
      .eq('id', id)
      .single()

    if (fetchErr || !commission) {
      return Response.json({ error: 'العمولة غير موجودة' }, { status: 404 })
    }

    // ── حماية: رفض الحذف لو مُدرجة براتب مصروف ──────────────
    if (commission.included_in_salary_payment_id) {
      return Response.json(
        {
          error:  'لا يمكن حذف هذه العمولة — تم إدراجها في راتب مصروف فعلياً',
          detail: 'لتصحيح الخطأ، عدّل دورة الراتب المرتبطة أو أضف تسوية يدوية',
        },
        { status: 400 }
      )
    }

    // حذف العمولة
    const { error: deleteErr } = await admin
      .from('commissions')
      .delete()
      .eq('id', id)

    if (deleteErr) throw deleteErr

    return Response.json({ success: true })
  } catch (err) {
    console.error('[commissions/id/delete]', err)
    return Response.json({ error: 'حدث خطأ أثناء حذف العمولة' }, { status: 500 })
  }
}
