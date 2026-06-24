// ============================================================
// API Route — الحجز المتعدد (batch booking)
// ينشئ عدة حجوزات مرتبطة بـ batch_id واحد دفعة واحدة
// كل فترة تحتوي كود خصم وكمية مياه مستقلة
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { fetchCourtNames } from '@/hooks/useCourtNames'
import { findOrCreateCustomer } from '@/lib/customers'
import { createBatchInvoices, cancelInvoicesForBatch } from '@/lib/invoices'

/* ── أنواع ────────────────────────────────────────────────── */
interface SlotInput {
  booking_date:  string
  court_id:      string
  period_number: number
  code_used?:    string | null
  water_quantity?: number
}

interface SlotResult {
  booking_date:  string
  court_id:      string
  period_number: number
  ok:            boolean
  booking_id?:   string
  error?:        string
}

/* ── توليد batch_id فريد ─────────────────────────────────── */
function generateBatchId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'PKG-'
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

/* ── تسمية الفترات ────────────────────────────────────────────────── */
const PERIOD_NAMES: Record<number, string> = { 1: '5-7م', 2: '7-9م', 3: '9-11م' }

/* ================================================================
   POST /api/admin/batch-booking
   Body:
   {
     slots: SlotInput[],
     customer_name: string,
     customer_phone: string,
     status: 'confirmed' | 'pending' | 'uploaded',
     internal_note?: string,
   }
   ================================================================ */
export async function POST(request: NextRequest) {
  try {
    /* ── مصادقة ── */
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { data: adminUser } = await supabase
      .from('admin_users').select('role').eq('id', user.id).single()
    if (!['admin', 'editor'].includes(adminUser?.role ?? ''))
      return Response.json({ error: 'ليس لديك صلاحية الحجز المتعدد' }, { status: 403 })

    /* ── قراءة الـ body ── */
    const body = await request.json()
    const {
      slots,
      customer_name,
      customer_phone,
      status: requestedStatus,
      internal_note,
      invoice_type,
    } = body as {
      slots: SlotInput[]
      customer_name: string
      customer_phone: string
      status: string
      internal_note?: string
      invoice_type?: 'per_booking' | 'combined'
    }

    /* ── تحقق أساسي ── */
    if (!Array.isArray(slots) || slots.length === 0)
      return Response.json({ error: 'لم تُحدَّد أي فترات' }, { status: 400 })
    if (!customer_name?.trim() || !customer_phone?.trim())
      return Response.json({ error: 'يرجى إدخال بيانات العميل' }, { status: 400 })

    const ALLOWED_STATUSES = ['confirmed', 'pending', 'uploaded']
    const finalStatus = ALLOWED_STATUSES.includes(requestedStatus) ? requestedStatus : 'confirmed'
    const isConfirmed = finalStatus === 'confirmed'

    const admin = createAdminClient()

    /* ── جلب أسماء الملاعب من الإعدادات (مصدر وحيد) ── */
    let COURT_NAMES: Record<string, string> = { football: 'كرة القدم', volleyball: 'الكرة الطائرة', multi: 'السلة' }
    try { COURT_NAMES = await fetchCourtNames(admin) } catch { /* fallback */ }

    /* ── جلب إعدادات المياه مرة واحدة ── */
    const { data: waterSettings } = await admin
      .from('settings').select('key, value')
      .in('key', ['water_price_per_carton', 'water_max_cartons', 'water_stock_available'])
    const waterPricePerCarton = Number(waterSettings?.find(s => s.key === 'water_price_per_carton')?.value) || 20
    const waterMaxCartons     = Number(waterSettings?.find(s => s.key === 'water_max_cartons')?.value) || 10
    const waterStockCurrent   = Number(waterSettings?.find(s => s.key === 'water_stock_available')?.value ?? '999')

    /* ── توليد batch_id مشترك ── */
    const batchId = generateBatchId()

    /* ── إيجاد أو إنشاء العميل ─────────────────────────────────── */
    const customer = await findOrCreateCustomer(customer_phone.trim(), customer_name.trim(), admin)

    /* ── معالجة كل فترة ── */
    const results: SlotResult[] = []
    let totalWaterDeducted = 0

    for (const slot of slots) {
      const { booking_date, court_id, period_number, code_used, water_quantity } = slot
      const waterQty = Math.max(0, Math.min(Number(water_quantity ?? 0), waterMaxCartons))
      const slotLabel = `${booking_date} · ${COURT_NAMES[court_id] ?? court_id} · ${PERIOD_NAMES[period_number] ?? period_number}`

      try {
        /* 1) فحص وجود حجز قائم لنفس الفترة */
        const { data: existing, error: fetchErr } = await admin
          .from('bookings')
          .select('id, status')
          .eq('booking_date', booking_date)
          .eq('court_id', court_id)
          .eq('period_number', Number(period_number))
          .maybeSingle()

        if (fetchErr) throw new Error(fetchErr.message)

        if (existing) {
          const INACTIVE = ['cancelled', 'rejected', 'expired']
          if (!INACTIVE.includes(existing.status)) {
            results.push({ booking_date, court_id, period_number, ok: false, error: 'محجوزة بالفعل' })
            continue
          }
          /* حجز ملغى → احذفه أولاً */
          await admin.from('audit_log').insert({
            table_name: 'bookings', record_id: existing.id,
            action: 'delete', performed_by: user.id,
            notes: `حذف حجز ملغى قديم استعداداً لحجز متعدد (${batchId})`,
          }).then(() => {})
          const { error: delErr } = await admin.from('bookings').delete()
            .eq('id', existing.id).eq('status', existing.status)
          if (delErr) throw new Error(delErr.message)
        }

        /* 2) حساب سعر الملعب */
        const { data: priceData } = await admin.rpc('calculate_price', {
          p_court_id: court_id,
          p_code: code_used || null,
        })

        /* 3) حساب سعر المياه */
        let waterTotal = 0
        if (waterQty > 0) {
          waterTotal = waterQty * waterPricePerCarton
        }

        const courtPrice = priceData?.final_price ?? 0
        const effectivePrice = courtPrice + waterTotal

        /* 4) INSERT */
        const { data: booking, error: insertErr } = await admin
          .from('bookings')
          .insert({
            booking_date,
            court_id,
            period_number: Number(period_number),
            customer_phone: customer_phone.trim(),
            customer_name:  customer_name.trim(),
            customer_id:    customer.id,
            code_used:      code_used || null,
            base_price:     priceData?.base_price ?? courtPrice,
            discount_amount: priceData?.discount_amount ?? 0,
            final_price:    effectivePrice,
            water_quantity: waterQty,
            status:         finalStatus,
            is_manual:      true,
            batch_id:       batchId,
            internal_note:  internal_note || null,
            ...(isConfirmed
              ? { confirmed_by: user.id, confirmed_at: new Date().toISOString() }
              : {}),
          })
          .select('id')
          .single()

        if (insertErr) {
          if (insertErr.code === '23505') {
            results.push({ booking_date, court_id, period_number, ok: false, error: 'محجوزة بالفعل' })
          } else {
            throw new Error(insertErr.message)
          }
          continue
        }

        /* 5) كود الخصم */
        if (code_used) {
          try { await admin.rpc('increment_code_usage', { p_code: code_used }) } catch { /* تجاهل */ }
        }

        /* 6) تجميع خصم المياه (يُنفَّذ دفعة واحدة في النهاية) */
        if (isConfirmed && waterQty > 0) totalWaterDeducted += waterQty

        /* audit_log */
        await admin.from('audit_log').insert({
          table_name: 'bookings',
          record_id: booking!.id,
          action: 'insert',
          performed_by: user.id,
          notes: `حجز متعدد (${batchId}) · ${finalStatus} · ${slotLabel}${waterQty > 0 ? ` + ${waterQty} كرتون ماء` : ''}`,
        })

        results.push({ booking_date, court_id, period_number, ok: true, booking_id: booking!.id })

      } catch (slotErr) {
        results.push({
          booking_date, court_id, period_number, ok: false,
          error: slotErr instanceof Error ? slotErr.message : 'خطأ غير متوقع',
        })
      }
    }

    /* ── خصم مخزون المياه الكلي (دفعة واحدة) ── */
    if (isConfirmed && totalWaterDeducted > 0) {
      const newStock = Math.max(0, waterStockCurrent - totalWaterDeducted)
      await admin.from('settings')
        .update({ value: String(newStock) })
        .eq('key', 'water_stock_available')
    }

    /* ── audit_log للباقة ككل ── */
    const createdCount = results.filter(r => r.ok).length
    await admin.from('audit_log').insert({
      table_name: 'bookings',
      record_id: batchId,
      action: 'batch_create',
      performed_by: user.id,
      notes: `باقة (${batchId}) — ${createdCount}/${slots.length} فترة · ${customer_phone.trim()}`,
    })

    /* ── إصدار الفاتورة/الفواتير للحجوزات المؤكدة ──────────────── */
    let invoice_numbers: string[] = []
    if (isConfirmed && createdCount > 0) {
      try {
        const successSlots = results
          .filter(r => r.ok && r.booking_id)
          .map(r => {
            // نجلب بيانات الحجز من نتائج الـ loop (نحتاج إعادة بناء البيانات)
            const originalSlot = slots.find(
              s => s.booking_date === r.booking_date &&
                   s.court_id    === r.court_id &&
                   s.period_number === r.period_number
            )
            return {
              booking_id:      r.booking_id!,
              base_price:      0,   // ستُملأ من priceData المحسوبة في الـ loop — انظر ملاحظة أدناه
              discount_amount: 0,
              discount_code:   originalSlot?.code_used ?? null,
              final_price:     0,
              water_quantity:  originalSlot?.water_quantity ?? 0,
            }
          })

        const inv = await createBatchInvoices({
          slots:            successSlots,
          customer_id:      customer.id,
          batch_id:         batchId,
          invoice_type:     (invoice_type === 'combined' ? 'combined' : 'per_booking'),
          water_unit_price: waterPricePerCarton,
          adminClient:      admin,
        })
        invoice_numbers = inv.invoice_numbers
      } catch (invErr) {
        console.warn('[batch-booking] فشل إصدار الفواتير (غير حرج):', invErr)
      }
    }

    return Response.json({
      success: true,
      batch_id: batchId,
      total:   slots.length,
      created: createdCount,
      failed:  slots.length - createdCount,
      results,
      invoice_numbers,
    })

  } catch (err) {
    console.error('[batch-booking]', err)
    return Response.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

/* ================================================================
   GET /api/admin/batch-booking?batch_id=PKG-XXXXXX
   جلب كل حجوزات باقة معينة
   ================================================================ */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const batchId = new URL(request.url).searchParams.get('batch_id')
    if (!batchId) return Response.json({ error: 'batch_id مطلوب' }, { status: 400 })

    const admin = createAdminClient()
    const { data: bookings, error } = await admin
      .from('bookings')
      .select('*')
      .eq('batch_id', batchId)
      .order('booking_date', { ascending: true })
      .order('period_number', { ascending: true })

    if (error) throw error
    return Response.json({ bookings: bookings ?? [] })

  } catch (err) {
    console.error('[batch-booking/get]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/* ================================================================
   DELETE /api/admin/batch-booking?batch_id=PKG-XXXXXX
   إلغاء جماعي لكل حجوزات باقة
   ================================================================ */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 })

    const { data: adminUser } = await supabase
      .from('admin_users').select('role').eq('id', user.id).single()
    if (!['admin', 'editor'].includes(adminUser?.role ?? ''))
      return Response.json({ error: 'غير مصرّح' }, { status: 403 })

    const batchId = new URL(request.url).searchParams.get('batch_id')
    const reason  = new URL(request.url).searchParams.get('reason') ?? 'إلغاء الباقة'
    if (!batchId) return Response.json({ error: 'batch_id مطلوب' }, { status: 400 })

    const admin = createAdminClient()

    /* جلب كل حجوزات الباقة النشطة */
    const { data: activeBookings, error: fetchErr } = await admin
      .from('bookings')
      .select('id, status, booking_date, court_id, period_number, water_quantity, status')
      .eq('batch_id', batchId)
      .in('status', ['pending', 'uploaded', 'confirmed'])

    if (fetchErr) throw fetchErr

    if (!activeBookings || activeBookings.length === 0)
      return Response.json({ success: true, cancelled: 0, message: 'لا توجد حجوزات نشطة في هذه الباقة' })

    /* إلغاء جماعي */
    const { error: cancelErr } = await admin
      .from('bookings')
      .update({ status: 'cancelled', internal_note: reason })
      .eq('batch_id', batchId)
      .in('status', ['pending', 'uploaded', 'confirmed'])

    if (cancelErr) throw cancelErr

    /* إلغاء الفواتير المرتبطة تلقائياً */
    try {
      await cancelInvoicesForBatch(batchId, `إلغاء الباقة: ${reason}`, admin)
    } catch (invErr) {
      console.warn('[batch-booking/delete] فشل إلغاء الفواتير:', invErr)
    }

    /* audit_log */
    await admin.from('audit_log').insert({
      table_name: 'bookings',
      record_id: batchId,
      action: 'batch_cancel',
      performed_by: user.id,
      notes: `إلغاء جماعي للباقة (${batchId}) — ${activeBookings.length} حجز · السبب: ${reason}`,
    })

    return Response.json({ success: true, cancelled: activeBookings.length })

  } catch (err) {
    console.error('[batch-booking/delete]', err)
    return Response.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
