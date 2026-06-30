// ============================================================
// src/lib/invoices.ts
// دوال مشتركة لإنشاء وإلغاء الفواتير
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

/* ── أنواع ──────────────────────────────────────────────── */

export interface InvoiceBookingData {
  booking_id:      string
  customer_id:     string
  base_price:      number
  discount_amount: number
  discount_code:   string | null
  final_price:     number       // court amount بعد الخصم (بدون المياه)
  water_quantity:  number
  water_unit_price: number
}

export interface BatchSlotData {
  booking_id:      string
  base_price:      number
  discount_amount: number
  discount_code:   string | null
  final_price:     number
  water_quantity:  number
}

/* ── دوال مساعدة ────────────────────────────────────────── */

function calcDiscountPercentage(discountAmount: number, basePrice: number): number {
  if (!basePrice || basePrice === 0) return 0
  return Math.round((discountAmount / basePrice) * 100 * 100) / 100  // دقة خانتين
}

async function getNextInvoiceNumber(admin: AdminClient): Promise<string> {
  const { data } = await admin.rpc('next_invoice_number')
  if (!data) throw new Error('[invoices] فشل توليد رقم الفاتورة')
  return data as string
}

/* ─────────────────────────────────────────────────────────────
   createInvoice — فاتورة لحجز فردي
───────────────────────────────────────────────────────────── */
export async function createInvoice(
  booking: InvoiceBookingData,
  adminClient?: AdminClient
): Promise<{ invoice_number: string; id: string }> {
  const admin = adminClient ?? createAdminClient()

  const invoice_number = await getNextInvoiceNumber(admin)

  const court_amount        = booking.final_price        // بعد الخصم
  const base_price          = booking.base_price
  const discount_amount     = booking.discount_amount
  const discount_percentage = calcDiscountPercentage(discount_amount, base_price)
  const water_total         = booking.water_quantity * booking.water_unit_price
  const total_amount        = court_amount + water_total

  const { data, error } = await admin
    .from('invoices')
    .insert({
      invoice_number,
      customer_id:         booking.customer_id,
      booking_id:          booking.booking_id,
      court_amount,
      base_price,
      discount_amount,
      discount_code:       booking.discount_code,
      discount_percentage,
      water_quantity:      booking.water_quantity,
      water_unit_price:    booking.water_unit_price,
      water_total,
      total_amount,
      status:              'issued',
    })
    .select('id, invoice_number')
    .single()

  if (error || !data) {
    throw new Error(`[createInvoice] ${error?.message}`)
  }

  // تحديث إحصائيات العميل
  await updateCustomerStats(booking.customer_id, total_amount, 1, admin)

  return { invoice_number: data.invoice_number, id: data.id }
}

/* ─────────────────────────────────────────────────────────────
   createBatchInvoices — فاتورة/فواتير لباقة
   invoice_type: 'per_booking' → N فواتير منفصلة
   invoice_type: 'combined'    → فاتورة واحدة للكل
───────────────────────────────────────────────────────────── */
export async function createBatchInvoices(opts: {
  slots:         BatchSlotData[]
  customer_id:   string
  batch_id:      string
  invoice_type:  'per_booking' | 'combined'
  water_unit_price: number
  adminClient?:  AdminClient
}): Promise<{ invoice_numbers: string[] }> {
  const admin = opts.adminClient ?? createAdminClient()
  const { slots, customer_id, batch_id, invoice_type, water_unit_price } = opts
  const invoice_numbers: string[] = []

  if (invoice_type === 'per_booking') {
    // فاتورة منفصلة لكل حجز
    for (const slot of slots) {
      const inv = await createInvoice(
        {
          booking_id:      slot.booking_id,
          customer_id,
          base_price:      slot.base_price,
          discount_amount: slot.discount_amount,
          discount_code:   slot.discount_code,
          final_price:     slot.final_price,
          water_quantity:  slot.water_quantity,
          water_unit_price,
        },
        admin
      )
      invoice_numbers.push(inv.invoice_number)
    }
  } else {
    // فاتورة واحدة مجمّعة للباقة كلها
    const invoice_number = await getNextInvoiceNumber(admin)

    const totals = slots.reduce(
      (acc, s) => ({
        base_price:      acc.base_price      + s.base_price,
        discount_amount: acc.discount_amount + s.discount_amount,
        court_amount:    acc.court_amount    + s.final_price,
        water_quantity:  acc.water_quantity  + s.water_quantity,
      }),
      { base_price: 0, discount_amount: 0, court_amount: 0, water_quantity: 0 }
    )

    const water_total         = totals.water_quantity * water_unit_price
    const total_amount        = totals.court_amount + water_total
    const discount_percentage = calcDiscountPercentage(totals.discount_amount, totals.base_price)

    // نأخذ كود الخصم من أول فترة لها كود (المجمّعة قد تحتوي أكواداً مختلفة)
    const discount_code = slots.find(s => s.discount_code)?.discount_code ?? null

    const { data, error } = await admin
      .from('invoices')
      .insert({
        invoice_number,
        customer_id,
        booking_id:          null,
        batch_id,
        court_amount:        totals.court_amount,
        base_price:          totals.base_price,
        discount_amount:     totals.discount_amount,
        discount_code,
        discount_percentage,
        water_quantity:      totals.water_quantity,
        water_unit_price,
        water_total,
        total_amount,
        status:              'issued',
      })
      .select('id, invoice_number')
      .single()

    if (error || !data) throw new Error(`[createBatchInvoices/combined] ${error?.message}`)

    invoice_numbers.push(data.invoice_number)
    await updateCustomerStats(customer_id, total_amount, slots.length, admin)
  }

  return { invoice_numbers }
}

/* ─────────────────────────────────────────────────────────────
   cancelInvoicesForBooking — إلغاء فاتورة حجز فردي
───────────────────────────────────────────────────────────── */
export async function cancelInvoicesForBooking(
  booking_id:   string,
  cancel_reason = 'إلغاء الحجز المرتبط',
  adminClient?: AdminClient
): Promise<void> {
  const admin = adminClient ?? createAdminClient()

  // اجلب الفواتير المصدرة لهذا الحجز لتحديث إحصائيات العميل
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, customer_id, total_amount')
    .eq('booking_id', booking_id)
    .eq('status', 'issued')

  if (!invoices || invoices.length === 0) return

  await admin
    .from('invoices')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason })
    .eq('booking_id', booking_id)
    .eq('status', 'issued')

  // تحديث إحصائيات العميل (طرح net_amount لا total_amount)
  // سبب: لو اعتُمد CN سابقاً، total_paid انخفض بمبلغ CN بالفعل
  // فنطرح فقط الصافي المتبقي لتجنب الطرح المزدوج
  for (const inv of invoices) {
    // احسب مجموع CNs المعتمدة لهذه الفاتورة
    const { data: cnsData } = await admin
      .from('credit_notes')
      .select('amount')
      .eq('invoice_id', inv.id)
      .eq('status', 'approved')
    const approvedCNsTotal = (cnsData ?? []).reduce((s, cn) => s + Number(cn.amount), 0)
    const netAmount = Math.max(0, Number(inv.total_amount) - approvedCNsTotal)
    await updateCustomerStats(inv.customer_id, -netAmount, -1, admin)
  }
}

/* ─────────────────────────────────────────────────────────────
   cancelInvoicesForBatch — إلغاء فواتير باقة كاملة
───────────────────────────────────────────────────────────── */
export async function cancelInvoicesForBatch(
  batch_id:     string,
  cancel_reason = 'إلغاء الباقة المرتبطة',
  adminClient?: AdminClient
): Promise<void> {
  const admin = adminClient ?? createAdminClient()

  const { data: invoices } = await admin
    .from('invoices')
    .select('id, customer_id, total_amount')
    .eq('batch_id', batch_id)
    .eq('status', 'issued')

  if (!invoices || invoices.length === 0) return

  await admin
    .from('invoices')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason })
    .eq('batch_id', batch_id)
    .eq('status', 'issued')

  // نفس منطق cancelInvoicesForBooking — نطرح net لا total
  for (const inv of invoices) {
    const { data: cnsData } = await admin
      .from('credit_notes')
      .select('amount')
      .eq('invoice_id', inv.id)
      .eq('status', 'approved')
    const approvedCNsTotal = (cnsData ?? []).reduce((s, cn) => s + Number(cn.amount), 0)
    const netAmount = Math.max(0, Number(inv.total_amount) - approvedCNsTotal)
    await updateCustomerStats(inv.customer_id, -netAmount, -1, admin)
  }
}

/* ─────────────────────────────────────────────────────────────
   updateCustomerStats — مُصدَّرة لاستخدامها في lib/credit-notes.ts
   amountDelta: موجب عند إصدار، سالب عند إلغاء أو اعتماد CN
───────────────────────────────────────────────────────────── */
export async function updateCustomerStats(
  customer_id:    string,
  amountDelta:    number,   // موجب عند إصدار، سالب عند إلغاء
  bookingsDelta:  number,
  admin:          AdminClient
): Promise<void> {
  try {
    // نقرأ القيم الحالية أولاً ثم نحدّثها (لتجنب قيم سالبة)
    const { data: cust } = await admin
      .from('customers')
      .select('total_paid, total_bookings')
      .eq('id', customer_id)
      .single()

    if (!cust) return

    const newPaid     = Math.max(0, (Number(cust.total_paid)     || 0) + amountDelta)
    const newBookings = Math.max(0, (Number(cust.total_bookings) || 0) + bookingsDelta)

    await admin
      .from('customers')
      .update({ total_paid: newPaid, total_bookings: newBookings, updated_at: new Date().toISOString() })
      .eq('id', customer_id)
  } catch {
    // لا نوقف التدفق بسبب خطأ في الإحصائيات
    console.warn('[updateCustomerStats] فشل تحديث إحصائيات العميل:', customer_id)
  }
}
