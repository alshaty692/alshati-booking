// ============================================================
// API Route — البحث عن عميل بالجوال (من الـ cookie)
// ============================================================
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ found: false })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone, is_suspended, suspension_reason')
      .eq('phone', phone)
      .single()

    if (customer) {
      return Response.json({
        found: true,
        name: customer.name,
        is_suspended: customer.is_suspended,
        suspension_reason: customer.suspension_reason,
      })
    }

    return Response.json({ found: false })
  } catch {
    return Response.json({ found: false })
  }
}
