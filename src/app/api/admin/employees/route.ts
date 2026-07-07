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
    // أي من الصلاحيتين تكفي للعرض
    const auth = await requirePermission('view_payroll')
    if (!auth.ok) {
      // جرّب manage_employees كبديل
      const auth2 = await requirePermission('manage_employees')
      if (!auth2.ok) return auth.response
    }

    const { searchParams } = new URL(req.url)
    const showInactive = searchParams.get('show_inactive') === 'true'

    const admin = createAdminClient()
    let query = admin
      .from('employees')
      .select(`
        *,
        compensation_profiles (
          id, base_salary, commission_type, commission_value, is_active
        )
      `)
      .order('full_name', { ascending: true })

    if (!showInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error
    return Response.json({ employees: data })
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
