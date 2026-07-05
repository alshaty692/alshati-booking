// ============================================================
// GET  /api/admin/users  — قائمة الموظفين الإداريين
// POST /api/admin/users  — إنشاء موظف جديد
// ============================================================
// الحماية: requirePermission('manage_users')
// الإنشاء: عبر Supabase Auth Admin API بإيميل وهمي داخلي
//   username@alshati.internal — مستخدم لأغراض المصادقة فقط
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────────────────
// GET /api/admin/users
// يُرجع: { users: AdminUser[] }
// ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    // استعلامان منفصلان: admin_users ثم roles (PostgREST لا يعرف الـ FK تلقائياً)
    const { data: users, error } = await admin
      .from('admin_users')
      .select('id, username, display_name, is_active, created_at, role_id')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/users]', error.message)
      return Response.json({ error: 'حدث خطأ أثناء جلب قائمة الموظفين' }, { status: 500 })
    }

    // جلب الأدوار دفعةً واحدة
    const { data: roles } = await admin
      .from('roles')
      .select('id, name, label_ar')

    const rolesMap: Record<string, { id: string; name: string; label_ar: string }> = {}
    ;(roles ?? []).forEach(r => { rolesMap[r.id] = r })

    const result = (users ?? []).map(u => ({
      id:           u.id,
      username:     u.username,
      display_name: u.display_name,
      is_active:    u.is_active,
      created_at:   u.created_at,
      role:         u.role_id ? rolesMap[u.role_id] ?? null : null,
    }))

    return Response.json({ users: result })
  } catch (err) {
    console.error('[GET /api/admin/users]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────
// POST /api/admin/users
// body: { username, password, display_name, role_id }
// يُرجع: { success: true, user_id }
// ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { username, password, display_name, role_id } = body

    // ── Validation ──────────────────────────────────────────
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return Response.json({ error: 'اسم المستخدم مطلوب (3 أحرف على الأقل)' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return Response.json({ error: 'كلمة المرور مطلوبة (8 أحرف على الأقل)' }, { status: 400 })
    }
    if (!role_id || typeof role_id !== 'string') {
      return Response.json({ error: 'الدور (role_id) مطلوب' }, { status: 400 })
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!cleanUsername || cleanUsername.length < 3) {
      return Response.json({ error: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية أو أرقام فقط' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── التحقق من عدم تكرار اسم المستخدم ───────────────────
    const { data: existing } = await admin
      .from('admin_users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: `اسم المستخدم "${cleanUsername}" مستخدم مسبقاً` }, { status: 409 })
    }

    // ── التحقق من وجود الدور ────────────────────────────────
    const { data: role } = await admin
      .from('roles')
      .select('id, name')
      .eq('id', role_id)
      .maybeSingle()

    if (!role) {
      return Response.json({ error: 'الدور المحدد غير موجود' }, { status: 400 })
    }

    // ── إنشاء المستخدم في Supabase Auth ─────────────────────
    // الإيميل الداخلي: username@alshati.internal
    const internalEmail = `${cleanUsername}@alshati.internal`

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email:          internalEmail,
      password,
      email_confirm:  true,   // تأكيد تلقائي — لا حاجة لإيميل تأكيد
    })

    if (authError || !authData.user) {
      console.error('[POST /api/admin/users] auth.admin.createUser:', authError?.message)
      // رسالة واضحة بدل رسالة Supabase الخام
      if (authError?.message?.includes('already registered')) {
        return Response.json({ error: 'هذا الحساب موجود مسبقاً في نظام المصادقة' }, { status: 409 })
      }
      return Response.json({ error: 'فشل إنشاء الحساب — تحقق من صحة البيانات' }, { status: 400 })
    }

    const newUserId = authData.user.id

    // ── إضافة سجل في admin_users ────────────────────────────
    const { error: insertError } = await admin
      .from('admin_users')
      .insert({
        id:           newUserId,
        username:     cleanUsername,
        display_name: display_name?.trim() || cleanUsername,
        role_id,
        is_active:    true,
        created_by:   auth.userId,
      })

    if (insertError) {
      // إذا فشل insert → احذف المستخدم من Auth لتجنب orphan records
      await admin.auth.admin.deleteUser(newUserId)
      console.error('[POST /api/admin/users] admin_users insert:', insertError.message)
      return Response.json({ error: 'فشل إضافة الموظف — حاول مجدداً' }, { status: 500 })
    }

    // ── Audit Log ────────────────────────────────────────────
    await admin.from('audit_log').insert({
      table_name:   'admin_users',
      record_id:    newUserId,
      action:       'insert',
      performed_by: auth.userId,
      notes:        `إنشاء موظف جديد: ${cleanUsername} بدور ${role.name}`,
    })

    return Response.json({ success: true, user_id: newUserId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/users]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
