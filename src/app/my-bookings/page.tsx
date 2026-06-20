'use client'
// ============================================================
// صفحة حجوزاتي — عرض وإلغاء الحجوزات + نظام التقييم
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, formatDateTime, getCourtName, getPeriodName } from '@/lib/utils'
import type { Booking } from '@/types'

// نوع الحجز موسّع بالتقييم
interface BookingWithRating extends Booking {
  rating: { id: string; rating: number; comment: string | null; created_at: string } | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending:   { label: 'بانتظار الإيصال', class: 'badge-pending'   },
  uploaded:  { label: 'قيد المراجعة',    class: 'badge-uploaded'  },
  confirmed: { label: 'مؤكد ✓',          class: 'badge-confirmed' },
  rejected:  { label: 'مرفوض',            class: 'badge-rejected'  },
  cancelled: { label: 'ملغى',             class: 'badge-cancelled' },
  expired:   { label: 'منتهي المهلة',     class: 'badge-expired'   },
}

// ── مكوّن النجوم ─────────────────────────────────────────────
function StarRow({ value, interactive, onSelect }: {
  value:       number
  interactive: boolean
  onSelect?:   (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="star-row" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map(n => (
        <span
          key={n}
          className={`star ${(hover || value) >= n ? 'star-filled' : ''} ${interactive ? 'star-interactive' : ''}`}
          onMouseEnter={() => interactive && setHover(n)}
          onClick={() => interactive && onSelect?.(n)}
          role={interactive ? 'button' : undefined}
          aria-label={interactive ? `${n} نجوم` : undefined}
        >★</span>
      ))}
    </div>
  )
}

// ── Modal التقييم ─────────────────────────────────────────────
function RatingModal({ bookingId, onClose, onSuccess }: {
  bookingId: string
  onClose:   () => void
  onSuccess: (rating: number, comment: string) => void
}) {
  const [stars,   setStars]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit() {
    if (stars === 0) { setError('اختر عدد النجوم'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/booking/rate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_id: bookingId, rating: stars, comment }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess(stars, comment)
    } catch { setError('فشل الاتصال') }
    finally  { setLoading(false) }
  }

  // إغلاق بـ Escape أو ضغط خارج الـ modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="تقييم الحجز">
        <button className="modal-close" onClick={onClose} aria-label="إغلاق">✕</button>
        <h2 className="modal-title">⭐ قيّم تجربتك</h2>
        <p className="modal-sub">كيف كانت تجربتك في مركز حي الشاطئ؟</p>

        <div style={{ margin: '1.5rem 0' }}>
          <StarRow value={stars} interactive onSelect={setStars} />
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem', minHeight: '1.2em' }}>
            {stars === 1 ? 'ضعيف' : stars === 2 ? 'مقبول' : stars === 3 ? 'جيد' : stars === 4 ? 'ممتاز' : stars === 5 ? 'رائع جداً ✨' : ''}
          </p>
        </div>

        <textarea
          id="rating-comment"
          className="input"
          placeholder="أضف تعليقاً (اختياري)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
          style={{ minHeight: '90px', resize: 'vertical', marginBottom: '1rem' }}
        />

        {error && <div className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="btn-submit-rating"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleSubmit}
            disabled={loading || stars === 0}
          >
            {loading ? <span className="spinner" /> : 'إرسال التقييم'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}

// ── الصفحة الرئيسية ──────────────────────────────────────────
export default function MyBookingsPage() {
  const router = useRouter()
  const [bookings,   setBookings]   = useState<BookingWithRating[]>([])
  const [loading,    setLoading]    = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error,      setError]      = useState('')
  const [ratingFor,  setRatingFor]  = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // هل يستحق الحجز زر التقييم؟
  const canRate = useCallback((bk: BookingWithRating): boolean => {
    return (
      bk.status === 'confirmed' &&
      bk.booking_date < today &&
      !bk.rating
    )
  }, [today])

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

  function handleRatingSuccess(bookingId: string, stars: number, comment: string) {
    setBookings(b => b.map(bk =>
      bk.id === bookingId
        ? { ...bk, rating: { id: 'new', rating: stars, comment, created_at: new Date().toISOString() } }
        : bk
    ))
    setRatingFor(null)
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
            const st      = STATUS_LABELS[bk.status] ?? { label: bk.status, class: 'badge-cancelled' }
            const canCancel = ['pending', 'uploaded'].includes(bk.status)
            const canUpload = bk.status === 'pending'
            const showRate  = canRate(bk)

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

                {/* التقييم المُرسَل (read-only) */}
                {bk.rating && (
                  <div className="rating-display">
                    <StarRow value={bk.rating.rating} interactive={false} />
                    {bk.rating.comment && (
                      <p className="rating-comment">{bk.rating.comment}</p>
                    )}
                  </div>
                )}

                <div className="booking-card-footer">
                  <small style={{ color: 'var(--text-muted)' }}>
                    {formatDateTime(bk.created_at)}
                  </small>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* زر التقييم */}
                    {showRate && (
                      <button
                        id={`btn-rate-${bk.id}`}
                        className="btn btn-rating btn-sm"
                        onClick={() => setRatingFor(bk.id)}
                      >
                        ⭐ قيّم تجربتك
                      </button>
                    )}
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

      {/* Modal التقييم */}
      {ratingFor && (
        <RatingModal
          bookingId={ratingFor}
          onClose={() => setRatingFor(null)}
          onSuccess={(stars, comment) => handleRatingSuccess(ratingFor, stars, comment)}
        />
      )}

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

        /* النجوم */
        .star-row { display: flex; gap: 0.25rem; justify-content: center; }
        .star { font-size: 2rem; color: #d1d5db; line-height: 1; transition: color 0.1s; }
        .star-filled { color: #f59e0b; }
        .star-interactive { cursor: pointer; }
        .star-interactive:hover { transform: scale(1.15); }

        /* عرض التقييم المُرسَل */
        .rating-display { background: #fefce8; border: 1px solid #fde68a; border-radius: 0.5rem; padding: 0.75rem; }
        .rating-display .star-row { justify-content: flex-start; }
        .rating-display .star { font-size: 1.3rem; }
        .rating-comment { font-size: 0.82rem; color: var(--text-secondary); margin: 0.35rem 0 0; font-style: italic; }

        /* زر التقييم */
        .btn-rating { background: #fef3c7; color: #92400e; border: 1.5px solid #fde68a; font-weight: 700; }
        .btn-rating:hover { background: #fde68a; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 200;
          display: flex; align-items: center; justify-content: center; padding: 1rem;
          animation: fadeIn .15s ease;
        }
        .modal-box {
          background: #fff; border-radius: 1rem; padding: 1.75rem 1.5rem;
          width: 100%; max-width: 420px; position: relative;
          animation: slideUp .2s ease;
        }
        .modal-close {
          position: absolute; top: 0.75rem; left: 0.75rem;
          background: none; border: none; font-size: 1.25rem; cursor: pointer;
          color: var(--text-muted); line-height: 1;
        }
        .modal-title { font-size: 1.2rem; font-weight: 800; text-align: center; margin: 0 0 0.3rem; }
        .modal-sub   { text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: 0; }

        @keyframes fadeIn  { from { opacity:0 }   to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      `}</style>
    </div>
  )
}
