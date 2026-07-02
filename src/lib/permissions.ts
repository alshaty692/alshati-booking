// ============================================================
// lib/permissions.ts — نظام الصلاحيات الديناميكي (المرحلة ٢)
// ============================================================
//
// المبدأ: مفتاح الصلاحية موجود في role_permissions = مسموح،
//         غائب أو is_active=false = ممنوع (رفض افتراضي).
//
// الأداء: استعلام واحد بـ JOIN على عمودَين مفهرسَين — بلا cache.
//         السبب: is_active=false يجب أن يُرفض فوراً، ولا قيمة
//         للـ 30s cache مقابل هذا الضمان الأمني.
//         راجع تقييم الأداء بالخطوة ٠ من المرحلة ٢.
//
// استخدام requireAdminRole() القديم:
//   تبقى في lib/auth.ts غير مستخدمة حتى تنتهي المرحلة ٢
//   كاملاً ويُتأكد من كل الـ 23 نقطة. تُحذف عند نهاية الجلسة.
// ============================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── نوع النتيجة المُعادة من requirePermission ───────────────

export type PermissionResult =
  | { ok: true;  userId: string }
  | { ok: false; response: Response }

// ============================================================
// hasPermission()
// ============================================================
// يتحقق إن المستخدم يملك صلاحية محددة، عبر JOIN واحد:
//
//   SELECT 1
//   FROM   admin_users au
//   JOIN   role_permissions rp ON rp.role_id = au.role_id
//   WHERE  au.id            = $userId
//     AND  au.is_active     = true
//     AND  rp.permission_key = $key
//
// ─ وجود صف   = true  (مسموح)
// ─ غياب صف   = false (ممنوع — أي من: is_active=false، role_id=null،
//                        المفتاح غير موجود للدور، المستخدم غير موجود)
// ─ خطأ DB    = false (fail-closed — الرفض الافتراضي)
// ============================================================

export async function hasPermission(
  userId: string,
  permissionKey: string
): Promise<boolean> {
  try {
    const admin = createAdminClient()

    // ── الاستعلام ١: role_id + is_active من admin_users ──────
    // لا علاقة FK مباشرة بين admin_users و role_permissions
    // (العلاقة عبر جدول roles وسيط) — نستعلم على خطوتين.
    const { data: adminRow, error: e1 } = await admin
      .from('admin_users')
      .select('role_id, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (e1) {
      console.error('[permissions] hasPermission admin_users error:', e1.message)
      return false  // fail-closed
    }
    if (!adminRow)             return false  // مستخدم غير موجود
    if (!adminRow.is_active)   return false  // حساب معطَّل — رفض فوري
    if (!adminRow.role_id)     return false  // بدون دور مسند

    // ── الاستعلام ٢: وجود المفتاح لهذا الدور ─────────────────
    const { data: permRow, error: e2 } = await admin
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', adminRow.role_id)
      .eq('permission_key', permissionKey)
      .maybeSingle()

    if (e2) {
      console.error('[permissions] hasPermission role_permissions error:', e2.message)
      return false  // fail-closed
    }

    return permRow !== null  // وجود الصف = مسموح، غيابه = ممنوع
  } catch (err) {
    console.error('[permissions] hasPermission unexpected error:', err)
    return false  // fail-closed
  }
}

// ============================================================
// requirePermission()
// ============================================================
// يُستخدم في بداية كل API route بدلاً من requireAdminRole().
//
// مثال الاستخدام:
//   const auth = await requirePermission('view_reports')
//   if (!auth.ok) return auth.response
//   // auth.userId متاح للكود التالي
//
// تسلسل الفحص:
//   1. supabase.auth.getUser()  — دائماً، لا cache على JWT
//   2. hasPermission()          — JOIN مباشر بلا cache
//   3. false → 403 برسالة واضحة
//   4. true  → { ok: true, userId }
// ============================================================

export async function requirePermission(
  permissionKey: string
): Promise<PermissionResult> {
  // ── ١. فحص تسجيل الدخول ──────────────────────────────────
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

  // ── ٢. فحص الصلاحية (+ is_active) ───────────────────────
  const allowed = await hasPermission(user.id, permissionKey)

  if (!allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: 'ليس لديك صلاحية الوصول لهذا القسم' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, userId: user.id }
}

// ============================================================
// revokeUserSessions()
// ============================================================
// تُبطل جميع جلسات مستخدم محدد عالمياً (Global Sign Out).
//
// ⚠️ تُستدعى من Phase 4 عند:
//   - toggle is_active → false (تعطيل الحساب)
//   - تنزيل دور المستخدم لدور بصلاحيات أقل
//
// مبنية الآن كأداة مستقلة — لا زر يستدعيها بعد.
// المرجع: Supabase Admin API — signOut(userId, 'global')
// ============================================================

export async function revokeUserSessions(adminUserId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.signOut(adminUserId, 'global')

    if (error) {
      console.error('[permissions] revokeUserSessions error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'خطأ غير متوقع'
    console.error('[permissions] revokeUserSessions unexpected error:', err)
    return { success: false, error: msg }
  }
}
