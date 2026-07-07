// ============================================================
// GET   /api/admin/employees/[id]  — تفاصيل موظف + ملف تعويضه
// PATCH /api/admin/employees/[id]  — تعديل بيانات الموظف الأساسية
// (لا DELETE — التعطيل عبر is_active:false حفاظاً على السجل المالي)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

// ── GET ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [authView, authManage] = await Promise.all([
      requirePermission('view_payroll'),
      requirePermission('manage_employees'),
    ])
    if (!authView.ok && !authManage.ok) return authView.response

    const { id } = await params
    const admin  = createAdminClient()

    // ── جلب الموظف ─────────────────────────────────────────────
    const { data: employee, error: empErr } = await admin
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()

    if (empErr || !employee) {
      return Response.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    // ── جلب ملف التعويض بشكل منفصل ────────────────────────────
    const { data: profiles } = await admin
      .from('compensation_profiles')
      .select('id, beneficiary_id, base_salary, commission_type, commission_value, is_active, updated_at')
      .eq('beneficiary_type', 'employee')
      .eq('beneficiary_id', id)

    return Response.json({
      employee: {
        ...employee,
        compensation_profiles: profiles ?? [],
      },
    })
  } catch (err) {
    console.error('[employees/id/get]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// ── PATCH ───────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_employees')
    if (!auth.ok) return auth.response

    const { id }   = await params
    const body     = await req.json()

    // الحقول المسموح بتعديلها هنا (بيانات أساسية فقط)
    // تعديل الراتب/العمولة يسير عبر /api/admin/compensation-profiles/[id]
    const allowed = ['full_name', 'position', 'phone', 'hire_date', 'notes', 'is_active'] as const
    const update: Record<string, unknown> = {}

    for (const field of allowed) {
      if (field in body) {
        update[field] = body[field] === '' ? null : body[field]
      }
    }

    if ('full_name' in update && !String(update.full_name ?? '').trim()) {
      return Response.json({ error: 'الاسم الكامل لا يمكن أن يكون فارغاً' }, { status: 400 })
    }

    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'لا توجد حقول للتعديل' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('employees')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data)  return Response.json({ error: 'الموظف غير موجود' }, { status: 404 })

    return Response.json({ success: true, employee: data })
  } catch (err) {
    console.error('[employees/id/patch]', err)
    return Response.json({ error: 'حدث خطأ أثناء التعديل' }, { status: 500 })
  }
}
