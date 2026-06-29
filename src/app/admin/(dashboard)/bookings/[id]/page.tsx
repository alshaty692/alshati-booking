import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatAmount, formatDateTime, formatDate, getCourtName, getPeriodName } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'
import {
  ClipboardList, FileText, CheckCircle2, XCircle, Trash2,
  StickyNote, Star, Droplets, PenLine, Globe, Save, AlertTriangle, Package, ShieldAlert,
} from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'
import BatchCancelButton from '@/components/admin/BatchCancelButton'

export const metadata: Metadata = { title: 'تفاصيل الحجز' }

interface Props { params: Promise<{ id: string }> }

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', uploaded: 'badge-uploaded', confirmed: 'badge-confirmed',
  rejected: 'badge-rejected', cancelled: 'badge-cancelled', expired: 'badge-expired',
}

// ── Server Actions (بدون تغيير في المنطق) ──────────────────

async function adjustWaterStock(supabase: ReturnType<typeof createAdminClient>, quantity: number, direction: 'decrement' | 'increment') {
  if (quantity <= 0) return
  const { data } = await supabase.from('settings').select('value').eq('key', 'water_stock_available').single()
  const current = Number(data?.value ?? '999')
  const newVal = direction === 'decrement' ? Math.max(0, current - quantity) : current + quantity
  await supabase.from('settings').upsert({ key: 'water_stock_available', value: String(newVal) }, { onConflict: 'key' })
}

async function confirmBooking(formData: FormData) {
  'use server'
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return
  const supabase = createAdminClient()
  const id = formData.get('booking_id') as string

  // جلب بيانات الحجز الكاملة قبل التحديث
  const { data: bookingData, error: fetchErr } = await supabase
    .from('bookings')
    .select('water_quantity, customer_phone, customer_name, customer_id, base_price, discount_amount, discount_code, final_price, batch_id')
    .eq('id', id)
    .single()

  if (fetchErr || !bookingData) {
    console.error('[confirmBooking] فشل جلب بيانات الحجز:', fetchErr?.message)
    return
  }

  // تحديث حالة الحجز
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_by: user.id, confirmed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) {
    console.error('[confirmBooking] فشل تحديث الحجز:', updateErr.message)
    return
  }

  // تعديل مخزون المياه
  if (bookingData.water_quantity > 0) {
    await adjustWaterStock(supabase, bookingData.water_quantity, 'decrement')
  }

  // ── إصدار الفاتورة ───────────────────────────────────────────
  // الحجوزات الفردية فقط — الباقات لها مسار فاتورة خاص
  if (!bookingData.batch_id) {
    try {
      // جلب customer_id من جدول customers عبر رقم الجوال
      let customerId: string | null = bookingData.customer_id ?? null

      if (!customerId) {
        const { data: custRow } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', bookingData.customer_phone)
          .maybeSingle()
        customerId = custRow?.id ?? null
      }

      if (customerId) {
        // سعر المياه من الإعدادات
        const { data: waterSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'water_price_per_carton')
          .single()
        const waterUnitPrice = Number(waterSetting?.value ?? '20') || 20

        // المبلغ الأصلي للملعب (بدون المياه)
        const courtPrice = bookingData.final_price
          - (bookingData.water_quantity * waterUnitPrice)

        const { createInvoice } = await import('@/lib/invoices')
        await createInvoice({
          booking_id:      id,
          customer_id:     customerId,
          base_price:      bookingData.base_price,
          discount_amount: bookingData.discount_amount,
          discount_code:   bookingData.discount_code ?? null,
          final_price:     courtPrice,
          water_quantity:  bookingData.water_quantity,
          water_unit_price: waterUnitPrice,
        }, supabase)
      } else {
        console.warn('[confirmBooking] لم يُعثر على customer_id — الفاتورة لم تُصدر:', id)
      }
    } catch (invErr) {
      // فشل الفاتورة لا يوقف التأكيد — يُسجَّل فقط
      console.error('[confirmBooking] فشل إصدار الفاتورة:', invErr)
    }
  }

  await supabase.from('audit_log').insert({
    table_name: 'bookings', record_id: id, action: 'update',
    performed_by: user.id, notes: 'اعتمد الإدارة الحجز',
  })

  revalidatePath(`/admin/bookings/${id}`)
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/invoices')
  redirect('/admin/bookings')
}

async function rejectBooking(formData: FormData) {
  'use server'
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return
  const supabase = createAdminClient()
  const id = formData.get('booking_id') as string
  const reason = formData.get('rejection_reason') as string
  const { data: bookingData } = await supabase.from('bookings').select('status, water_quantity').eq('id', id).single()
  await supabase.from('bookings').update({ status: 'rejected', rejection_reason: reason }).eq('id', id)
  if (bookingData?.status === 'confirmed' && bookingData.water_quantity > 0) {
    await adjustWaterStock(supabase, bookingData.water_quantity, 'increment')
  }
  await supabase.from('audit_log').insert({
    table_name: 'bookings', record_id: id, action: 'update',
    performed_by: user.id, notes: `رفض الإدارة الحجز: ${reason}`,
  })
  revalidatePath('/admin/bookings')
  redirect('/admin/bookings')
}

async function addNote(formData: FormData) {
  'use server'
  const supabase = createAdminClient()
  const id = formData.get('booking_id') as string
  const note = formData.get('internal_note') as string
  await supabase.from('bookings').update({ internal_note: note }).eq('id', id)
  revalidatePath(`/admin/bookings/${id}`)
}

async function cancelBookingAdmin(formData: FormData) {
  'use server'
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return
  const supabase = createAdminClient()
  const id = formData.get('booking_id') as string
  const reason = formData.get('cancellation_reason') as string
  const refunded = formData.get('refunded') === 'on'
  const { data: bookingData } = await supabase.from('bookings').select('status, water_quantity').eq('id', id).single()
  await supabase.from('bookings').update({
    status: 'cancelled',
    internal_note: `إلغاء إداري: ${reason}${refunded ? ' (تم الاسترداد)' : ''}`,
  }).eq('id', id)
  if (bookingData?.status === 'confirmed' && bookingData.water_quantity > 0) {
    await adjustWaterStock(supabase, bookingData.water_quantity, 'increment')
  }
  await supabase.from('audit_log').insert({
    table_name: 'bookings', record_id: id, action: 'update',
    performed_by: user.id,
    notes: `إلغاء إداري: ${reason}${refunded ? ' | تم استرداد المبلغ' : ''}`,
  })
  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  redirect('/admin/bookings')
}

async function softDeleteBooking(formData: FormData) {
  'use server'
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return
  const supabase = createAdminClient()
  const id = formData.get('booking_id') as string
  await supabase.from('bookings').update({
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
  }).eq('id', id)
  await supabase.from('audit_log').insert({
    table_name: 'bookings', record_id: id, action: 'soft_delete',
    performed_by: user.id, notes: 'حذف ناعم إداري للحجز',
  })
  revalidatePath('/admin/bookings')
  redirect('/admin/bookings')
}

// ── الصفحة ──────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bd-row">
      <span className="bd-row-label">{label}</span>
      <span className="bd-row-value">{value}</span>
    </div>
  )
}

function CardHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="bd-card-head">
      {icon}
      <h2>{title}</h2>
    </div>
  )
}

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  const supabase = createAdminClient()

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single()
  if (!booking) notFound()

  const { data: ratingData } = await supabase
    .from('booking_ratings').select('rating, comment, created_at')
    .eq('booking_id', id).maybeSingle()

  const { data: adminUser } = await supabase.from('admin_users').select('role').eq('id', user?.id ?? '').single()
  // SEC-01 fix: لو المستخدم غير موجود في admin_users → رفض الوصول (لا إنشاء صف جديد)
  if (!adminUser) redirect('/admin/login?error=unauthorized')
  const role = adminUser.role
  const canEdit = ['admin', 'editor'].includes(role)

  const waterCost = booking.water_quantity > 0
    ? booking.final_price - booking.base_price + booking.discount_amount
    : 0
  const waterUnitPrice = booking.water_quantity > 0 ? Math.round(waterCost / booking.water_quantity) : 0

  /* حجوزات الباقة الأخرى */
  const { data: batchSiblings } = booking.batch_id
    ? await supabase
        .from('bookings')
        .select('id, booking_date, court_id, period_number, status')
        .eq('batch_id', booking.batch_id)
        .neq('id', id)
        .order('booking_date', { ascending: true })
    : { data: null }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="تفاصيل الحجز"
        backHref="/admin/bookings"
        backLabel="الحجوزات"
        action={
          <span className={`badge ${STATUS_STYLE[booking.status] ?? ''}`}>
            {STATUS_LABELS[booking.status as keyof typeof STATUS_LABELS] ?? booking.status}
          </span>
        }
      />

      <div className="bd-grid">
        {/* بيانات الحجز */}
        <div className="card">
          <CardHead icon={<ClipboardList size={16} strokeWidth={1.75} />} title="بيانات الحجز" />
          <Row label="العميل" value={booking.customer_name} />
          <Row label="الجوال" value={<span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>{booking.customer_phone}</span>} />
          <Row label="التاريخ" value={formatDate(booking.booking_date)} />
          <Row label="الملعب" value={getCourtName(booking.court_id)} />
          <Row label="الفترة" value={getPeriodName(booking.period_number)} />
          <Row label="الكود" value={
            booking.code_used
              ? <span className="badge badge-confirmed" style={{ fontFamily: 'monospace' }}>{booking.code_used}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>
          } />
          <Row label="السعر الأصلي"  value={formatAmount(booking.base_price)} />
          <Row label="الخصم"         value={formatAmount(booking.discount_amount)} />
          <Row label="المياه" value={
            booking.water_quantity > 0
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-info)' }}>
                  <Droplets size={13} strokeWidth={2} />
                  {booking.water_quantity} كرتون × {formatAmount(waterUnitPrice)} = {formatAmount(waterCost)}
                </span>
              : <span style={{ color: 'var(--text-muted)' }}>لا يوجد</span>
          } />
          <Row label="المبلغ النهائي" value={
            <strong style={{ color: 'var(--color-lime)', fontSize: 'var(--text-lg)' }}>
              {formatAmount(booking.final_price)}
            </strong>
          } />
          <Row label="نوع الحجز" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {booking.is_manual
                ? <><PenLine size={13} strokeWidth={2} /> يدوي</>
                : <><Globe size={13} strokeWidth={2} /> إلكتروني</>
              }
            </span>
          } />
          {booking.batch_id && (
            <Row label="رقم الباقة" value={
              <span style={{
                fontFamily:'monospace', fontWeight:700, fontSize:'0.85rem',
                color:'#a78bfa', background:'rgba(139,92,246,0.1)',
                padding:'0.15rem 0.4rem', borderRadius:'0.3rem',
                border:'1px solid rgba(139,92,246,0.25)',
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
              }}>
                <Package size={12}/> {booking.batch_id}
              </span>
            } />
          )}
          <Row label="وقت الحجز" value={formatDateTime(booking.created_at)} />
          {booking.confirmed_at && <Row label="وقت الاعتماد" value={formatDateTime(booking.confirmed_at)} />}
          {booking.rejection_reason && (
            <Row label="سبب الرفض" value={<span style={{ color: 'var(--color-danger)' }}>{booking.rejection_reason}</span>} />
          )}
        </div>

        {/* ── حجوزات الباقة الأخرى ── */}
        {booking.batch_id && batchSiblings && batchSiblings.length > 0 && (
          <div className="card">
            <div className="bd-card-head">
              <Package size={15} strokeWidth={1.75} />
              <h2>حجوزات الباقة ({batchSiblings.length + 1} فترات)</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {/* الحجز الحالي */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  {formatDate(booking.booking_date)} · {getCourtName(booking.court_id)} · {getPeriodName(booking.period_number)}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700 }}>الحجز الحالي</span>
              </div>
              {/* باقي الحجوزات */}
              {batchSiblings.map(s => {
                const sStyle: Record<string,string> = {
                  pending:'#f59e0b', uploaded:'#3b82f6', confirmed:'#7bba00',
                  rejected:'var(--danger)', cancelled:'var(--text-muted)', expired:'var(--text-muted)',
                }
                return (
                  <Link key={s.id} href={`/admin/bookings/${s.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'border-color 0.15s',
                      cursor: 'pointer',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sStyle[s.status] ?? '#888', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {formatDate(s.booking_date)} · {getCourtName(s.court_id)} · {getPeriodName(s.period_number)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: sStyle[s.status] ?? 'var(--text-muted)', fontWeight: 600 }}>
                        {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
            <div style={{ marginTop: '0.65rem' }}>
              <Link href={`/admin/bookings?batch=${booking.batch_id}`}
                style={{ fontSize: '0.78rem', color: '#a78bfa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Package size={12}/> عرض كامل الباقة في قائمة الحجوزات
              </Link>
            </div>
          </div>
        )}

        {/* العمود الأيسر — الإجراءات */}
        <div className="bd-actions-col">
          {/* الإيصال */}
          {booking.receipt_url && (
            <div className="card">
              <CardHead icon={<FileText size={16} strokeWidth={1.75} />} title="الإيصال" />
              <a href={booking.receipt_url} target="_blank" rel="noreferrer"
                className="btn btn-secondary btn-full" style={{ marginBottom: 'var(--space-2)', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <FileText size={14} strokeWidth={2} />
                عرض الإيصال
              </a>
              {booking.receipt_uploaded_at && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                  رُفع: {formatDateTime(booking.receipt_uploaded_at)}
                </p>
              )}
            </div>
          )}

          {/* اعتماد / رفض */}
          {canEdit && booking.status === 'uploaded' && (
            <div className="card">
              <CardHead icon={<CheckCircle2 size={16} strokeWidth={1.75} />} title="اعتماد أو رفض الإيصال" />
              <form action={confirmBooking} style={{ marginBottom: 'var(--space-3)' }}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <button id={`btn-confirm-${booking.id}`} type="submit" className="btn btn-success btn-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={16} strokeWidth={2} />
                  اعتماد الحجز
                </button>
              </form>
              <form action={rejectBooking}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="rejection_reason" className="input" placeholder="سبب الرفض..." required
                  style={{ marginBottom: 'var(--space-2)', resize: 'vertical', minHeight: '80px' }} />
                <button id={`btn-reject-${booking.id}`} type="submit" className="btn btn-danger btn-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <XCircle size={16} strokeWidth={2} />
                  رفض الحجز
                </button>
              </form>
            </div>
          )}

          {/* إلغاء */}
          {canEdit && ['pending', 'uploaded', 'confirmed'].includes(booking.status) && (
            <div className="card bd-cancel-card">
              <CardHead icon={<Trash2 size={16} strokeWidth={1.75} />} title="إلغاء الحجز" />
              <form action={cancelBookingAdmin}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="cancellation_reason" className="input" placeholder="سبب الإلغاء..." required
                  style={{ marginBottom: 'var(--space-2)', resize: 'vertical', minHeight: '70px' }} />
                {booking.status === 'confirmed' && (
                  <label className="bd-refund-label">
                    <input type="checkbox" name="refunded" style={{ accentColor: 'var(--color-lime)' }} />
                    <span>تم استرداد المبلغ للعميل</span>
                  </label>
                )}
                <button type="submit" className="btn btn-danger btn-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <Trash2 size={15} strokeWidth={2} />
                  تأكيد الإلغاء
                </button>
                <p className="bd-warning-note">
                  <AlertTriangle size={12} strokeWidth={2} />
                  هذا الإجراء لا يمكن التراجع عنه — ستتحرر الفترة
                </p>
              </form>
            </div>
          )}

          {/* إلغاء جماعي للباقة — يظهر فقط إذا كان الحجز ضمن باقة */}
          {canEdit && booking.batch_id && ['pending', 'uploaded', 'confirmed'].includes(booking.status) && (
            <div className="card" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
              <CardHead
                icon={<Package size={16} strokeWidth={1.75} />}
                title={`إلغاء كامل الباقة (${booking.batch_id})`}
              />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                يُلغي جميع الحجوزات النشطة المرتبطة بهذه الباقة دفعة واحدة (لا يشمل المُلغاة مسبقاً).
              </p>
              <BatchCancelButton batchId={booking.batch_id} />
            </div>
          )}

          {/* ── حذف ناعم — يظهر فقط للحجوزات الملغاة / المرفوضة / المنتهية ── */}
          {canEdit && ['cancelled', 'rejected', 'expired'].includes(booking.status) && !booking.deleted_at && (
            <div className="card bd-soft-delete-card">
              <CardHead icon={<ShieldAlert size={16} strokeWidth={1.75} />} title="حذف الحجز نهائياً" />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                يُخفي الحجز من جميع القوائم نهائياً. السجل يبقى موجوداً في قاعدة البيانات للمراجعة.
              </p>
              <form action={softDeleteBooking}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <button
                  id={`btn-soft-delete-${booking.id}`}
                  type="submit"
                  className="btn btn-danger btn-full"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
                >
                  <Trash2 size={15} strokeWidth={2} />
                  حذف الحجز نهائياً
                </button>
                <p className="bd-warning-note" style={{ marginTop: 'var(--space-2)' }}>
                  <AlertTriangle size={12} strokeWidth={2} />
                  الحجز لن يظهر في القوائم بعد الحذف
                </p>
              </form>
            </div>
          )}

          {/* ملاحظة داخلية */}
          {canEdit && (
            <div className="card">
              <CardHead icon={<StickyNote size={16} strokeWidth={1.75} />} title="ملاحظة داخلية" />
              <form action={addNote}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="internal_note" className="input" placeholder="أضف ملاحظة داخلية..."
                  defaultValue={booking.internal_note ?? ''}
                  style={{ marginBottom: 'var(--space-2)', resize: 'vertical', minHeight: '80px' }} />
                <button type="submit" className="btn btn-secondary btn-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <Save size={14} strokeWidth={2} />
                  حفظ الملاحظة
                </button>
              </form>
            </div>
          )}

          {/* تقييم العميل */}
          <div className="card">
            <CardHead icon={<Star size={16} strokeWidth={1.75} />} title="تقييم العميل" />
            {ratingData ? (
              <div>
                <div style={{ display: 'flex', gap: '0.15rem', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ fontSize: '1.4rem', color: n <= ratingData.rating ? 'var(--color-warning)' : 'var(--border-color)' }}>★</span>
                  ))}
                  <strong style={{ marginRight: 'var(--space-2)', color: 'var(--color-warning)' }}>
                    {ratingData.rating}/5
                  </strong>
                </div>
                {ratingData.comment && (
                  <p style={{
                    fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic',
                    margin: `0 0 var(--space-2)`, background: 'var(--color-warning-bg)',
                    padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                    borderRight: '3px solid var(--color-warning)',
                  }}>
                    &ldquo;{ratingData.comment}&rdquo;
                  </p>
                )}
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(ratingData.created_at).toLocaleString('ar-SA')}
                </small>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>لم يُقيَّم بعد</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .bd-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-5);
          align-items: start;
        }
        @media (max-width: 700px) { .bd-grid { grid-template-columns: 1fr; } }

        .bd-actions-col { display: flex; flex-direction: column; gap: var(--space-4); }

        .bd-card-head {
          display: flex; align-items: center; gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        .bd-card-head > svg { color: var(--color-lime-dim); }
        .bd-card-head h2 {
          font-size: var(--text-base); font-weight: var(--font-bold);
          margin: 0; color: var(--text-primary);
        }

        .bd-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-2) 0; border-bottom: 1px solid var(--border-subtle);
          font-size: var(--text-sm); gap: var(--space-4);
        }
        .bd-row:last-child { border-bottom: none; }
        .bd-row-label { color: var(--text-muted); flex-shrink: 0; }
        .bd-row-value { font-weight: var(--font-medium); text-align: left; }

        .bd-cancel-card {
          border-color: rgba(224,85,85,.25);
        }
        .bd-cancel-card .bd-card-head > svg { color: var(--color-danger); }

        .bd-soft-delete-card {
          border-color: rgba(224,85,85,.15);
          background: rgba(224,85,85,.04);
        }
        .bd-soft-delete-card .bd-card-head > svg { color: var(--color-danger); }

        .bd-refund-label {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-sm); cursor: pointer;
          margin-bottom: var(--space-2);
        }

        .bd-warning-note {
          display: flex; align-items: center; gap: var(--space-1);
          font-size: var(--text-xs); color: var(--text-muted);
          margin: var(--space-2) 0 0; text-align: center;
          justify-content: center;
        }
      `}</style>
    </div>
  )
}
