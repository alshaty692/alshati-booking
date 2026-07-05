// ============================================================
// POST /api/admin/users/[id]/reset-password
// ============================================================
// الحماية: requirePermission('manage_users')
// يُعيد تعيين كلمة مرور أي موظف (بواسطة المشرف)
// body: { new_password }
// ──────────────────────────────────────────────────────────
// لا يتحقق من كلمة المرور الحالية (هذا حق المشرف الصريح)
// بعد الإعادة: جلسات الموظف تبقى — لو أردت إلغاءها ابعث
// is_active: false ثم true، أو استخدم PATCH /[id] مباشرة
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const { id: targetId } = await params

    if (!targetId) {
      return Response.json({ error: 'معرّف الموظف مطلوب' }, { status: 400 })
    }

    const body = await request.json()
    const { new_password } = body

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return Response.json({ error: 'كلمة المرور الجديدة مطلوبة (8 أحرف على الأقل)' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── التحقق من وجود الموظف ────────────────────────────────
    const { data: targetUser } = await admin
      .from('admin_users')
      .select('id, username')
      .eq('id', targetId)
      .maybeSingle()

    if (!targetUser) {
      return Response.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    // ── إعادة تعيين كلمة المرور عبر Auth Admin API ───────────
    const { error: resetError } = await admin.auth.admin.updateUserById(targetId, {
      password: new_password,
    })

    if (resetError) {
      console.error('[POST /api/admin/users/[id]/reset-password]', resetError.message)
      return Response.json({ error: 'فشل إعادة تعيين كلمة المرور — حاول مجدداً' }, { status: 400 })
    }

    // ── Audit Log ────────────────────────────────────────────
    await admin.from('audit_log').insert({
      table_name:   'admin_users',
      record_id:    targetId,
      action:       'update',
      performed_by: auth.userId,
      notes:        `إعادة تعيين كلمة مرور الموظف: ${targetUser.username}`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/users/[id]/reset-password]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
