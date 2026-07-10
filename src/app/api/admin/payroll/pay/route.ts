// ============================================================
// POST /api/admin/payroll/pay — تنفيذ الصرف الفردي
// ============================================================
// يُنشئ سجل salary_payments ويُحدِّث commissions + bonuses
// الصلاحية: manage_payroll فقط
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_payroll')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const {
      compensation_profile_id,
      period_month,
      base_amount,
      commission_amount,
      bonus_amount,
      commission_ids,   // string[]
      bonus_ids,        // string[]
      notes,
    } = body

    // ── Validation ──────────────────────────────────────────
    if (!compensation_profile_id) {
      return Response.json({ error: 'compensation_profile_id مطلوب' }, { status: 400 })
    }
    if (!period_month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period_month)) {
      return Response.json({ error: 'صيغة الشهر يجب أن تكون YYYY-MM' }, { status: 400 })
    }
    const base   = Number(base_amount)
    const commAm = Number(commission_amount ?? 0)
    const bonAm  = Number(bonus_amount ?? 0)
    if (isNaN(base) || base < 0) {
      return Response.json({ error: 'قيمة الراتب الأساسي غير صحيحة' }, { status: 400 })
    }

    const totalAmount = base + commAm + bonAm

    const admin = createAdminClient()

    // ── 1. تحقق: ملف التعويض نشط ──────────────────────────
    const { data: profile, error: profileErr } = await admin
      .from('compensation_profiles')
      .select('id, is_active')
      .eq('id', compensation_profile_id)
      .single()

    if (profileErr || !profile) {
      return Response.json({ error: 'ملف التعويض غير موجود' }, { status: 404 })
    }
    if (!profile.is_active) {
      return Response.json({ error: 'ملف التعويض غير فعّال' }, { status: 400 })
    }

    // ── 2. إنشاء سجل salary_payments ───────────────────────
    // UNIQUE(compensation_profile_id, period_month) تمنع التكرار
    const { data: salaryPayment, error: insertErr } = await admin
      .from('salary_payments')
      .insert({
        compensation_profile_id,
        period_month,
        base_amount:       base,
        commission_amount: commAm,
        bonus_amount:      bonAm,
        total_amount:      totalAmount,
        paid_at:           new Date().toISOString(),
        paid_by:           auth.userId,
        notes:             notes?.trim() ?? null,
      })
      .select()
      .single()

    if (insertErr) {
      // رمز خطأ UNIQUE violation في PostgreSQL
      if (insertErr.code === '23505') {
        return Response.json(
          { error: 'تم صرف راتب هذا الشهر مسبقاً لهذا المستفيد — لا يمكن الصرف مرتين' },
          { status: 409 }
        )
      }
      throw insertErr
    }

    const salaryPaymentId = salaryPayment.id

    // ── 3. ربط العمولات بسجل الصرف ─────────────────────────
    if (Array.isArray(commission_ids) && commission_ids.length > 0) {
      const { error: commErr } = await admin
        .from('commissions')
        .update({ included_in_salary_payment_id: salaryPaymentId })
        .in('id', commission_ids)
        .is('included_in_salary_payment_id', null) // فقط غير المُدرجة

      if (commErr) {
        console.error('[payroll/pay] خطأ في ربط العمولات:', commErr)
        // لا نرجع خطأ — السجل أُنشئ، نُسجّل التحذير فقط
      }
    }

    // ── 4. ربط المكافآت بسجل الصرف ─────────────────────────
    if (Array.isArray(bonus_ids) && bonus_ids.length > 0) {
      const { error: bonErr } = await admin
        .from('bonuses')
        .update({ included_in_salary_payment_id: salaryPaymentId })
        .in('id', bonus_ids)
        .is('included_in_salary_payment_id', null) // فقط غير المُدرجة

      if (bonErr) {
        console.error('[payroll/pay] خطأ في ربط المكافآت:', bonErr)
      }
    }

    return Response.json({ success: true, salary_payment: salaryPayment }, { status: 201 })
  } catch (err) {
    console.error('[payroll/pay]', err)
    return Response.json({ error: 'حدث خطأ أثناء تنفيذ الصرف' }, { status: 500 })
  }
}
