// ============================================================
// src/lib/payments.ts
// خدمة الدفعات — تسجيل، جلب، حذف، حساب الرصيد
// المنطق المعقد هنا — الـ Trigger في DB يقتصر على المزامنة البسيطة فقط
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

/* ── أنواع ────────────────────────────────────────────────── */

export interface PaymentInput {
  invoice_id:       string
  customer_id:      string
  amount:           number
  payment_method:   string   // يجب أن يوجد في جدول payment_methods
  payment_date?:    string   // YYYY-MM-DD (افتراضي: اليوم)
  reference_number?: string
  notes?:           string
  recorded_by:      string   // UUID المشرف
}

export interface BalanceSummary {
  total_amount:        number   // المبلغ الأصلي للفاتورة
  approved_cn_total:   number   // مجموع CNs المعتمدة
  net_amount:          number   // الصافي المطلوب (total - CNs)
  paid_amount:         number   // إجمالي الدفعات
  balance_due:         number   // المتبقي (net - paid)
  payment_status:      'unpaid' | 'partial' | 'paid'
}

/* ─────────────────────────────────────────────────────────────
   recordPayment — تسجيل دفعة جديدة
   يتحقق من:
     1. الفاتورة موجودة وحالتها issued
     2. مبلغ الدفعة > 0
     3. المبلغ لا يتجاوز الرصيد المتبقي
     4. طريقة الدفع موجودة في payment_methods
───────────────────────────────────────────────────────────── */
export async function recordPayment(
  input: PaymentInput,
  adminClient?: AdminClient
): Promise<{ id: string }> {
  const admin = adminClient ?? createAdminClient()

  // 1. التحقق من الفاتورة
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select('id, status, total_amount, customer_id')
    .eq('id', input.invoice_id)
    .single()

  if (invErr || !invoice) {
    throw new Error('[recordPayment] الفاتورة غير موجودة')
  }
  if (invoice.status !== 'issued') {
    throw new Error('[recordPayment] لا يمكن تسجيل دفعة على فاتورة ملغاة')
  }

  // 2. التحقق من المبلغ
  if (input.amount <= 0) {
    throw new Error('[recordPayment] مبلغ الدفعة يجب أن يكون أكبر من صفر')
  }

  // 3. التحقق من الرصيد المتبقي
  const balance = await getInvoiceBalance(input.invoice_id, admin)
  if (input.amount > balance.balance_due + 0.01) {
    // 0.01 هامش لأخطاء الفاصلة العائمة
    throw new Error(
      `[recordPayment] مبلغ الدفعة (${input.amount}) يتجاوز الرصيد المتبقي (${balance.balance_due})`
    )
  }

  // 4. التحقق من طريقة الدفع
  const { data: method } = await admin
    .from('payment_methods')
    .select('name')
    .eq('name', input.payment_method)
    .eq('is_active', true)
    .single()

  if (!method) {
    throw new Error(`[recordPayment] طريقة الدفع "${input.payment_method}" غير موجودة أو معطّلة`)
  }

  // 5. إدراج الدفعة
  const { data, error } = await admin
    .from('payments')
    .insert({
      invoice_id:      input.invoice_id,
      customer_id:     input.customer_id,
      amount:          input.amount,
      payment_method:  input.payment_method,
      payment_date:    input.payment_date ?? new Date().toISOString().split('T')[0],
      reference_number: input.reference_number ?? null,
      notes:           input.notes ?? null,
      recorded_by:     input.recorded_by,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[recordPayment] فشل تسجيل الدفعة: ${error?.message}`)
  }

  // الـ Trigger في DB يُحدّث payment_status تلقائياً

  return { id: data.id }
}

/* ─────────────────────────────────────────────────────────────
   getInvoiceBalance — حساب الرصيد الحقيقي لفاتورة
   يشمل: إجمالي الفاتورة - CNs المعتمدة = الصافي المطلوب
         الصافي المطلوب - إجمالي الدفعات = المتبقي
───────────────────────────────────────────────────────────── */
export async function getInvoiceBalance(
  invoice_id: string,
  adminClient?: AdminClient
): Promise<BalanceSummary> {
  const admin = adminClient ?? createAdminClient()

  // جلب الفاتورة
  const { data: invoice } = await admin
    .from('invoices')
    .select('total_amount')
    .eq('id', invoice_id)
    .single()

  const total_amount = Number(invoice?.total_amount ?? 0)

  // مجموع CNs المعتمدة فقط
  const { data: cnData } = await admin
    .from('credit_notes')
    .select('amount')
    .eq('invoice_id', invoice_id)
    .eq('status', 'approved')

  const approved_cn_total = (cnData ?? []).reduce((sum, cn) => sum + Number(cn.amount), 0)

  // الصافي المطلوب
  const net_amount = Math.max(0, total_amount - approved_cn_total)

  // مجموع الدفعات
  const { data: payData } = await admin
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoice_id)

  const paid_amount = (payData ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  // الرصيد المتبقي
  const balance_due = Math.max(0, net_amount - paid_amount)

  // حالة الدفع
  let payment_status: BalanceSummary['payment_status'] = 'unpaid'
  if (paid_amount > 0 && paid_amount >= net_amount - 0.01) {
    payment_status = 'paid'
  } else if (paid_amount > 0) {
    payment_status = 'partial'
  }

  return {
    total_amount,
    approved_cn_total,
    net_amount,
    paid_amount,
    balance_due,
    payment_status,
  }
}

/* ─────────────────────────────────────────────────────────────
   deletePayment — حذف دفعة خاطئة (admin فقط)
───────────────────────────────────────────────────────────── */
export async function deletePayment(
  payment_id: string,
  adminClient?: AdminClient
): Promise<void> {
  const admin = adminClient ?? createAdminClient()

  const { error } = await admin
    .from('payments')
    .delete()
    .eq('id', payment_id)

  if (error) {
    throw new Error(`[deletePayment] فشل حذف الدفعة: ${error.message}`)
  }

  // الـ Trigger يُحدّث payment_status تلقائياً بعد الحذف
}
