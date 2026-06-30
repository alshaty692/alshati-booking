// ============================================================
// src/lib/bookings.ts
// deleteBookingPermanently — الدالة المركزية للحذف النهائي
// تشمل التحصينات T1–T11 كاملة
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { updateCustomerStats } from '@/lib/invoices'

type AdminClient = ReturnType<typeof createAdminClient>

/* ── أنواع ──────────────────────────────────────────────── */

export interface DeleteBookingResult {
  success:  boolean
  error?:   string
  warning?: string   // تحذير غير حرج (مثل: blocked_slot مكرر)
}

export interface PreDeleteCheckResult {
  isStatusEligible: boolean    // هل حالة الحجز تسمح بالحذف؟
  hasRating:        boolean
  ratingValue?:     number
  invoiceType:      'per_booking' | 'combined' | 'none'
  invoiceNumber?:   string
  hasPayments:      boolean
  hasApprovedCNs:   boolean
  isBlocked:        boolean    // هل الحذف ممنوع بسبب أحد القيود؟
  blockReason?:     'booking_still_active' | 'combined_invoice' | 'has_payments' | 'has_approved_cns'
}

const ELIGIBLE_STATUSES = ['cancelled', 'rejected', 'expired'] as const

/* ── preDeleteCheck — فحص ما قبل الحذف (للـ API ولا يُعدّل البيانات) ── */

export async function preDeleteCheck(
  bookingId: string,
  adminClient?: AdminClient
): Promise<PreDeleteCheckResult> {
  const admin = adminClient ?? createAdminClient()

  // 1. جلب بيانات الحجز
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return {
      isStatusEligible: false,
      hasRating: false,
      invoiceType: 'none',
      hasPayments: false,
      hasApprovedCNs: false,
      isBlocked: true,
      blockReason: 'booking_still_active',
    }
  }

  // 2. فحص حالة الحجز
  const isStatusEligible = (ELIGIBLE_STATUSES as readonly string[]).includes(booking.status)
  if (!isStatusEligible) {
    return {
      isStatusEligible: false,
      hasRating: false,
      invoiceType: 'none',
      hasPayments: false,
      hasApprovedCNs: false,
      isBlocked: true,
      blockReason: 'booking_still_active',
    }
  }

  // 3. فحص التقييم (T2)
  const { data: ratingRow } = await admin
    .from('booking_ratings')
    .select('rating')
    .eq('booking_id', bookingId)
    .maybeSingle()

  // 4. جلب الفاتورة المرتبطة
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, invoice_number, booking_id, batch_id')
    .eq('booking_id', bookingId)
    .eq('status', 'issued')
    .limit(1)

  const invoice = invoices?.[0] ?? null

  // 5. تحديد نوع الفاتورة (T3)
  // لو الحجز جزء من باقة، نبحث عن فاتورة combined (batch_id = booking.batch_id, booking_id = null)
  let invoiceType: 'per_booking' | 'combined' | 'none' = 'none'
  let invoiceId: string | null = null
  let invoiceNumber: string | undefined

  if (invoice) {
    // فاتورة per_booking: لها booking_id = هذا الحجز
    invoiceType = 'per_booking'
    invoiceId = invoice.id
    invoiceNumber = invoice.invoice_number
  } else {
    // هل فيه فاتورة combined للباقة؟ (نحتاج batch_id أولاً)
    const { data: bk } = await admin
      .from('bookings')
      .select('batch_id')
      .eq('id', bookingId)
      .single()

    if (bk?.batch_id) {
      const { data: combinedInv } = await admin
        .from('invoices')
        .select('id, invoice_number')
        .eq('batch_id', bk.batch_id)
        .is('booking_id', null)
        .eq('status', 'issued')
        .limit(1)

      if (combinedInv?.[0]) {
        invoiceType = 'combined'
        invoiceId = combinedInv[0].id
        invoiceNumber = combinedInv[0].invoice_number
      }
    }
  }

  // T3: فاتورة combined → حذف فردي ممنوع
  if (invoiceType === 'combined') {
    return {
      isStatusEligible: true,
      hasRating: !!ratingRow,
      ratingValue: ratingRow?.rating,
      invoiceType: 'combined',
      invoiceNumber,
      hasPayments: false,
      hasApprovedCNs: false,
      isBlocked: true,
      blockReason: 'combined_invoice',
    }
  }

  // 6. T4: فحص مدفوعات وCNs معتمدة
  let hasPayments = false
  let hasApprovedCNs = false

  if (invoiceId) {
    const { data: paymentsData } = await admin
      .from('payments')
      .select('id')
      .eq('invoice_id', invoiceId)
      .limit(1)
    hasPayments = (paymentsData?.length ?? 0) > 0

    if (!hasPayments) {
      const { data: cnsData } = await admin
        .from('credit_notes')
        .select('id')
        .eq('invoice_id', invoiceId)
        .eq('status', 'approved')
        .limit(1)
      hasApprovedCNs = (cnsData?.length ?? 0) > 0
    }
  }

  if (hasPayments) {
    return {
      isStatusEligible: true,
      hasRating: !!ratingRow,
      ratingValue: ratingRow?.rating,
      invoiceType,
      invoiceNumber,
      hasPayments: true,
      hasApprovedCNs: false,
      isBlocked: true,
      blockReason: 'has_payments',
    }
  }

  if (hasApprovedCNs) {
    return {
      isStatusEligible: true,
      hasRating: !!ratingRow,
      ratingValue: ratingRow?.rating,
      invoiceType,
      invoiceNumber,
      hasPayments: false,
      hasApprovedCNs: true,
      isBlocked: true,
      blockReason: 'has_approved_cns',
    }
  }

  return {
    isStatusEligible: true,
    hasRating: !!ratingRow,
    ratingValue: ratingRow?.rating,
    invoiceType,
    invoiceNumber,
    hasPayments: false,
    hasApprovedCNs: false,
    isBlocked: false,
  }
}

/* ── deleteBookingPermanently — الدالة المركزية الوحيدة ────── */

export async function deleteBookingPermanently({
  bookingId,
  reason,
  blockSlot,
  adminUserId,
  supabase,
}: {
  bookingId:    string
  reason:       string
  blockSlot:    boolean
  adminUserId:  string
  supabase:     AdminClient
}): Promise<DeleteBookingResult> {

  // ── 0. جلب بيانات الحجز الكاملة ─────────────────────────
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, court_id, booking_date, period_number, customer_phone, customer_name, customer_id, base_price, final_price, batch_id, water_quantity')
    .eq('id', bookingId)
    .single()

  if (fetchErr || !booking) {
    return { success: false, error: 'الحجز غير موجود' }
  }

  // ── T0: فحص حالة الحجز ───────────────────────────────────
  if (!(ELIGIBLE_STATUSES as readonly string[]).includes(booking.status)) {
    return {
      success: false,
      error: 'الحذف النهائي غير متاح للحجوزات النشطة. ألغِ الحجز أولاً ثم حاول الحذف.',
    }
  }

  // ── T3: فحص نوع الفاتورة ─────────────────────────────────
  // نجلب الفاتورة المُصدَرة فقط لفحوصات T3/T4 والإحصائيات
  // لكن سنُزيل booking_id من جميع الفواتير (بأي حالة) في خطوة T1
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_id, total_amount, batch_id, status')
    .eq('booking_id', bookingId)

  // الفاتورة المُصدَرة (إن وُجدت) — للفحوصات والإحصائيات
  const invoice = invoices?.find(inv => inv.status === 'issued') ?? null

  // فاتورة combined للباقة؟
  if (!invoice && booking.batch_id) {
    const { data: combinedInv } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('batch_id', booking.batch_id)
      .is('booking_id', null)
      .eq('status', 'issued')
      .limit(1)

    if (combinedInv?.[0]) {
      return {
        success: false,
        error: `هذا الحجز جزء من باقة بفاتورة موحّدة (${combinedInv[0].invoice_number}). الحذف الفردي غير ممكن — استخدم إلغاء الباقة كاملة.`,
      }
    }
  }

  // ── T4: فحص مدفوعات وCNs معتمدة ─────────────────────────
  if (invoice) {
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id')
      .eq('invoice_id', invoice.id)
      .limit(1)

    if ((paymentsData?.length ?? 0) > 0) {
      return {
        success: false,
        error: 'هذا الحجز فاتورته فيها سجلات مالية (مدفوعات). الحذف غير ممكن — استخدم الإلغاء بدلاً منه.',
      }
    }

    const { data: approvedCNs } = await supabase
      .from('credit_notes')
      .select('id')
      .eq('invoice_id', invoice.id)
      .eq('status', 'approved')
      .limit(1)

    if ((approvedCNs?.length ?? 0) > 0) {
      return {
        success: false,
        error: 'هذا الحجز فاتورته فيها إشعارات ائتمان معتمدة. الحذف غير ممكن — استخدم الإلغاء بدلاً منه.',
      }
    }
  }

  // ── T8: بناء snapshot للحجز ─────────────────────────────
  const snapshot = {
    booking_date:    booking.booking_date,
    court_id:        booking.court_id,
    period_number:   booking.period_number,
    customer_name:   booking.customer_name,
    customer_phone:  booking.customer_phone,
    base_price:      booking.base_price,
    total_amount:    invoice?.total_amount ?? booking.final_price,
    invoice_number:  invoice?.invoice_number ?? null,
  }

  // ── T1: إلغاء الفاتورة المُصدَرة وفصل ربط جميع الفواتير بالحجز ───

  // T1a: إلغاء الفاتورة المُصدَرة + حفظ snapshot (لو موجودة)
  if (invoice) {
    const { error: invoiceErr } = await supabase
      .from('invoices')
      .update({
        status:                     'cancelled',
        cancel_reason:              `حذف نهائي للحجز — السبب: ${reason}`,
        cancelled_at:               new Date().toISOString(),
        cancelled_booking_snapshot: snapshot,
      })
      .eq('id', invoice.id)

    if (invoiceErr) {
      console.error('[deleteBookingPermanently] فشل إلغاء الفاتورة:', invoiceErr)
      return { success: false, error: 'فشل إلغاء الفاتورة المرتبطة' }
    }
  }

  // T1b: فصل booking_id عن جميع الفواتير (بأي حالة) لتجاوز ON DELETE RESTRICT
  // السبب: الفواتير الملغاة مسبقاً لا تزال تحمل booking_id وتمنع الحذف
  const allInvoices = invoices ?? []
  console.log(`[deleteBookingPermanently] فواتير مرتبطة بالحجز: ${allInvoices.length}`)

  for (const inv of allInvoices) {
    const hasExistingBatchId = !!inv.batch_id
    const nullifyUpdate: Record<string, string | null> = { booking_id: null }
    if (!hasExistingBatchId) {
      // نحتاج batch_id بديل لتجنب constraint: (booking_id IS NOT NULL OR batch_id IS NOT NULL)
      nullifyUpdate['batch_id'] = `deleted_booking_${bookingId}`
    }

    const { error: nullifyErr } = await supabase
      .from('invoices')
      .update(nullifyUpdate)
      .eq('id', inv.id)

    if (nullifyErr) {
      console.error(`[deleteBookingPermanently] فشل فصل booking_id للفاتورة ${inv.id}:`, nullifyErr.message)
      return { success: false, error: `فشل فصل ربط الفاتورة (${inv.id}) بالحجز: ${nullifyErr.message}` }
    }
    console.log(`[deleteBookingPermanently] ✓ تم فصل booking_id عن الفاتورة: ${inv.id} (${inv.status})`)
  }

  // ── T10: تنظيف slot_holds ────────────────────────────────
  await supabase
    .from('slot_holds')
    .delete()
    .eq('court_id', booking.court_id)
    .eq('booking_date', booking.booking_date)
    .eq('period_number', booking.period_number)

  // ── T1c: حذف الحجز نهائياً (CASCADE يحذف التقييمات) ─────
  const { error: deleteErr } = await supabase
    .from('bookings')
    .delete()
    .eq('id', bookingId)

  if (deleteErr) {
    console.error('[deleteBookingPermanently] فشل حذف الحجز:', deleteErr)
    return { success: false, error: `فشل حذف الحجز: ${deleteErr.message}` }
  }

  // ── T5+T6+T7: blocked_slots (لو اختار الأدمن "احجز الفترة") ──
  let warningMsg: string | undefined

  if (blockSlot) {
    // T5: فحص إغلاق كامل مجدول
    const { data: closureSettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['closure_full_active', 'closure_full_start'])

    const settingsMap: Record<string, string> = {}
    for (const row of closureSettings ?? []) {
      settingsMap[row.key] = row.value
    }

    const closureActive = settingsMap['closure_full_active'] === 'true'
    const closureStart  = settingsMap['closure_full_start']?.trim()

    let withinFullClosure = false
    if (closureActive && closureStart) {
      // إذا تاريخ الحجز >= تاريخ بداية الإغلاق → ضمن الإغلاق
      withinFullClosure = booking.booking_date >= closureStart
    }

    if (withinFullClosure) {
      warningMsg = 'الفترة ضمن إغلاق مجدول — لم تُضف لـ blocked_slots (الإغلاق الكامل يشملها أصلاً).'
    } else {
      // T6: فحص venue_closures
      const { data: venueClosures } = await supabase
        .from('venue_closures')
        .select('id')
        .eq('court_id', booking.court_id)
        .lte('start_date', booking.booking_date)
        .gte('end_date', booking.booking_date)
        .limit(1)

      if ((venueClosures?.length ?? 0) > 0) {
        warningMsg = 'الفترة ضمن إغلاق ملعب موجود — لم تُضف لـ blocked_slots (الإغلاق يشملها أصلاً).'
      } else {
        // T7: تحقق من blocked_slot موجود
        const { data: existingBlock } = await supabase
          .from('blocked_slots')
          .select('id')
          .eq('court_id', booking.court_id)
          .eq('date', booking.booking_date)
          .eq('period_number', booking.period_number)
          .maybeSingle()

        if (existingBlock) {
          warningMsg = 'الفترة محجوزة بالفعل في blocked_slots.'
        } else {
          const { error: blockErr } = await supabase
            .from('blocked_slots')
            .insert({
              court_id:      booking.court_id,
              date:          booking.booking_date,
              period_number: booking.period_number,
              reason:        `حذف نهائي — ${reason}`,
              blocked_by:    adminUserId,
            })

          if (blockErr) {
            // UNIQUE conflict لا يوقف العملية — الحجز حُذف بنجاح
            warningMsg = 'تم الحذف، لكن فشل إضافة blocked_slot (قد يكون موجوداً بالفعل).'
            console.warn('[deleteBookingPermanently] blockErr:', blockErr.message)
          }
        }
      }
    }
  }

  // ── تحديث إحصائيات العميل ────────────────────────────────
  // نطرح net_amount (مثل cancelInvoicesForBooking)
  if (invoice && booking.customer_id) {
    const invoiceTotal = Number(invoice.total_amount)
    // الفاتورة لا فيها approved CNs (تحققنا سابقاً) → net = total
    await updateCustomerStats(
      invoice.customer_id ?? booking.customer_id,
      -invoiceTotal,
      -1,
      supabase
    )
  } else if (!invoice && booking.customer_id) {
    // حجز بدون فاتورة → نطرح 1 من total_bookings فقط
    await updateCustomerStats(booking.customer_id, 0, -1, supabase)
  }

  // ── T9: تسجيل في audit_log ───────────────────────────────
  await supabase.from('audit_log').insert({
    table_name:  'bookings',
    record_id:   bookingId,
    action:      'booking_hard_delete',
    performed_by: adminUserId,
    notes:       JSON.stringify({
      reason,
      block_slot:      blockSlot,
      booking_snapshot: snapshot,
    }),
  })

  return { success: true, warning: warningMsg }
}
