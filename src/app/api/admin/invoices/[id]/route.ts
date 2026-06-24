// ============================================================
// GET  /api/admin/invoices/[id]  — تفاصيل فاتورة
// PATCH /api/admin/invoices/[id] — إلغاء فاتورة يدوياً
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cancelInvoicesForBooking, cancelInvoicesForBatch } from '@/lib/invoices'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { id } = await params
    const admin  = createAdminClient()

    const { data: invoice, error } = await admin
      .from('invoices')
      .select(`
        *,
        customers ( id, name, phone, customer_code ),
        bookings  ( id, booking_date, court_id, period_number, base_price, final_price, water_quantity )
      `)
      .eq('id', id)
      .single()

    if (error || !invoice) return Response.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    // لو باقة — جلب كل حجوزات الباقة
    let batchBookings = null
    if (invoice.batch_id) {
      const { data } = await admin
        .from('bookings')
        .select('id, booking_date, court_id, period_number, base_price, final_price, water_quantity, discount_amount, code_used')
        .eq('batch_id', invoice.batch_id)
        .order('booking_date', { ascending: true })
      batchBookings = data
    }

    return Response.json({ invoice, batch_bookings: batchBookings })
  } catch (err) {
    console.error('[admin/invoices/id/get]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { data: adminUser } = await supabase
      .from('admin_users').select('role').eq('id', user.id).single()
    if (adminUser?.role !== 'admin')
      return Response.json({ error: 'إلغاء الفاتورة للمدير فقط' }, { status: 403 })

    const { id }          = await params
    const { cancel_reason } = await request.json()
    const admin           = createAdminClient()

    // جلب الفاتورة للتأكد من حالتها
    const { data: invoice, error: fetchErr } = await admin
      .from('invoices')
      .select('id, status, booking_id, batch_id')
      .eq('id', id)
      .single()

    if (fetchErr || !invoice) return Response.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    if (invoice.status === 'cancelled') return Response.json({ error: 'الفاتورة ملغاة بالفعل' }, { status: 400 })

    const reason = cancel_reason?.trim() || 'إلغاء يدوي من الإدارة'

    if (invoice.booking_id) {
      await cancelInvoicesForBooking(invoice.booking_id, reason, admin)
    } else if (invoice.batch_id) {
      await cancelInvoicesForBatch(invoice.batch_id, reason, admin)
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[admin/invoices/id/patch]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
