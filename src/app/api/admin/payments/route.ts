// ============================================================
// POST /api/admin/payments      — تسجيل دفعة جديدة
// GET  /api/admin/payments      — جلب دفعات + رصيد فاتورة
//                                 أو جلب كل الدفعات (بدون invoice_id)
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { recordPayment, getInvoiceBalance } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_payments')
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
      recorded_by: auth.userId,
    }, admin)

    // أعد الرصيد المحدّث
    const balance = await getInvoiceBalance(invoice_id, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'payments',
      record_id:    id,
      action:       'insert',
      performed_by: auth.userId,
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
    const auth = await requirePermission('view_invoices')
    if (!auth.ok) return auth.response

    const url           = new URL(request.url)
    const invoice_id    = url.searchParams.get('invoice_id')
    const period        = url.searchParams.get('period')   // today | week | month | all
    const method_filter = url.searchParams.get('method')  // bank_transfer | cash | other | all

    const admin = createAdminClient()

    // ── الوضع القديم: فاتورة محددة (الاستخدام الحالي لا يُكسر) ──
    if (invoice_id) {
      const { data: payments, error } = await admin
        .from('payments')
        .select('id, amount, payment_method, payment_date, reference_number, notes, recorded_by, created_at')
        .eq('invoice_id', invoice_id)
        .order('payment_date', { ascending: true })

      if (error) throw error

      const balance = await getInvoiceBalance(invoice_id, admin)

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
    }

    // ── الوضع الجديد: كل الدفعات (صفحة /admin/payments) ──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = admin
      .from('payments')
      .select(`
        id, amount, payment_method, payment_date,
        reference_number, notes, created_at, invoice_id,
        invoices (
          id,
          invoice_number,
          customers ( id, name )
        )
      `)
      .order('payment_date', { ascending: false })
      .order('created_at',   { ascending: false })

    // فلتر نطاق التاريخ
    const todayStr = new Date().toISOString().split('T')[0]
    if (period === 'today') {
      query = query.gte('payment_date', todayStr).lte('payment_date', todayStr)
    } else if (period === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      query = query.gte('payment_date', d.toISOString().split('T')[0])
    } else if (period === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 29)
      query = query.gte('payment_date', d.toISOString().split('T')[0])
    }
    // period === 'all' أو غياب الفلتر = بدون تصفية تاريخية

    // فلتر طريقة الدفع
    if (method_filter && method_filter !== 'all') {
      query = query.eq('payment_method', method_filter)
    }

    const { data: payments, error: allErr } = await query
    if (allErr) throw allErr

    // طرق الدفع للتسميات والفلتر
    const { data: methods } = await admin
      .from('payment_methods')
      .select('name, label_ar')
      .eq('is_active', true)
      .order('sort_order')

    const methodLabels = Object.fromEntries((methods ?? []).map(m => [m.name, m.label_ar]))

    const mapped = (payments ?? []).map((p: {
      id: string
      amount: number
      payment_method: string
      payment_date: string
      reference_number: string | null
      notes: string | null
      created_at: string
      invoice_id: string
      invoices: {
        id: string
        invoice_number: string
        customers: { id: string; name: string } | null
      } | null
    }) => ({
      id:                   p.id,
      amount:               Number(p.amount),
      payment_method:       p.payment_method,
      payment_method_label: methodLabels[p.payment_method] ?? p.payment_method,
      payment_date:         p.payment_date,
      reference_number:     p.reference_number,
      notes:                p.notes,
      created_at:           p.created_at,
      invoice_id:           p.invoice_id,
      invoice_number:       p.invoices?.invoice_number ?? null,
      customer_name:        p.invoices?.customers?.name ?? null,
    }))

    const total = mapped.reduce((s: number, p: { amount: number }) => s + p.amount, 0)

    return Response.json({
      payments:        mapped,
      total,
      count:           mapped.length,
      payment_methods: methods ?? [],
    })
  } catch (err) {
    console.error('[GET /api/admin/payments]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
