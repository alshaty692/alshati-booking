// ============================================================
// GET /api/admin/customers/search?phone=05XXXXXXXX
// بحث عن عميل برقم الجوال (admin/editor فقط)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 🔴 حرج — يعرض بيانات العميل الشخصية
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const phone = request.nextUrl.searchParams.get('phone')?.trim()
    if (!phone) return Response.json({ found: false })

    const admin = createAdminClient()
    const { data: customer } = await admin
      .from('customers')
      .select('id, name, phone, is_suspended, suspension_reason')
      .eq('phone', phone)
      .single()

    if (!customer) return Response.json({ found: false })

    return Response.json({
      found: true,
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      is_suspended: customer.is_suspended ?? false,
      suspension_reason: customer.suspension_reason ?? null,
    })
  } catch {
    return Response.json({ found: false })
  }
}
