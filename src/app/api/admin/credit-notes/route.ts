// ============================================================
// POST /api/admin/credit-notes     — إنشاء إشعار ائتمان (draft)
// GET  /api/admin/credit-notes     — جلب إشعارات:
//   ?invoice_id=X  → إشعارات فاتورة محددة (السلوك الأصلي)
//   بدون params   → كل الإشعارات (مع فلترة اختيارية بـ status)
// ============================================================
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { createCreditNote, getCreditNotesForInvoice } from '@/lib/credit-notes'
import { createAdminClient } from '@/lib/supabase/server'
import type { CreditNoteType } from '@/lib/credit-notes'

const VALID_TYPES: CreditNoteType[] = ['price_adjustment', 'partial_refund', 'error_correction']

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_credit_notes')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { invoice_id, amount, reason, type, items } = body

    if (!invoice_id) return Response.json({ error: 'invoice_id مطلوب' }, { status: 400 })
    if (!amount)     return Response.json({ error: 'amount مطلوب' }, { status: 400 })
    if (!reason?.trim()) return Response.json({ error: 'reason مطلوب' }, { status: 400 })
    if (!VALID_TYPES.includes(type)) {
      return Response.json({
        error: `نوع الإشعار غير صالح — القيم المتاحة: ${VALID_TYPES.join(', ')}`,
      }, { status: 400 })
    }

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

    const { id, credit_note_number } = await createCreditNote({
      invoice_id,
      customer_id: invoice.customer_id,
      amount:      numericAmount,
      reason:      reason.trim(),
      type,
      items:       items ?? null,
      created_by:  auth.userId,
    }, admin)

    // تسجيل في audit_log
    await admin.from('audit_log').insert({
      table_name:   'credit_notes',
      record_id:    id,
      action:       'insert',
      performed_by: auth.userId,
      notes:        `إنشاء إشعار ائتمان ${credit_note_number} بمبلغ ${numericAmount} ريال — ${type}`,
    })

    return Response.json({ success: true, id, credit_note_number }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ'
    console.error('[POST /api/admin/credit-notes]', err)
    return Response.json({ error: msg }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_invoices')
    if (!auth.ok) return auth.response

    const params    = new URL(request.url).searchParams
    const invoiceId = params.get('invoice_id')
    const status    = params.get('status')   // 'draft' | 'approved' | 'cancelled' | null=all
    const limit     = Math.min(200, Number(params.get('limit') ?? 100))

    // ── السلوك الأصلي: جلب إشعارات فاتورة محددة ──────────────
    if (invoiceId) {
      const { credit_notes, approved_total } = await getCreditNotesForInvoice(invoiceId)
      return Response.json({ credit_notes, approved_total })
    }

    // ── السلوك الجديد: جلب كل الإشعارات (للصفحة المستقلة) ────
    const admin = createAdminClient()

    let query = admin
      .from('credit_notes')
      .select(`
        id,
        credit_note_number,
        invoice_id,
        customer_id,
        amount,
        reason,
        type,
        status,
        created_at,
        approved_at,
        cancelled_at,
        cancel_reason,
        invoices (
          id,
          invoice_number,
          booking_id,
          bookings ( id, booking_date, court_id, period_number )
        ),
        customers ( id, name, phone, customer_code )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ credit_notes: data ?? [] })
  } catch (err) {
    console.error('[GET /api/admin/credit-notes]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
