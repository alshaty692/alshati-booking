// ============================================================
// POST /api/admin/payments      — تسجيل دفعة جديدة
// GET  /api/admin/payments      — جلب دفعات + رصيد فاتورة
// ============================================================
import { NextRequest } from 'next/server'
import { requireAdminRole } from '@/lib/auth'
import { recordPayment, getInvoiceBalance } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['admin', 'editor'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { invoice_id, amount, payment_method, payment_date, reference_number, notes } = body

    if (!invoice_id)      return Response.json({ error: 'invoice_id مطلوب' }, { status: 400 })
    if (!amount)          return Response.json({ error: 'amount مطلوب' }, { status: 400 })
    if (!payment_method)  return Response.json({ error: 'payment_method مطلوب' }, { status: 400 })

    const numericAmount = Number(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Response.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }

    // جلب customer_id من الفاتورة
    const admin = createAdminClient()
    const { data: invoice } = await admin
      .from('invoices')
      .select('customer_id')
      .eq('id', invoice_id)
      .single()

    if (!invoice) return Response.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    const { id } = await recordPayment({
      invoice_id,
      customer_id:     invoice.customer_id,
      amount:          numericAmount,
      payment_method,
      payment_date,
      reference_number,
      notes,
      recorded_by: auth.session.userId,
    }, admin)

    // أعد الرصيد المحدّث
    const balance = await getInvoiceBalance(invoice_id, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'payments',
      record_id:    id,
      action:       'insert',
      performed_by: auth.session.userId,
      notes:        `تسجيل دفعة ${numericAmount} ريال بطريقة ${payment_method} على الفاتورة ${invoice_id}`,
    })

    return Response.json({ success: true, payment_id: id, balance }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ'
    console.error('[POST /api/admin/payments]', err)
    return Response.json({ error: msg }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const invoice_id = new URL(request.url).searchParams.get('invoice_id')
    if (!invoice_id) return Response.json({ error: 'invoice_id مطلوب' }, { status: 400 })

    const admin = createAdminClient()

    const { data: payments, error } = await admin
      .from('payments')
      .select('id, amount, payment_method, payment_date, reference_number, notes, recorded_by, created_at')
      .eq('invoice_id', invoice_id)
      .order('payment_date', { ascending: true })

    if (error) throw error

    const balance = await getInvoiceBalance(invoice_id, admin)

    // جلب أسماء طرق الدفع بالعربي
    const { data: methods } = await admin
      .from('payment_methods')
      .select('name, label_ar')

    const methodLabels = Object.fromEntries((methods ?? []).map(m => [m.name, m.label_ar]))

    return Response.json({
      payments: (payments ?? []).map(p => ({
        ...p,
        payment_method_label: methodLabels[p.payment_method] ?? p.payment_method,
      })),
      balance,
    })
  } catch (err) {
    console.error('[GET /api/admin/payments]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
