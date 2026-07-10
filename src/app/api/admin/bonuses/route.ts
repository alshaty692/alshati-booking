// ============================================================
// GET  /api/admin/bonuses  — قائمة المكافآت (فلترة بـ profile أو شهر)
// POST /api/admin/bonuses  — إنشاء مكافأة جديدة
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
    const month     = searchParams.get('month') // 'YYYY-MM'

    const admin = createAdminClient()
    let query = admin
      .from('bonuses')
      .select('*')
      .order('granted_at', { ascending: false })

    if (profileId) query = query.eq('compensation_profile_id', profileId)
    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const start = new Date(year, mon - 1, 1).toISOString()
      const end   = new Date(year, mon, 0, 23, 59, 59, 999).toISOString()
      query = query.gte('granted_at', start).lte('granted_at', end)
    }

    const { data, error } = await query
    if (error) throw error

    return Response.json({ bonuses: data })
  } catch (err) {
    console.error('[bonuses/get]', err)
    return Response.json({ error: 'حدث خطأ أثناء تحميل المكافآت' }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('manage_payroll')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { compensation_profile_id, amount, reason } = body

    if (!compensation_profile_id) {
      return Response.json({ error: 'compensation_profile_id مطلوب' }, { status: 400 })
    }
    if (!reason?.trim()) {
      return Response.json({ error: 'سبب المكافأة مطلوب' }, { status: 400 })
    }
    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return Response.json({ error: 'المبلغ يجب أن يكون رقماً أكبر من صفر' }, { status: 400 })
    }

    const admin = createAdminClient()

    // تحقق: ملف التعويض موجود وفعّال
    const { data: profile, error: profileErr } = await admin
      .from('compensation_profiles')
      .select('id, is_active')
      .eq('id', compensation_profile_id)
      .single()

    if (profileErr || !profile) {
      return Response.json({ error: 'ملف التعويض غير موجود' }, { status: 404 })
    }
    if (!profile.is_active) {
      return Response.json({ error: 'ملف التعويض غير فعّال — لا يمكن إضافة مكافأة له' }, { status: 400 })
    }

    // جلب سجل admin_users لتسجيل granted_by
    const { userId } = auth
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .single()

    const { data: bonus, error: insertErr } = await admin
      .from('bonuses')
      .insert({
        compensation_profile_id,
        amount:     parsedAmount,
        reason:     reason.trim(),
        granted_at: new Date().toISOString(),
        granted_by: adminUser?.id ?? null,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return Response.json({ success: true, bonus }, { status: 201 })
  } catch (err) {
    console.error('[bonuses/post]', err)
    return Response.json({ error: 'حدث خطأ أثناء إنشاء المكافأة' }, { status: 500 })
  }
}
