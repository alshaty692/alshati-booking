// ============================================================
// PATCH /api/admin/users/[id]  — تعديل بيانات موظف
// ============================================================
// الحماية: requirePermission('manage_users')
//
// الحقول القابلة للتعديل:
//   display_name  — الاسم المعروض
//   role_id       — الدور الجديد
//   is_active     — تفعيل / تعطيل
//
// حمايات خاصة:
//   - تعطيل الحساب (is_active → false): استدعاء revokeUserSessions
//   - تنزيل الدور (role_id يتغير): استدعاء revokeUserSessions
//   - حماية آخر أدمن: تُطبَّق من DB trigger — يُمرَّر الخطأ
//     للمستخدم برسالة عربية واضحة
//   - لا يحق للموظف تعديل حسابه الخاص عبر هذا الـ route
//     (تغيير كلمة المرور عبر /me/password)
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission, revokeUserSessions } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
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
    const { display_name, role_id, is_active } = body

    // ── التحقق من أن هناك شيئاً للتعديل ──────────────────────
    if (display_name === undefined && role_id === undefined && is_active === undefined) {
      return Response.json({ error: 'لا توجد بيانات للتعديل' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── جلب الموظف الحالي (للمقارنة + التحقق من وجوده) ────────
    const { data: currentUser, error: fetchError } = await admin
      .from('admin_users')
      .select('id, username, display_name, role_id, is_active')
      .eq('id', targetId)
      .maybeSingle()

    if (fetchError) {
      console.error('[PATCH /api/admin/users/[id]] fetch:', fetchError.message)
      return Response.json({ error: 'حدث خطأ أثناء جلب بيانات الموظف' }, { status: 500 })
    }
    if (!currentUser) {
      return Response.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    // ── بناء التحديث ──────────────────────────────────────────
    const updates: Record<string, unknown> = {}

    if (display_name !== undefined) {
      const trimmed = String(display_name).trim()
      if (!trimmed) return Response.json({ error: 'الاسم المعروض لا يمكن أن يكون فارغاً' }, { status: 400 })
      updates.display_name = trimmed
    }

    if (role_id !== undefined) {
      if (typeof role_id !== 'string') {
        return Response.json({ error: 'role_id غير صالح' }, { status: 400 })
      }
      // التحقق من وجود الدور
      const { data: role } = await admin.from('roles').select('id, name').eq('id', role_id).maybeSingle()
      if (!role) return Response.json({ error: 'الدور المحدد غير موجود' }, { status: 400 })
      updates.role_id = role_id
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return Response.json({ error: 'is_active يجب أن يكون true أو false' }, { status: 400 })
      }
      updates.is_active = is_active
    }

    // ── التنفيذ ────────────────────────────────────────────────
    const { data: updated, error: updateError } = await admin
      .from('admin_users')
      .update(updates)
      .eq('id', targetId)
      .select('id, username, display_name, role_id, is_active')
      .single()

    if (updateError) {
      console.error('[PATCH /api/admin/users/[id]] update:', updateError.message)

      // ── ترجمة أخطاء DB trigger (حماية آخر أدمن) ───────────
      const raw = updateError.message
      if (raw.includes('last_admin') || raw.includes('آخر') || raw.includes('يجب أن يبقى') || raw.includes('P0001')) {
        return Response.json({
          error: 'لا يمكن تعطيل الحساب أو تغيير دور آخر مشرف — يجب أن يبقى مشرف واحد على الأقل نشطاً',
        }, { status: 422 })
      }

      return Response.json({ error: 'فشل تحديث بيانات الموظف' }, { status: 500 })
    }

    // ── revokeUserSessions عند تعطيل أو تنزيل دور ────────────
    const wasDeactivated = is_active === false && currentUser.is_active === true
    const roleChanged    = role_id !== undefined && role_id !== currentUser.role_id

    if (wasDeactivated || roleChanged) {
      const revoke = await revokeUserSessions(targetId)
      if (!revoke.success) {
        // التحديث نجح لكن إلغاء الجلسات فشل — نُسجّل تحذيراً
        console.warn('[PATCH /api/admin/users/[id]] revokeUserSessions failed:', revoke.error)
      }
    }

    // ── Audit Log ────────────────────────────────────────────
    const changeDesc = Object.keys(updates)
      .map(k => `${k}: ${JSON.stringify(updates[k])}`)
      .join(', ')
    await admin.from('audit_log').insert({
      table_name:   'admin_users',
      record_id:    targetId,
      action:       'update',
      performed_by: auth.userId,
      notes:        `تعديل موظف ${currentUser.username}: ${changeDesc}`,
    })

    return Response.json({ success: true, user: updated })
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
