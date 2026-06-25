// ============================================================
// مساعدات المصادقة والصلاحيات — مركز حي الشاطئ
// ============================================================
// requireAdminRole()  — يُستخدم في بداية كل API route إداري
// يتحقق من:
//   1. المستخدم مسجّل دخول (Supabase Auth)
//   2. موجود في جدول admin_users بدور admin أو editor
// يُرجع:
//   - { user, role } عند النجاح
//   - Response بـ 401/403 عند الفشل
// ============================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'

export type AdminRole = 'admin' | 'editor' | 'viewer'

export interface AdminSession {
  userId:    string
  userEmail: string
  role:      AdminRole
}

/**
 * يتحقق من صلاحية المستخدم الإداري.
 * يُرجع { ok: true, session } عند النجاح أو { ok: false, response } عند الفشل.
 *
 * @param allowedRoles  الأدوار المسموح بها — افتراضي ['admin', 'editor']
 *
 * مثال الاستخدام:
 *   const auth = await requireAdminRole(request)
 *   if (!auth.ok) return auth.response
 *   const { session } = auth   // session.userId, session.role
 */
export async function requireAdminRole(
  allowedRoles: AdminRole[] = ['admin', 'editor']
): Promise<
  | { ok: true;  session: AdminSession }
  | { ok: false; response: Response }
> {
  // 1. فحص تسجيل الدخول
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: Response.json(
        { error: 'غير مسجّل دخول' },
        { status: 401 }
      ),
    }
  }

  // 2. فحص الدور في جدول admin_users
  const adminSupabase = createAdminClient()
  const { data: adminUser, error: roleError } = await adminSupabase
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (roleError || !adminUser) {
    return {
      ok: false,
      response: Response.json(
        { error: 'غير مخوّل — الحساب غير موجود في قائمة المشرفين' },
        { status: 403 }
      ),
    }
  }

  // 3. فحص أن الدور ضمن الأدوار المسموح بها
  if (!allowedRoles.includes(adminUser.role as AdminRole)) {
    return {
      ok: false,
      response: Response.json(
        { error: `غير مخوّل — الدور '${adminUser.role}' لا يملك هذه الصلاحية` },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    session: {
      userId:    user.id,
      userEmail: user.email ?? '',
      role:      adminUser.role as AdminRole,
    },
  }
}
