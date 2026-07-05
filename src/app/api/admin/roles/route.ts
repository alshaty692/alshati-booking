// ============================================================
// GET  /api/admin/roles  — قائمة الأدوار مع صلاحياتها
// POST /api/admin/roles  — إنشاء دور جديد (بدون صلاحيات)
// ============================================================
// الحماية: requirePermission('manage_users')
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────────────────
// GET /api/admin/roles
// يُرجع: { roles: Role[] } — كل دور مع صلاحياته وعدد مستخدميه
// ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    // ── الأدوار مع صلاحياتها ─────────────────────────────────
    const { data: roles, error: rolesError } = await admin
      .from('roles')
      .select(`
        id,
        name,
        display_name,
        description,
        is_system,
        created_at,
        permissions:role_permissions ( permission_key )
      `)
      .order('created_at', { ascending: true })

    if (rolesError) {
      console.error('[GET /api/admin/roles] roles:', rolesError.message)
      return Response.json({ error: 'حدث خطأ أثناء جلب قائمة الأدوار' }, { status: 500 })
    }

    // ── عدد المستخدمين لكل دور ───────────────────────────────
    const { data: counts, error: countError } = await admin
      .from('admin_users')
      .select('role_id')
      .eq('is_active', true)

    if (countError) {
      console.error('[GET /api/admin/roles] counts:', countError.message)
    }

    const userCountByRole: Record<string, number> = {}
    ;(counts ?? []).forEach(u => {
      if (u.role_id) {
        userCountByRole[u.role_id] = (userCountByRole[u.role_id] ?? 0) + 1
      }
    })

    const result = (roles ?? []).map(r => ({
      ...r,
      permissions: (r.permissions ?? []).map((p: { permission_key: string }) => p.permission_key),
      user_count:  userCountByRole[r.id] ?? 0,
    }))

    return Response.json({ roles: result })
  } catch (err) {
    console.error('[GET /api/admin/roles]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────
// POST /api/admin/roles
// body: { name, display_name, description? }
// يُنشئ الدور بدون أي صلاحيات (رفض افتراضي)
// يُرجع: { success: true, role_id }
// ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { name, display_name, description } = body

    // ── Validation ──────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return Response.json({ error: 'اسم الدور مطلوب (حرفان على الأقل)' }, { status: 400 })
    }
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
      return Response.json({ error: 'الاسم المعروض للدور مطلوب' }, { status: 400 })
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!cleanName || cleanName.length < 2) {
      return Response.json({ error: 'اسم الدور يجب أن يحتوي على أحرف إنجليزية أو أرقام فقط' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── التحقق من عدم تكرار الاسم ───────────────────────────
    const { data: existing } = await admin
      .from('roles')
      .select('id')
      .eq('name', cleanName)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: `الدور "${cleanName}" موجود مسبقاً` }, { status: 409 })
    }

    // ── الإنشاء — بدون أي صلاحيات (رفض افتراضي) ────────────
    const { data: newRole, error: insertError } = await admin
      .from('roles')
      .insert({
        name:         cleanName,
        display_name: display_name.trim(),
        description:  description?.trim() ?? null,
        is_system:    false,   // الأدوار الجديدة دائماً غير نظامية
      })
      .select('id, name, display_name')
      .single()

    if (insertError || !newRole) {
      console.error('[POST /api/admin/roles] insert:', insertError?.message)
      return Response.json({ error: 'فشل إنشاء الدور — حاول مجدداً' }, { status: 500 })
    }

    // ── Audit Log ────────────────────────────────────────────
    await admin.from('audit_log').insert({
      table_name:   'roles',
      record_id:    newRole.id,
      action:       'insert',
      performed_by: auth.userId,
      notes:        `إنشاء دور جديد: ${cleanName} (${display_name.trim()})`,
    })

    return Response.json({ success: true, role_id: newRole.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/roles]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
