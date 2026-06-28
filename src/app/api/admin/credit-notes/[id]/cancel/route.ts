// ============================================================
// PATCH /api/admin/credit-notes/[id]/cancel — إلغاء إشعار
// يعمل على draft فقط — الإشعارات المعتمدة لا تُلغى
// ============================================================
import { NextRequest } from 'next/server'
import { requireAdminRole } from '@/lib/auth'
import { cancelCreditNote } from '@/lib/credit-notes'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRole(['admin', 'editor'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const cancel_reason = body?.cancel_reason as string | undefined

    const admin = createAdminClient()

    // جلب بيانات الإشعار
    const { data: cn } = await admin
      .from('credit_notes')
      .select('credit_note_number, amount, status')
      .eq('id', id)
      .single()

    if (!cn) return Response.json({ error: 'الإشعار غير موجود' }, { status: 404 })

    await cancelCreditNote(id, auth.session.userId, cancel_reason, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'credit_notes',
      record_id:    id,
      action:       'update',
      performed_by: auth.session.userId,
      notes:        `إلغاء إشعار ائتمان ${cn.credit_note_number}${cancel_reason ? ` — السبب: ${cancel_reason}` : ''}`,
    })

    return Response.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ'
    console.error('[PATCH /api/admin/credit-notes/[id]/cancel]', err)
    return Response.json({ error: msg }, { status: 400 })
  }
}
