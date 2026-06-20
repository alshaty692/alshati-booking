import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatAmount, formatDateTime, formatDate, getCourtName, getPeriodName } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import Link from 'next/link'

export const metadata: Metadata = { title: 'تفاصيل الحجز' }

interface Props { params: Promise<{ id: string }> }

const STATUS_STYLE: Record<string, string> = {
  pending:'badge-pending', uploaded:'badge-uploaded', confirmed:'badge-confirmed',
  rejected:'badge-rejected', cancelled:'badge-cancelled', expired:'badge-expired',
}

// ============================================================
// Server Actions
// ============================================================

// مساعد: تعديل مخزون المياه (نقص عند التأكيد، إرجاع عند الإلغاء/الرفض)
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

  // قراءة الحجز لمعرفة كمية المياه
  const { data: bookingData } = await supabase.from('bookings').select('water_quantity').eq('id', id).single()

  await supabase.from('bookings').update({
    status: 'confirmed',
    confirmed_by: user.id,
    confirmed_at: new Date().toISOString(),
  }).eq('id', id)

  // نقص المياه من المخزون عند التأكيد
  if (bookingData?.water_quantity && bookingData.water_quantity > 0) {
    await adjustWaterStock(supabase, bookingData.water_quantity, 'decrement')
  }

  await supabase.from('audit_log').insert({
    table_name: 'bookings', record_id: id, action: 'update',
    performed_by: user.id, notes: 'اعتمد الإدارة الحجز',
  })
  revalidatePath('/admin/bookings')
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

  // قراءة الحجز لمعرفة إن كان مؤكد سابقاً + كمية المياه
  const { data: bookingData } = await supabase.from('bookings').select('status, water_quantity').eq('id', id).single()

  await supabase.from('bookings').update({
    status: 'rejected',
    rejection_reason: reason,
  }).eq('id', id)

  // إرجاع المياه للمخزون لو كان الحجز مؤكد سابقاً
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

  // قراءة الحجز لمعرفة إن كان مؤكد + كمية المياه
  const { data: bookingData } = await supabase.from('bookings').select('status, water_quantity').eq('id', id).single()

  await supabase.from('bookings').update({
    status: 'cancelled',
    internal_note: `إلغاء إداري: ${reason}${refunded ? ' (تم الاسترداد)' : ''}`,
  }).eq('id', id)

  // إرجاع المياه للمخزون لو كان الحجز مؤكد سابقاً
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

// ============================================================
// الصفحة
// ============================================================
export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params

  // ── التحقق من المصادقة ────────────────────────────────────
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  // ── القراءة باستخدام Admin Client (يتجاوز RLS) ────────────
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (!booking) notFound()

  // جلب تقييم العميل (إن وجد)
  const { data: ratingData } = await supabase
    .from('booking_ratings')
    .select('rating, comment, created_at')
    .eq('booking_id', id)
    .maybeSingle()

  // جلب دور المستخدم — لو ما موجود ننشئه (مثل اللايوت)
  let { data: adminUser } = await supabase.from('admin_users').select('role').eq('id', user?.id ?? '').single()

  if (!adminUser && user) {
    await supabase.from('admin_users').insert({ id: user.id, role: 'admin', full_name: user.email })
    adminUser = { role: 'admin' }
  }
  const role = adminUser?.role ?? 'admin'
  const canEdit = ['admin', 'editor'].includes(role)

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link href="/admin/bookings" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>← الحجوزات</Link>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>تفاصيل الحجز</h1>
        <span className={`badge ${STATUS_STYLE[booking.status] ?? ''}`}>{STATUS_LABELS[booking.status as keyof typeof STATUS_LABELS] ?? booking.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* بيانات الحجز */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📋 بيانات الحجز</h2>
          <Row label="العميل" value={booking.customer_name} />
          <Row label="الجوال" value={booking.customer_phone} />
          <Row label="التاريخ" value={formatDate(booking.booking_date)} />
          <Row label="الملعب" value={getCourtName(booking.court_id)} />
          <Row label="الفترة" value={getPeriodName(booking.period_number)} />
          <Row label="الكود" value={booking.code_used ?? '—'} />
          <Row label="السعر الأصلي" value={formatAmount(booking.base_price)} />
          <Row label="الخصم" value={formatAmount(booking.discount_amount)} />
          {booking.water_quantity > 0 ? (
            <Row label="💧 المياه" value={
              <span style={{ color: '#0ea5e9' }}>
                {booking.water_quantity} كرتون × {formatAmount(Math.round((booking.final_price - booking.base_price + booking.discount_amount) / booking.water_quantity))} = {formatAmount(booking.final_price - booking.base_price + booking.discount_amount)}
              </span>
            } />
          ) : (
            <Row label="💧 المياه" value={<span style={{ color: 'var(--text-muted)' }}>لا يوجد</span>} />
          )}
          <Row label="المبلغ النهائي" value={<strong style={{ color: 'var(--color-primary)', fontSize: '1.15rem' }}>{formatAmount(booking.final_price)}</strong>} />
          {booking.water_quantity > 0 && (
            <Row label="" value={
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ({formatAmount(booking.base_price)} - {formatAmount(booking.discount_amount)} خصم + {formatAmount(booking.final_price - booking.base_price + booking.discount_amount)} مياه)
              </span>
            } />
          )}
          <Row label="نوع الحجز" value={booking.is_manual ? '🖊️ يدوي' : '🌐 إلكتروني'} />
          <Row label="وقت الحجز" value={formatDateTime(booking.created_at)} />
          {booking.confirmed_at && <Row label="وقت الاعتماد" value={formatDateTime(booking.confirmed_at)} />}
          {booking.rejection_reason && <Row label="سبب الرفض" value={<span style={{ color: 'var(--color-danger)' }}>{booking.rejection_reason}</span>} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* الإيصال */}
          {booking.receipt_url && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📄 الإيصال</h2>
              <a href={booking.receipt_url} target="_blank" rel="noreferrer"
                className="btn btn-secondary btn-full" style={{ marginBottom: '0.75rem' }}>
                🔍 عرض الإيصال
              </a>
              {booking.receipt_uploaded_at && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  رُفع: {formatDateTime(booking.receipt_uploaded_at)}
                </p>
              )}
            </div>
          )}

          {/* الاعتماد / الرفض */}
          {canEdit && booking.status === 'uploaded' && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>✅ اعتماد أو رفض الإيصال</h2>
              <form action={confirmBooking} style={{ marginBottom: '0.75rem' }}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <button id={`btn-confirm-${booking.id}`} type="submit" className="btn btn-success btn-full">
                  ✅ اعتماد الحجز
                </button>
              </form>
              <form action={rejectBooking}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="rejection_reason" className="input" placeholder="سبب الرفض..." required
                  style={{ marginBottom: '0.75rem', resize: 'vertical', minHeight: '80px' }} />
                <button id={`btn-reject-${booking.id}`} type="submit" className="btn btn-danger btn-full">
                  ✕ رفض الحجز
                </button>
              </form>
            </div>
          )}

          {/* إلغاء الحجز (من الأدمن) — لكل الحالات النشطة */}
          {canEdit && ['pending', 'uploaded', 'confirmed'].includes(booking.status) && (
            <div className="card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#dc2626' }}>❌ إلغاء الحجز</h2>
              <form action={cancelBookingAdmin}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="cancellation_reason" className="input" placeholder="سبب الإلغاء..." required
                  style={{ marginBottom: '0.75rem', resize: 'vertical', minHeight: '70px' }} />
                {booking.status === 'confirmed' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="checkbox" name="refunded" style={{ width: '1.1rem', height: '1.1rem', accentColor: '#2D5C4E' }} />
                    <span>تم استرداد المبلغ للعميل</span>
                  </label>
                )}
                <button type="submit" className="btn btn-danger btn-full">
                  🗑️ تأكيد الإلغاء
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                  ⚠️ هذا الإجراء لا يمكن التراجع عنه — ستتحرر الفترة
                </p>
              </form>
            </div>
          )}

          {/* ملاحظة داخلية */}
          {canEdit && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📝 ملاحظة داخلية</h2>
              <form action={addNote}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <textarea name="internal_note" className="input" placeholder="أضف ملاحظة داخلية..."
                  defaultValue={booking.internal_note ?? ''} style={{ marginBottom: '0.75rem', resize: 'vertical', minHeight: '80px' }} />
                <button type="submit" className="btn btn-secondary btn-full">💾 حفظ الملاحظة</button>
              </form>
            </div>
          )}

          {/* تقييم العميل — قراءة فقط */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>⭐ تقييم العميل</h2>
            {ratingData ? (
              <div>
                <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.5rem' }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ fontSize: '1.5rem', color: n <= ratingData.rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
                  ))}
                  <span style={{ marginRight: '0.5rem', fontWeight: 700, color: '#92400e', alignSelf: 'center' }}>
                    {ratingData.rating}/5
                  </span>
                </div>
                {ratingData.comment && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 0.5rem', background: '#fefce8', padding: '0.6rem 0.75rem', borderRadius: '0.5rem' }}>
                    &ldquo;{ratingData.comment}&rdquo;
                  </p>
                )}
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(ratingData.created_at).toLocaleString('ar-SA')}
                </small>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                لم يُقيَّم بعد
              </p>
            )}
          </div>
        </div>
      </div>


      <style>{`
        @media (max-width: 700px) { div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; } }
        .detail-row { display: flex; justify-content: space-between; padding: 0.55rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: var(--text-muted); flex-shrink: 0; }
      `}</style>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'left' }}>{value}</span>
    </div>
  )
}
