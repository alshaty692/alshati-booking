// ============================================================
// PATCH /api/admin/compensation-profiles/[id]
// تعديل إعدادات الراتب والعمولة
// الصلاحية: manage_payroll (قرار مالي منفصل عن manage_employees)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_payroll')
    if (!auth.ok) return auth.response

    const { id } = await params
    const body   = await req.json()

    const { base_salary, commission_type, commission_value, is_active } = body

    // ── Validation ──────────────────────────────────────────

    const validCommissionTypes = ['percentage', 'fixed_per_booking', 'none']

    if (commission_type !== undefined && !validCommissionTypes.includes(commission_type)) {
      return Response.json(
        { error: `نوع العمولة غير صالح. القيم المقبولة: ${validCommissionTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (base_salary !== undefined) {
      const salary = Number(base_salary)
      if (isNaN(salary) || salary < 0) {
        return Response.json({ error: 'الراتب الأساسي يجب أن يكون رقماً موجباً أو صفراً' }, { status: 400 })
      }
    }

    if (commission_value !== undefined) {
      const value = Number(commission_value)
      if (isNaN(value) || value < 0) {
        return Response.json({ error: 'قيمة العمولة يجب أن تكون موجبة أو صفراً' }, { status: 400 })
      }

      // لو النوع percentage → القيمة بين 0 و 100
      const effectiveType = commission_type ?? undefined
      if (effectiveType === 'percentage' && value > 100) {
        return Response.json(
          { error: 'نسبة العمولة لا يمكن أن تتجاوز 100%' },
          { status: 400 }
        )
      }
    }

    // تحقق مشترك: لو commission_type=percentage والقيمة الحالية > 100
    // (عند تغيير النوع لـ percentage بدون تغيير القيمة)
    if (commission_type === 'percentage' && commission_value === undefined) {
      const admin = createAdminClient()
      const { data: existing } = await admin
        .from('compensation_profiles')
        .select('commission_value')
        .eq('id', id)
        .single()

      if (existing && Number(existing.commission_value) > 100) {
        return Response.json(
          { error: 'القيمة الحالية أكبر من 100 — عدّلها أولاً قبل التحويل لنسبة مئوية' },
          { status: 400 }
        )
      }
    }

    // ── التحديث ─────────────────────────────────────────────

    const update: Record<string, unknown> = {}
    if (base_salary      !== undefined) update.base_salary      = Number(base_salary)
    if (commission_type  !== undefined) update.commission_type  = commission_type
    if (commission_value !== undefined) update.commission_value = Number(commission_value)
    if (is_active        !== undefined) update.is_active        = Boolean(is_active)

    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'لا توجد حقول للتعديل' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('compensation_profiles')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data)  return Response.json({ error: 'ملف التعويض غير موجود' }, { status: 404 })

    return Response.json({ success: true, profile: data })
  } catch (err) {
    console.error('[compensation-profiles/id/patch]', err)
    return Response.json({ error: 'حدث خطأ أثناء التعديل' }, { status: 500 })
  }
}
