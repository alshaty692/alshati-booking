// ============================================================
// PATCH /api/admin/users/me/password — تغيير كلمة مرور الحالي
// ============================================================
// لا يحتاج manage_users — كل مستخدم نشط يقدر يغيّر باسورده
// يتطلب: الباسورد الحالي كتأكيد (re-authentication)
// body: { current_password, new_password }
// ──────────────────────────────────────────────────────────
// آلية التحقق من الباسورد الحالي:
//   نحاول signInWithPassword بالإيميل + الباسورد الحالي
//   النجاح = الباسورد صحيح → نكمل التحديث
//   الفشل  = باسورد خاطئ  → 401
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    // ── تحقق من تسجيل الدخول (أي مستخدم نشط) ─────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'غير مسجّل دخول' }, { status: 401 })
    }

    // ── التحقق من أن الحساب نشط في admin_users ───────────────
    const admin = createAdminClient()
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('id, username, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (!adminUser || !adminUser.is_active) {
      return Response.json({ error: 'الحساب غير نشط أو غير مخوّل' }, { status: 403 })
    }

    const body = await request.json()
    const { current_password, new_password } = body

    if (!current_password || typeof current_password !== 'string') {
      return Response.json({ error: 'كلمة المرور الحالية مطلوبة' }, { status: 400 })
    }
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return Response.json({ error: 'كلمة المرور الجديدة مطلوبة (8 أحرف على الأقل)' }, { status: 400 })
    }
    if (current_password === new_password) {
      return Response.json({ error: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' }, { status: 400 })
    }

    // ── التحقق من كلمة المرور الحالية ────────────────────────
    // نستخدم الإيميل الداخلي: username@alshati.internal
    const internalEmail = `${adminUser.username}@alshati.internal`
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    internalEmail,
      password: current_password,
    })

    if (signInError) {
      return Response.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
    }

    // ── تحديث كلمة المرور ────────────────────────────────────
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: new_password,
    })

    if (updateError) {
      console.error('[PATCH /api/admin/users/me/password]', updateError.message)
      return Response.json({ error: 'فشل تحديث كلمة المرور — حاول مجدداً' }, { status: 400 })
    }

    // ── Audit Log ────────────────────────────────────────────
    await admin.from('audit_log').insert({
      table_name:   'admin_users',
      record_id:    user.id,
      action:       'update',
      performed_by: user.id,
      notes:        `تغيير كلمة مرور المستخدم: ${adminUser.username} (بواسطة نفسه)`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/admin/users/me/password]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
