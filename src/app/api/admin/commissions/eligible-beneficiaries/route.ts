// ============================================================
// GET /api/admin/commissions/eligible-beneficiaries
// قائمة المستفيدين المؤهلين للعمولة:
//   - موظفون نشطون + إداريون نشطون
//   - لديهم compensation_profile فعّال
//   - commission_type != 'none'
// ============================================================
import { requirePermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const [authView, authManage] = await Promise.all([
      requirePermission('view_payroll'),
      requirePermission('manage_payroll'),
    ])
    if (!authView.ok && !authManage.ok) return authView.response

    const admin = createAdminClient()

    // ── جلب ملفات التعويض الفعّالة بعمولة ──────────────────────
    const { data: profiles, error } = await admin
      .from('compensation_profiles')
      .select('id, beneficiary_type, beneficiary_id, commission_type, commission_value, base_salary')
      .eq('is_active', true)
      .neq('commission_type', 'none')

    if (error) throw error
    if (!profiles || profiles.length === 0) {
      return Response.json({ beneficiaries: [] })
    }

    // ── جلب أسماء الموظفين ──────────────────────────────────────
    const employeeIds = profiles
      .filter(p => p.beneficiary_type === 'employee')
      .map(p => p.beneficiary_id)

    const adminIds = profiles
      .filter(p => p.beneficiary_type === 'admin_user')
      .map(p => p.beneficiary_id)

    const [empRes, adminRes] = await Promise.all([
      employeeIds.length > 0
        ? admin.from('employees')
            .select('id, full_name, position, is_active')
            .in('id', employeeIds)
            .eq('is_active', true)
        : Promise.resolve({ data: [] }),
      adminIds.length > 0
        ? admin.from('admin_users')
            .select('id, display_name, full_name, is_active')
            .in('id', adminIds)
            .eq('is_active', true)
        : Promise.resolve({ data: [] }),
    ])

    const empMap   = new Map((empRes.data   ?? []).map((e: { id: string }) => [e.id, e]))
    const adminMap = new Map((adminRes.data  ?? []).map((a: { id: string }) => [a.id, a]))

    // ── دمج النتائج ──────────────────────────────────────────────
    const beneficiaries = profiles
      .map(profile => {
        if (profile.beneficiary_type === 'employee') {
          const emp = empMap.get(profile.beneficiary_id) as { full_name?: string; position?: string } | undefined
          if (!emp) return null  // موظف غير نشط أو محذوف
          return {
            profile_id:       profile.id,
            beneficiary_type: 'employee',
            beneficiary_id:   profile.beneficiary_id,
            name:             (emp as { full_name: string }).full_name,
            subtitle:         (emp as { position?: string }).position ?? 'موظف',
            commission_type:  profile.commission_type,
            commission_value: profile.commission_value,
          }
        } else {
          const adm = adminMap.get(profile.beneficiary_id) as { display_name?: string; full_name?: string } | undefined
          if (!adm) return null  // إداري غير نشط
          return {
            profile_id:       profile.id,
            beneficiary_type: 'admin_user',
            beneficiary_id:   profile.beneficiary_id,
            name:             (adm as { display_name?: string; full_name?: string }).display_name ?? (adm as { full_name?: string }).full_name ?? 'مستخدم إداري',
            subtitle:         'مستخدم إداري',
            commission_type:  profile.commission_type,
            commission_value: profile.commission_value,
          }
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a?.name ?? '').localeCompare(b?.name ?? '', 'ar'))

    return Response.json({ beneficiaries })
  } catch (err) {
    console.error('[commissions/eligible-beneficiaries]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
