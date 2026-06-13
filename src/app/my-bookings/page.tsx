'use client'
// ============================================================
// صفحة حجوزاتي — عرض وإلغاء الحجوزات
// ============================================================
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import type { Booking } from '@/types'

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending:   { label: 'بانتظار الإيصال', class: 'badge-pending' },
  uploaded:  { label: 'قيد المراجعة', class: 'badge-uploaded' },
  confirmed: { label: 'مؤكد ✓', class: 'badge-confirmed' },
  rejected:  { label: 'مرفوض', class: 'badge-rejected' },
  cancelled: { label: 'ملغى', class: 'badge-cancelled' },
  expired:   { label: 'منتهي المهلة', class: 'badge-expired' },
}

export default function MyBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/booking/my-bookings')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setBookings(data.bookings ?? []) })
      .finally(() => setLoading(false))
  }, [router])

  async function handleCancel(bookingId: string) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) return
    setCancelling(bookingId)
    setError('')
    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setBookings(b => b.map(bk => bk.id === bookingId ? { ...bk, status: 'cancelled' } : bk))
    } finally { setCancelling(null) }
  }

  return (
    <div className="my-bookings-page">
      <header className="book-header">
        <div className="book-header-inner">
          <button className="step-back" onClick={() => router.push('/book')}>← احجز الآن</button>
          <h1 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>حجوزاتي</h1>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '2rem', height: '2rem' }} />
            <p>جاري التحميل...</p>
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <p style={{ color: 'var(--text-secondary)' }}>لا توجد حجوزات بعد</p>
            <button className="btn btn-primary" onClick={() => router.push('/book')}>
              احجز الآن
            </button>
          </div>
        )}

        {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bookings.map(bk => {
            const st = STATUS_LABELS[bk.status] ?? { label: bk.status, class: 'badge-cancelled' }
            const canCancel = ['pending', 'uploaded'].includes(bk.status)
            const canUpload = bk.status === 'pending'
            return (
              <div key={bk.id} className="card booking-card animate-fade-in">
                <div className="booking-card-header">
                  <div>
                    <div className="booking-date">{formatDate(bk.booking_date)}</div>
                    <div className="booking-details">
                      {getCourtName(bk.court_id)} — {getPeriodName(bk.period_number)}
                    </div>
                  </div>
                  <span className={`badge ${st.class}`}>{st.label}</span>
                </div>

                <div className="booking-card-body">
                  <div className="booking-amount">{formatAmount(bk.final_price)}</div>
                  {bk.code_used && <span className="badge badge-confirmed">كود: {bk.code_used}</span>}
                  {bk.rejection_reason && (
                    <div className="booking-rejection">سبب الرفض: {bk.rejection_reason}</div>
                  )}
                </div>

                <div className="booking-card-footer">
                  <small style={{ color: 'var(--text-muted)' }}>
                    {formatDateTime(bk.created_at)}
                  </small>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canUpload && (
                      <button
                        id={`btn-upload-${bk.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={() => router.push(`/book?upload=${bk.id}`)}
                      >
                        رفع إيصال
                      </button>
                    )}
                    {canCancel && (
                      <button
                        id={`btn-cancel-${bk.id}`}
                        className="btn btn-danger btn-sm"
                        disabled={cancelling === bk.id}
                        onClick={() => handleCancel(bk.id)}
                      >
                        {cancelling === bk.id ? <span className="spinner" /> : 'إلغاء'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <style>{`
        .my-bookings-page { min-height: 100vh; background: var(--bg-base); }
        .book-header { background: #fff; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 50; }
        .book-header-inner { max-width: 680px; margin: 0 auto; padding: 0.875rem 1.25rem; display: flex; align-items: center; justify-content: space-between; }
        .step-back { background: none; border: none; color: var(--color-primary); font-size: 0.875rem; font-family: inherit; cursor: pointer; padding: 0; font-weight: 600; }
        .booking-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .booking-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
        .booking-date { font-weight: 700; font-size: 0.95rem; }
        .booking-details { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.2rem; }
        .booking-card-body { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .booking-amount { font-size: 1.2rem; font-weight: 800; color: var(--color-primary); }
        .booking-rejection { color: var(--color-danger); font-size: 0.85rem; background: #fee2e2; padding: 0.4rem 0.75rem; border-radius: 0.5rem; }
        .booking-card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
        .form-error { background: #fee2e2; color: #991b1b; padding: 0.6rem 0.875rem; border-radius: 0.5rem; font-size: 0.875rem; border-right: 3px solid #ef4444; }
      `}</style>
    </div>
  )
}
