// ============================================================
// GET /api/admin/payroll?month=YYYY-MM
// يرجع كل ملفات التعويض النشطة مع حساباتها للشهر المطلوب
// الصلاحية: view_payroll أو manage_payroll
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const [authView, authManage] = await Promise.all([
      requirePermission('view_payroll'),
      requirePermission('manage_payroll'),
    ])
    if (!authView.ok && !authManage.ok) return authView.response

    const { searchParams } = new URL(req.url)
    const now   = new Date()
    const month = searchParams.get('month')
      ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // التحقق من صيغة الشهر
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: 'صيغة الشهر يجب أن تكون YYYY-MM' }, { status: 400 })
    }

    const [year, mon] = month.split('-').map(Number)
    const monthStart  = new Date(year, mon - 1, 1).toISOString()
    const monthEnd    = new Date(year, mon, 0, 23, 59, 59, 999).toISOString()

    const admin = createAdminClient()

    // ── 1. جلب كل ملفات التعويض النشطة ─────────────────────
    const { data: profiles, error: profilesErr } = await admin
      .from('compensation_profiles')
      .select('id, beneficiary_type, beneficiary_id, base_salary, commission_type, commission_value, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (profilesErr) throw profilesErr
    if (!profiles || profiles.length === 0) {
      return Response.json({ month, rows: [] })
    }

    const profileIds = profiles.map(p => p.id)

    // ── 2. جلب الأسماء — admin_users + employees ────────────
    const adminProfiles  = profiles.filter(p => p.beneficiary_type === 'admin_user')
    const empProfiles    = profiles.filter(p => p.beneficiary_type === 'employee')

    const [adminUsersRes, employeesRes] = await Promise.all([
      adminProfiles.length > 0
        ? admin.from('admin_users')
            .select('id, display_name, username')
            .in('id', adminProfiles.map(p => p.beneficiary_id))
        : Promise.resolve({ data: [], error: null }),
      empProfiles.length > 0
        ? admin.from('employees')
            .select('id, full_name, position')
            .in('id', empProfiles.map(p => p.beneficiary_id))
        : Promise.resolve({ data: [], error: null }),
    ])

    const adminMap = new Map((adminUsersRes.data ?? []).map(u => [u.id, u]))
    const empMap   = new Map((employeesRes.data ?? []).map(e => [e.id, e]))

    // ── 3. عمولات غير مدرجة ضمن الشهر ──────────────────────
    const { data: commissions } = await admin
      .from('commissions')
      .select('id, compensation_profile_id, amount')
      .in('compensation_profile_id', profileIds)
      .is('included_in_salary_payment_id', null)
      .gte('calculated_at', monthStart)
      .lte('calculated_at', monthEnd)

    // ── 4. مكافآت غير مدرجة ضمن الشهر ──────────────────────
    const { data: bonuses } = await admin
      .from('bonuses')
      .select('id, compensation_profile_id, amount')
      .in('compensation_profile_id', profileIds)
      .is('included_in_salary_payment_id', null)
      .gte('granted_at', monthStart)
      .lte('granted_at', monthEnd)

    // ── 5. سجلات الصرف الموجودة لهذا الشهر ─────────────────
    const { data: existingPayments } = await admin
      .from('salary_payments')
      .select('id, compensation_profile_id, period_month, base_amount, commission_amount, bonus_amount, total_amount, paid_at, notes')
      .in('compensation_profile_id', profileIds)
      .eq('period_month', month)

    // ── 6. تجميع الأرقام لكل profile ────────────────────────
    const commByProfile = new Map<string, number>()
    const commIdsMap    = new Map<string, string[]>()
    for (const c of (commissions ?? [])) {
      commByProfile.set(c.compensation_profile_id, (commByProfile.get(c.compensation_profile_id) ?? 0) + Number(c.amount))
      const ids = commIdsMap.get(c.compensation_profile_id) ?? []
      ids.push(c.id)
      commIdsMap.set(c.compensation_profile_id, ids)
    }

    const bonusByProfile = new Map<string, number>()
    const bonusIdsMap    = new Map<string, string[]>()
    for (const b of (bonuses ?? [])) {
      bonusByProfile.set(b.compensation_profile_id, (bonusByProfile.get(b.compensation_profile_id) ?? 0) + Number(b.amount))
      const ids = bonusIdsMap.get(b.compensation_profile_id) ?? []
      ids.push(b.id)
      bonusIdsMap.set(b.compensation_profile_id, ids)
    }

    const paymentByProfile = new Map((existingPayments ?? []).map(p => [p.compensation_profile_id, p]))

    // ── 7. بناء صفوف الجدول ─────────────────────────────────
    const rows = profiles.map(p => {
      const isAdmin   = p.beneficiary_type === 'admin_user'
      const adminUser = isAdmin ? adminMap.get(p.beneficiary_id) : null
      const employee  = !isAdmin ? empMap.get(p.beneficiary_id) : null

      const name     = isAdmin
        ? (adminUser?.display_name ?? adminUser?.username ?? 'إداري غير معروف')
        : (employee?.full_name ?? 'موظف غير معروف')
      const position = isAdmin ? 'مدير/إداري' : (employee?.position ?? '—')

      const commTotal  = commByProfile.get(p.id)  ?? 0
      const bonusTotal = bonusByProfile.get(p.id) ?? 0
      const base       = Number(p.base_salary)
      const totalDue   = base + commTotal + bonusTotal

      const existingPayment = paymentByProfile.get(p.id) ?? null

      return {
        profile_id:       p.id,
        beneficiary_type: p.beneficiary_type,
        beneficiary_id:   p.beneficiary_id,
        name,
        position,
        base_salary:      base,
        commission_total: commTotal,
        bonus_total:      bonusTotal,
        total_due:        totalDue,
        commission_ids:   commIdsMap.get(p.id)  ?? [],
        bonus_ids:        bonusIdsMap.get(p.id) ?? [],
        payment:          existingPayment,  // null = لم يُصرف
      }
    })

    return Response.json({ month, rows })
  } catch (err) {
    console.error('[payroll/get]', err)
    return Response.json({ error: 'حدث خطأ أثناء تحميل بيانات الرواتب' }, { status: 500 })
  }
}
