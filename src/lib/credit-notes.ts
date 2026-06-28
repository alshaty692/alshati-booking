// ============================================================
// src/lib/credit-notes.ts
// خدمة إشعارات الائتمان — إنشاء، اعتماد، إلغاء، استعلام
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

/* ── أنواع ────────────────────────────────────────────────── */

export type CreditNoteType = 'price_adjustment' | 'partial_refund' | 'error_correction'
export type CreditNoteStatus = 'draft' | 'approved' | 'cancelled'

export interface CreditNoteInput {
  invoice_id:  string
  customer_id: string
  amount:      number
  reason:      string       // نص حر، مطلوب
  type:        CreditNoteType
  items?:      string       // JSON أو نص حر للبنود المتأثرة
  created_by:  string       // UUID
}

/* ─────────────────────────────────────────────────────────────
   createCreditNote — إنشاء إشعار ائتمان (بحالة draft)
   يتحقق من:
     1. الفاتورة موجودة وحالتها issued
     2. amount > 0
     3. amount لا يتجاوز total_amount للفاتورة
───────────────────────────────────────────────────────────── */
export async function createCreditNote(
  input: CreditNoteInput,
  adminClient?: AdminClient
): Promise<{ id: string; credit_note_number: string }> {
  const admin = adminClient ?? createAdminClient()

  // 1. التحقق من الفاتورة
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select('id, status, total_amount')
    .eq('id', input.invoice_id)
    .single()

  if (invErr || !invoice) {
    throw new Error('[createCreditNote] الفاتورة غير موجودة')
  }
  if (invoice.status !== 'issued') {
    throw new Error('[createCreditNote] لا يمكن إنشاء إشعار ائتمان لفاتورة ملغاة')
  }

  // 2. التحقق من المبلغ
  if (input.amount <= 0) {
    throw new Error('[createCreditNote] المبلغ يجب أن يكون أكبر من صفر')
  }

  // 3. التحقق أن المبلغ لا يتجاوز إجمالي الفاتورة
  // (نحسب مجموع CNs الموجودة + الجديد)
  const { data: existingCNs } = await admin
    .from('credit_notes')
    .select('amount')
    .eq('invoice_id', input.invoice_id)
    .in('status', ['draft', 'approved']) // نشمل draft لنمنع تجاوز الحد

  const existingTotal = (existingCNs ?? []).reduce((sum, cn) => sum + Number(cn.amount), 0)
  if (existingTotal + input.amount > Number(invoice.total_amount)) {
    throw new Error(
      `[createCreditNote] مجموع إشعارات الائتمان (${existingTotal + input.amount}) يتجاوز إجمالي الفاتورة (${invoice.total_amount})`
    )
  }

  // 4. توليد رقم الإشعار
  const { data: cnNumber } = await admin.rpc('next_credit_note_number')
  if (!cnNumber) throw new Error('[createCreditNote] فشل توليد رقم الإشعار')

  // 5. إدراج الإشعار
  const { data, error } = await admin
    .from('credit_notes')
    .insert({
      credit_note_number: cnNumber,
      invoice_id:  input.invoice_id,
      customer_id: input.customer_id,
      amount:      input.amount,
      reason:      input.reason,
      type:        input.type,
      items:       input.items ?? null,
      status:      'draft',
      created_by:  input.created_by,
    })
    .select('id, credit_note_number')
    .single()

  if (error || !data) {
    throw new Error(`[createCreditNote] فشل إنشاء الإشعار: ${error?.message}`)
  }

  return { id: data.id, credit_note_number: data.credit_note_number }
}

/* ─────────────────────────────────────────────────────────────
   approveCreditNote — اعتماد إشعار (admin فقط)
   بعد الاعتماد: لا تعديل، فقط إلغاء إذا لم يُستخدم
───────────────────────────────────────────────────────────── */
export async function approveCreditNote(
  cn_id:       string,
  approved_by: string,
  adminClient?: AdminClient
): Promise<void> {
  const admin = adminClient ?? createAdminClient()

  const { data: cn, error: fetchErr } = await admin
    .from('credit_notes')
    .select('id, status')
    .eq('id', cn_id)
    .single()

  if (fetchErr || !cn) throw new Error('[approveCreditNote] الإشعار غير موجود')
  if (cn.status !== 'draft') {
    throw new Error(`[approveCreditNote] لا يمكن اعتماد إشعار بحالة "${cn.status}" — يجب أن يكون draft`)
  }

  const { error } = await admin
    .from('credit_notes')
    .update({
      status:      'approved',
      approved_by,
      approved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', cn_id)

  if (error) throw new Error(`[approveCreditNote] فشل الاعتماد: ${error.message}`)

  // الـ Trigger يُحدّث payment_status على الفاتورة تلقائياً
}

/* ─────────────────────────────────────────────────────────────
   cancelCreditNote — إلغاء إشعار (قبل الاعتماد فقط)
   الإشعارات المعتمدة لا تُلغى — يُنشأ CN جديد عوضاً
───────────────────────────────────────────────────────────── */
export async function cancelCreditNote(
  cn_id:        string,
  cancelled_by: string,
  cancel_reason?: string,
  adminClient?: AdminClient
): Promise<void> {
  const admin = adminClient ?? createAdminClient()

  const { data: cn, error: fetchErr } = await admin
    .from('credit_notes')
    .select('id, status')
    .eq('id', cn_id)
    .single()

  if (fetchErr || !cn) throw new Error('[cancelCreditNote] الإشعار غير موجود')
  if (cn.status === 'approved') {
    throw new Error(
      '[cancelCreditNote] لا يمكن إلغاء إشعار معتمد — أنشئ إشعار ائتمان جديد لعكس العملية'
    )
  }
  if (cn.status === 'cancelled') {
    throw new Error('[cancelCreditNote] الإشعار ملغى مسبقاً')
  }

  const { error } = await admin
    .from('credit_notes')
    .update({
      status:        'cancelled',
      cancelled_by,
      cancelled_at:  new Date().toISOString(),
      cancel_reason: cancel_reason ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', cn_id)

  if (error) throw new Error(`[cancelCreditNote] فشل الإلغاء: ${error.message}`)
}

/* ─────────────────────────────────────────────────────────────
   getCreditNotesForInvoice — جلب إشعارات فاتورة مع المجموع
───────────────────────────────────────────────────────────── */
export async function getCreditNotesForInvoice(
  invoice_id: string,
  adminClient?: AdminClient
) {
  const admin = adminClient ?? createAdminClient()

  const { data, error } = await admin
    .from('credit_notes')
    .select('*')
    .eq('invoice_id', invoice_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`[getCreditNotesForInvoice] ${error.message}`)

  const approvedTotal = (data ?? [])
    .filter(cn => cn.status === 'approved')
    .reduce((sum, cn) => sum + Number(cn.amount), 0)

  return { credit_notes: data ?? [], approved_total: approvedTotal }
}
