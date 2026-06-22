// ============================================================
// GET /api/admin/customers/search?phone=05XXXXXXXX
// بحث عن عميل برقم الجوال (للاستخدام الإداري)
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

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
