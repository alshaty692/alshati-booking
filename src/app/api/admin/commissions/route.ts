// ============================================================
// GET  /api/admin/commissions      — قائمة العمولات
// POST /api/admin/commissions      — تخصيص عمولة جديدة
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

// ── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const [authView, authManage] = await Promise.all([
      requirePermission('view_payroll'),
      requirePermission('manage_payroll'),
    ])
    if (!authView.ok && !authManage.ok) return authView.response

    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('compensation_profile_id')
    const bookingId = searchParams.get('booking_id')
    const month     = searchParams.get('month')  // 'YYYY-MM'

    const admin = createAdminClient()
    let query = admin
      .from('commissions')
      .select('*')
      .order('calculated_at', { ascending: false })

    if (profileId) query = query.eq('compensation_profile_id', profileId)
    if (bookingId) query = query.eq('booking_id', bookingId)
    if (month) {
      // فلترة ضمن نطاق الشهر: YYYY-MM-01 إلى YYYY-MM-lastDay
      const [year, mon] = month.split('-').map(Number)
      const start = new Date(year, mon - 1, 1).toISOString()
      const end   = new Date(year, mon, 0, 23, 59, 59).toISOString()
      query = query.gte('calculated_at', start).lte('calculated_at', end)
    }

    const { data, error } = await query
    if (error) throw error

    return Response.json({ commissions: data })
  } catch (err) {
    console.error('[commissions/get]', err)
    return Response.json({ error: 'حدث خطأ أثناء تحميل العمولات' }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_payroll')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { compensation_profile_id, booking_id, invoice_id, amount } = body

    // ── Validation ──────────────────────────────────────────

    if (!compensation_profile_id) {
      return Response.json({ error: 'compensation_profile_id مطلوب' }, { status: 400 })
    }

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return Response.json({ error: 'المبلغ يجب أن يكون رقماً أكبر من صفر' }, { status: 400 })
    }

    const admin = createAdminClient()

    // تحقق: ملف التعويض موجود وفعّال
    const { data: profile, error: profileErr } = await admin
      .from('compensation_profiles')
      .select('id, is_active, beneficiary_type, beneficiary_id')
      .eq('id', compensation_profile_id)
      .single()

    if (profileErr || !profile) {
      return Response.json({ error: 'ملف التعويض غير موجود' }, { status: 404 })
    }
    if (!profile.is_active) {
      return Response.json({ error: 'ملف التعويض غير فعّال — لا يمكن تخصيص عمولة له' }, { status: 400 })
    }

    // إنشاء سجل العمولة
    const { data: commission, error: insertErr } = await admin
      .from('commissions')
      .insert({
        compensation_profile_id,
        booking_id:   booking_id  ?? null,
        invoice_id:   invoice_id  ?? null,
        amount:       parsedAmount,
        calculated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return Response.json({ success: true, commission }, { status: 201 })
  } catch (err) {
    console.error('[commissions/post]', err)
    return Response.json({ error: 'حدث خطأ أثناء تخصيص العمولة' }, { status: 500 })
  }
}
