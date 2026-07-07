// ============================================================
// GET  /api/admin/employees  — قائمة الموظفين
// POST /api/admin/employees  — إنشاء موظف + ملف تعويض تلقائي
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

// ── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // أي من الصلاحيتين تكفي للعرض — فحص البديل قبل الرفض
    const [authView, authManage] = await Promise.all([
      requirePermission('view_payroll'),
      requirePermission('manage_employees'),
    ])
    if (!authView.ok && !authManage.ok) {
      return authView.response  // 401/403
    }

    const { searchParams } = new URL(req.url)
    const showInactive = searchParams.get('show_inactive') === 'true'

    const admin = createAdminClient()

    // ── ١. جلب الموظفين ───────────────────────────────────────
    let empQuery = admin
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true })

    if (!showInactive) {
      empQuery = empQuery.eq('is_active', true)
    }

    const { data: employees, error: empErr } = await empQuery
    if (empErr) throw empErr

    if (!employees || employees.length === 0) {
      return Response.json({ employees: [] })
    }

    // ── ٢. جلب ملفات التعويض منفصلة (FK غير مباشر) ──────────
    // compensation_profiles.beneficiary_id → employees.id
    // لكن العلاقة غير مُعرَّفة في PostgREST schema cache
    // لذا نجلب بـ IN() ونضم يدوياً
    const empIds = employees.map((e: { id: string }) => e.id)
    const { data: profiles } = await admin
      .from('compensation_profiles')
      .select('id, beneficiary_id, base_salary, commission_type, commission_value, is_active, updated_at')
      .eq('beneficiary_type', 'employee')
      .in('beneficiary_id', empIds)

    // ── ٣. دمج النتائج ────────────────────────────────────────
    const profileMap = new Map(
      (profiles ?? []).map((p: { beneficiary_id: string }) => [p.beneficiary_id, p])
    )

    const result = employees.map((emp: { id: string }) => ({
      ...emp,
      compensation_profiles: profileMap.has(emp.id) ? [profileMap.get(emp.id)] : [],
    }))

    return Response.json({ employees: result })
  } catch (err) {
    console.error('[employees/get]', err)
    return Response.json({ error: 'حدث خطأ أثناء تحميل الموظفين' }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_employees')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { full_name, position, phone, hire_date, notes } = body

    if (!full_name?.trim()) {
      return Response.json({ error: 'الاسم الكامل مطلوب' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ١. إنشاء الموظف
    const { data: employee, error: empErr } = await admin
      .from('employees')
      .insert({
        full_name: full_name.trim(),
        position:  position?.trim()  || null,
        phone:     phone?.trim()     || null,
        hire_date: hire_date         || null,
        notes:     notes?.trim()     || null,
        is_active: true,
      })
      .select()
      .single()

    if (empErr) throw empErr

    // ٢. إنشاء ملف تعويض افتراضي تلقائياً
    const { error: cpErr } = await admin
      .from('compensation_profiles')
      .insert({
        beneficiary_type: 'employee',
        beneficiary_id:   employee.id,
        base_salary:      0,
        commission_type:  'none',
        commission_value: 0,
        is_active:        true,
      })

    if (cpErr) {
      // تراجع عن إنشاء الموظف لو فشل ملف التعويض
      await admin.from('employees').delete().eq('id', employee.id)
      console.error('[employees/post] فشل إنشاء ملف التعويض:', cpErr)
      return Response.json({ error: 'فشل إنشاء ملف التعويض — لم يُنشأ الموظف' }, { status: 500 })
    }

    return Response.json({ success: true, employee }, { status: 201 })
  } catch (err) {
    console.error('[employees/post]', err)
    return Response.json({ error: 'حدث خطأ أثناء إنشاء الموظف' }, { status: 500 })
  }
}
