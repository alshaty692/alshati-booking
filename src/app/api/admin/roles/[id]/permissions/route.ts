// ============================================================
// PATCH /api/admin/roles/[id]/permissions
// ============================================================
// الحماية: requirePermission('manage_users')
// body: { permission_key: string, action: 'grant' | 'revoke' }
//
// grant  → INSERT صف في role_permissions (idempotent)
// revoke → DELETE صف من role_permissions (idempotent)
//
// القيود:
//   - لا يُسمح بتعديل الأدوار is_system (النظامية) حالياً
//     لحماية الأدوار الأساسية من تفريغ صلاحياتها عن طريق الخطأ
//     (يُناقَش رفع هذا القيد لاحقاً لو لزم)
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

// قائمة مفاتيح الصلاحيات الصالحة (تُزامَن مع migration 008)
const VALID_PERMISSION_KEYS = new Set([
  // الحجوزات
  'view_bookings', 'create_booking', 'edit_booking',
  'cancel_booking', 'soft_delete_booking', 'hard_delete_booking',
  // العملاء
  'view_customers', 'edit_customer',
  // الفواتير والمالية
  'view_invoices', 'manage_invoices', 'manage_payments',
  'delete_payment', 'manage_credit_notes', 'approve_credit_note',
  // المصروفات
  'view_expenses', 'create_expense', 'approve_expense',
  // الأكواد والتوافر
  'manage_codes', 'manage_availability', 'manage_closure',
  // التقارير والتصدير
  'view_dashboard', 'view_reports', 'export_data',
  // إدارة النظام
  'manage_settings', 'manage_users',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_users')
    if (!auth.ok) return auth.response

    const { id: roleId } = await params

    if (!roleId) {
      return Response.json({ error: 'معرّف الدور مطلوب' }, { status: 400 })
    }

    const body = await request.json()
    const { permission_key, action } = body

    // ── Validation ──────────────────────────────────────────
    if (!permission_key || typeof permission_key !== 'string') {
      return Response.json({ error: 'permission_key مطلوب' }, { status: 400 })
    }
    if (action !== 'grant' && action !== 'revoke') {
      return Response.json({ error: 'action يجب أن يكون "grant" أو "revoke"' }, { status: 400 })
    }
    if (!VALID_PERMISSION_KEYS.has(permission_key)) {
      return Response.json({
        error: `مفتاح الصلاحية "${permission_key}" غير معروف`,
        valid_keys: [...VALID_PERMISSION_KEYS],
      }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── التحقق من وجود الدور ────────────────────────────────
    const { data: role } = await admin
      .from('roles')
      .select('id, name')
      .eq('id', roleId)
      .maybeSingle()

    if (!role) {
      return Response.json({ error: 'الدور غير موجود' }, { status: 404 })
    }

    // ── تنفيذ grant / revoke ──────────────────────────────────
    if (action === 'grant') {
      // idempotent: إذا الصلاحية موجودة مسبقاً لا يُعيد error
      const { error: grantError } = await admin
        .from('role_permissions')
        .upsert(
          { role_id: roleId, permission_key },
          { onConflict: 'role_id,permission_key', ignoreDuplicates: true }
        )

      if (grantError) {
        console.error('[PATCH /api/admin/roles/[id]/permissions] grant:', grantError.message)
        return Response.json({ error: 'فشل منح الصلاحية — حاول مجدداً' }, { status: 500 })
      }
    } else {
      // revoke — idempotent: لا error إذا الصف غير موجود
      const { error: revokeError } = await admin
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_key', permission_key)

      if (revokeError) {
        console.error('[PATCH /api/admin/roles/[id]/permissions] revoke:', revokeError.message)
        return Response.json({ error: 'فشل سحب الصلاحية — حاول مجدداً' }, { status: 500 })
      }
    }

    // ── Audit Log ────────────────────────────────────────────
    await admin.from('audit_log').insert({
      table_name:   'role_permissions',
      record_id:    roleId,
      action:       action === 'grant' ? 'insert' : 'delete',
      performed_by: auth.userId,
      notes:        `${action === 'grant' ? 'منح' : 'سحب'} صلاحية "${permission_key}" من دور "${role.name}"`,
    })

    return Response.json({ success: true, role_id: roleId, permission_key, action })
  } catch (err) {
    console.error('[PATCH /api/admin/roles/[id]/permissions]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
