// ============================================================
// PATCH /api/admin/credit-notes/[id]/approve — اعتماد إشعار (admin فقط)
// ============================================================
import { NextRequest } from 'next/server'
import { requireAdminRole } from '@/lib/auth'
import { approveCreditNote } from '@/lib/credit-notes'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRole(['admin']) // admin فقط
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    // جلب بيانات الإشعار قبل الاعتماد
    const { data: cn } = await admin
      .from('credit_notes')
      .select('credit_note_number, amount, invoice_id')
      .eq('id', id)
      .single()

    if (!cn) return Response.json({ error: 'الإشعار غير موجود' }, { status: 404 })

    await approveCreditNote(id, auth.session.userId, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'credit_notes',
      record_id:    id,
      action:       'update',
      performed_by: auth.session.userId,
      notes:        `اعتماد إشعار ائتمان ${cn.credit_note_number} بمبلغ ${cn.amount} ريال`,
    })

    return Response.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ'
    console.error('[PATCH /api/admin/credit-notes/[id]/approve]', err)
    return Response.json({ error: msg }, { status: 400 })
  }
}
