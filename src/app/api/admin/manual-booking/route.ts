// ============================================================
// API Route — الحجز اليدوي (من الإدارة)
// عند وجود حجز ملغى لنفس الفترة: يُحذف القديم + يُنشأ سجل جديد نظيف
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'
import { findOrCreateCustomer } from '@/lib/customers'
import { createInvoice } from '@/lib/invoices'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('create_booking')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const {
      booking_date, court_id, period_number,
      customer_name, customer_phone,
      code_used, final_price, internal_note,
      water_quantity,
      status: requestedStatus,
    } = body

    if (!booking_date || !court_id || !period_number || !customer_name || !customer_phone) {
      return Response.json({ error: 'يرجى إكمال البيانات المطلوبة' }, { status: 400 })
    }

    // الحالات المسموحة للحجز اليدوي
    const ALLOWED_STATUSES = ['confirmed', 'pending', 'uploaded']
    const finalStatus: string = ALLOWED_STATUSES.includes(requestedStatus)
      ? requestedStatus
      : 'confirmed'
    const isConfirmed = finalStatus === 'confirmed'

    const admin = createAdminClient()

    // ── فحص إذا يوجد حجز قائم لنفس الفترة ──────────────────
    // نستخدم maybeSingle() بدل single() لتجنب خطأ "no rows" عند عدم الوجود
    const { data: existingBooking, error: fetchErr } = await admin
      .from('bookings')
      .select('id, status')
      .eq('booking_date', booking_date)
      .eq('court_id', court_id)
      .eq('period_number', Number(period_number))
      .maybeSingle()

    if (fetchErr) {
      console.error('[manual-booking] fetchErr:', fetchErr)
      throw fetchErr
    }

    if (existingBooking) {
      const INACTIVE = ['cancelled', 'rejected', 'expired']

      if (!INACTIVE.includes(existingBooking.status)) {
        // حجز نشط (pending / uploaded / confirmed) → رفض
        return Response.json({ error: 'هذه الفترة محجوزة بالفعل' }, { status: 409 })
      }

      // حجز غير نشط → حذف ناعم (نُخفيه بدل مسحه نهائياً — يحافظ على FK مع invoices)
      await admin.from('audit_log').insert({
        table_name: 'bookings',
        record_id: existingBooking.id,
        action: 'soft_delete',
        performed_by: auth.userId,
        notes: `حذف ناعم لحجز ${existingBooking.status} قديم استعداداً لحجز يدوي جديد على نفس الفترة`,
      }).then(() => {}) // تجاهل خطأ audit بدون إيقاف التدفق

      const { error: softDeleteErr } = await admin
        .from('bookings')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: auth.userId,
        })
        .eq('id', existingBooking.id)
        .eq('status', existingBooking.status) // قيد أمان: لا يُعدَّل إلا بنفس الحالة المتوقعة

      if (softDeleteErr) {
        console.error('[manual-booking] softDeleteErr:', softDeleteErr)
        throw softDeleteErr
      }
    }

    // ── حساب السعر ──────────────────────────────────────────
    const { data: priceData } = await admin.rpc('calculate_price', {
      p_court_id: court_id,
      p_code: code_used || null,
    })

    const waterQty = Math.max(0, Math.min(Number(water_quantity) || 0, 50)) // حد أمان

    // ── حساب سعر المياه + التحقق من المخزون ────────────────
    let waterTotal = 0
    let waterPricePerCarton = 0
    if (waterQty > 0) {
      const { data: waterSettings } = await admin
        .from('settings')
        .select('key, value')
        .in('key', ['water_price_per_carton', 'water_max_cartons', 'water_stock_available', 'water_stock_enabled'])

      waterPricePerCarton = Number(waterSettings?.find(s => s.key === 'water_price_per_carton')?.value) || 20
      const waterStockEnabled = waterSettings?.find(s => s.key === 'water_stock_enabled')?.value === 'true'

      if (waterStockEnabled) {
        // ── تتبع المخزون مفعَّل: فحص التوفر ──
        const maxCartons = Number(waterSettings?.find(s => s.key === 'water_max_cartons')?.value) || 10
        const stockAvailable = Number(waterSettings?.find(s => s.key === 'water_stock_available')?.value ?? '0')

        if (stockAvailable <= 0) {
          return Response.json({ error: 'المياه غير متوفرة حالياً' }, { status: 400 })
        }
        if (waterQty > stockAvailable) {
          return Response.json({ error: `الكمية المتوفرة حالياً ${stockAvailable} كرتون فقط` }, { status: 400 })
        }

        const clampedQty = Math.min(waterQty, maxCartons)
        waterTotal = clampedQty * waterPricePerCarton
      } else {
        // ── المخزون مفتوح: نقبل الكمية بدون قيود ──
        waterTotal = waterQty * waterPricePerCarton
      }
    }

    // السعر النهائي = سعر الملعب (بعد الخصم) + سعر المياه
    const courtPrice = final_price
      ? Number(final_price)
      : (priceData?.final_price ?? 0)
    const effectiveFinalPrice = courtPrice + waterTotal

    // ── إيجاد أو إنشاء العميل ───────────────────────────────
    const customer = await findOrCreateCustomer(customer_phone, customer_name, admin)

    // ── إنشاء سجل حجز جديد نظيف ────────────────────────────
    const { data: booking, error: insertError } = await admin
      .from('bookings')
      .insert({
        booking_date,
        court_id,
        period_number: Number(period_number),
        customer_phone,
        customer_name,
        customer_id:     customer.id,
        code_used:       code_used || null,
        base_price:      priceData?.base_price ?? courtPrice,
        discount_amount: priceData?.discount_amount ?? 0,
        final_price:     effectiveFinalPrice,
        water_quantity:  waterQty,
        status:          finalStatus,
        is_manual:       true,
        internal_note:   internal_note || null,
        ...(isConfirmed
          ? { confirmed_by: auth.userId, confirmed_at: new Date().toISOString() }
          : {}),
      })
      .select('id')
      .single()

    if (insertError) {
      // تضارب متزامن نادر
      if (insertError.code === '23505') {
        return Response.json({ error: 'هذه الفترة محجوزة بالفعل' }, { status: 409 })
      }
      console.error('[manual-booking] insertError:', insertError)
      throw insertError
    }

    // ── تفعيل كود الخصم إن وُجد ────────────────────────────
    if (code_used) {
      try {
        await admin.rpc('increment_code_usage', { p_code: code_used })
      } catch { /* تجاهل خطأ الكود */ }
    }

    // ── خصم مخزون المياه للحجوزات المؤكدة (إن كان تتبع المخزون مفعلاً) ─────────────
    // للحجوزات المعلّقة (pending/uploaded): ينقص المخزون عند التأكيد اليدوي لاحقاً
    if (isConfirmed && waterQty > 0) {
      const { data: stockEnabledRow } = await admin
        .from('settings')
        .select('value')
        .eq('key', 'water_stock_enabled')
        .maybeSingle()
      const waterStockEnabled = stockEnabledRow?.value === 'true'

      if (waterStockEnabled) {
        const { data: stockRow } = await admin
          .from('settings')
          .select('value')
          .eq('key', 'water_stock_available')
          .maybeSingle()
        const current = Number(stockRow?.value ?? 0)
        if (current >= waterQty) {
          await admin
            .from('settings')
            .update({ value: String(current - waterQty) })
            .eq('key', 'water_stock_available')
        }
      }
    }

    // ── audit_log للحجز الجديد ───────────────────────────────
    await admin.from('audit_log').insert({
      table_name: 'bookings',
      record_id:  booking!.id,
      action:     'insert',
      performed_by: auth.userId,
      notes: `حجز يدوي (${finalStatus}) بواسطة الإدارة لـ ${customer_phone}${waterQty > 0 ? ` + ${waterQty} كرتون ماء` : ''}`,
    })

    // ── إصدار الفاتورة لو الحجز مؤكد ───────────────────────
    let invoice_number: string | undefined
    if (isConfirmed) {
      try {
        const inv = await createInvoice({
          booking_id:      booking!.id,
          customer_id:     customer.id,
          base_price:      priceData?.base_price ?? courtPrice,
          discount_amount: priceData?.discount_amount ?? 0,
          discount_code:   code_used || null,
          final_price:     courtPrice,   // بدون المياه (المياه حقل منفصل في الفاتورة)
          water_quantity:  waterQty,
          water_unit_price: waterPricePerCarton,
        }, admin)
        invoice_number = inv.invoice_number
      } catch (invErr) {
        console.warn('[manual-booking] فشل إصدار الفاتورة (غير حرج):', invErr)
      }
    }

    return Response.json({ success: true, booking_id: booking!.id, invoice_number })
  } catch (err) {
    console.error('[manual-booking]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
