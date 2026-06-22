'use client'
// ============================================================
// صفحة حجوزاتي — عرض وإلغاء الحجوزات + نظام التقييم
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, formatDateTime, getCourtName, getPeriodName, localDateStr } from '@/lib/utils'
import type { Booking } from '@/types'
import {
  ArrowRight, Star, X, CalendarDays, Clock,
  Trophy, Upload, Trash2, AlertCircle, InboxIcon,
  CheckCircle2, Loader2,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

// نوع الحجز موسّع بالتقييم
interface BookingWithRating extends Booking {
  rating: { id: string; rating: number; comment: string | null; created_at: string } | null
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: 'بانتظار الإيصال', color: 'var(--color-warning)',  bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  uploaded:  { label: 'قيد المراجعة',    color: 'var(--color-info)',     bg: 'var(--color-info-bg)',    border: 'var(--color-info)'    },
  confirmed: { label: 'مؤكد',            color: 'var(--color-lime)',     bg: 'var(--color-lime-muted)', border: 'var(--color-lime-dim)' },
  rejected:  { label: 'مرفوض',           color: 'var(--color-danger)',   bg: 'var(--color-danger-bg)',  border: 'var(--color-danger)'  },
  cancelled: { label: 'ملغى',            color: 'var(--text-muted)',     bg: 'var(--bg-elevated)',      border: 'var(--border-color)'  },
  expired:   { label: 'منتهي المهلة',    color: 'var(--text-muted)',     bg: 'var(--bg-elevated)',      border: 'var(--border-color)'  },
}

// ── مكوّن النجوم — SVG نظيف ──────────────────────────────────
function StarRow({ value, interactive, onSelect }: {
  value:       number
  interactive: boolean
  onSelect?:   (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="mb-star-row" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className={`mb-star ${active >= n ? 'mb-star-filled' : ''} ${interactive ? 'mb-star-interactive' : ''}`}
          onMouseEnter={() => interactive && setHover(n)}
          onClick={() => interactive && onSelect?.(n)}
          disabled={!interactive}
          aria-label={interactive ? `${n} نجوم` : undefined}
          tabIndex={interactive ? 0 : -1}
        >
          <Star
            size={interactive ? 28 : 20}
            strokeWidth={1.75}
            fill={active >= n ? 'currentColor' : 'none'}
          />
        </button>
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

  const LABELS = ['', 'ضعيف', 'مقبول', 'جيد', 'ممتاز', 'رائع جداً']

  async function handleSubmit() {
    if (stars === 0) { setError('اختر عدد النجوم'); return }
    setLoading(true); setError('')
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

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="mb-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mb-modal" role="dialog" aria-modal="true" aria-label="تقييم الحجز">

        {/* رأس الـ modal */}
        <div className="mb-modal-head">
          <div className="mb-modal-icon">
            <Star size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="mb-modal-title">قيّم تجربتك</h2>
            <p className="mb-modal-sub">كيف كانت تجربتك في مركز حي الشاطئ؟</p>
          </div>
          <button className="mb-modal-close" onClick={onClose} aria-label="إغلاق">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* النجوم */}
        <div className="mb-stars-wrap">
          <StarRow value={stars} interactive onSelect={setStars} />
          <p className="mb-stars-label">
            {LABELS[stars] || <span>&nbsp;</span>}
          </p>
        </div>

        {/* التعليق */}
        <textarea
          id="rating-comment"
          className="mb-textarea"
          placeholder="أضف تعليقاً (اختياري)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
        />

        {error && (
          <div className="mb-error">
            <AlertCircle size={14} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {/* أزرار */}
        <div className="mb-modal-actions">
          <button
            id="btn-submit-rating"
            className="mb-btn-primary"
            onClick={handleSubmit}
            disabled={loading || stars === 0}
          >
            {loading
              ? <><Loader2 size={16} strokeWidth={2} className="mb-spin" />جاري الإرسال...</>
              : <><CheckCircle2 size={16} strokeWidth={2} />إرسال التقييم</>
            }
          </button>
          <button className="mb-btn-ghost" onClick={onClose}>إلغاء</button>
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

  const today = localDateStr(new Date())

  const canRate = useCallback((bk: BookingWithRating): boolean => (
    bk.status === 'confirmed' && bk.booking_date < today && !bk.rating
  ), [today])

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
    setCancelling(bookingId); setError('')
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
    <div className="mb-page">

      {/* ── هيدر ثابت ── */}
      <header className="mb-header">
        <div className="mb-header-inner">
          <button className="mb-back-btn" onClick={() => router.push('/book')}>
            <ArrowRight size={16} strokeWidth={2} />
            احجز الآن
          </button>
          <h1 className="mb-header-title">حجوزاتي</h1>
          <ThemeToggle className="mb-theme-toggle" />
        </div>
      </header>

      {/* ── المحتوى ── */}
      <main className="mb-main">

        {/* تحميل */}
        {loading && (
          <div className="mb-state-center">
            <Loader2 size={32} strokeWidth={1.75} className="mb-spin mb-spin-muted" />
            <p className="mb-state-text">جاري التحميل...</p>
          </div>
        )}

        {/* فارغ */}
        {!loading && bookings.length === 0 && (
          <div className="mb-state-center animate-fade-in">
            <div className="mb-empty-icon">
              <InboxIcon size={32} strokeWidth={1.5} />
            </div>
            <p className="mb-state-text">لا توجد حجوزات بعد</p>
            <button className="mb-btn-primary" onClick={() => router.push('/book')}>
              <CalendarDays size={16} strokeWidth={2} />
              احجز الآن
            </button>
          </div>
        )}

        {/* خطأ عام */}
        {error && (
          <div className="mb-error mb-error-bar">
            <AlertCircle size={15} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {/* قائمة الحجوزات */}
        <div className="mb-list">
          {bookings.map(bk => {
            const st         = STATUS_CFG[bk.status] ?? STATUS_CFG.cancelled
            const canCancel  = ['pending', 'uploaded'].includes(bk.status)
            const canUpload  = bk.status === 'pending'
            const showRate   = canRate(bk)

            return (
              <div key={bk.id} className="mb-card animate-fade-in">

                {/* رأس الكرت: تاريخ + badge */}
                <div className="mb-card-head">
                  <div className="mb-card-info">
                    <div className="mb-card-date">
                      <CalendarDays size={14} strokeWidth={2} className="mb-card-date-icon" />
                      {formatDate(bk.booking_date)}
                    </div>
                    <div className="mb-card-details">
                      <Clock size={12} strokeWidth={2} />
                      {getCourtName(bk.court_id)} — {getPeriodName(bk.period_number)}
                    </div>
                  </div>
                  <span
                    className="mb-badge"
                    style={{ color: st.color, background: st.bg, borderColor: st.border }}
                  >
                    {bk.status === 'confirmed' && <CheckCircle2 size={11} strokeWidth={2.5} />}
                    {st.label}
                  </span>
                </div>

                {/* جسم الكرت: السعر + كود + رفض */}
                <div className="mb-card-body">
                  <span className="mb-card-amount">{formatAmount(bk.final_price)}</span>
                  {bk.code_used && (
                    <span className="mb-code-badge">
                      <Trophy size={11} strokeWidth={2} />
                      كود: {bk.code_used}
                    </span>
                  )}
                  {bk.rejection_reason && (
                    <div className="mb-rejection">
                      <AlertCircle size={13} strokeWidth={2} />
                      سبب الرفض: {bk.rejection_reason}
                    </div>
                  )}
                </div>

                {/* التقييم المُرسَل (read-only) */}
                {bk.rating && (
                  <div className="mb-rating-display">
                    <StarRow value={bk.rating.rating} interactive={false} />
                    {bk.rating.comment && (
                      <p className="mb-rating-comment">{bk.rating.comment}</p>
                    )}
                  </div>
                )}

                {/* فوتر الكرت: تاريخ الإنشاء + أزرار */}
                <div className="mb-card-foot">
                  <small className="mb-card-ts">{formatDateTime(bk.created_at)}</small>
                  <div className="mb-card-actions">
                    {showRate && (
                      <button
                        id={`btn-rate-${bk.id}`}
                        className="mb-btn-rate"
                        onClick={() => setRatingFor(bk.id)}
                      >
                        <Star size={13} strokeWidth={2} />
                        قيّم تجربتك
                      </button>
                    )}
                    {canUpload && (
                      <button
                        id={`btn-upload-${bk.id}`}
                        className="mb-btn-upload"
                        onClick={() => router.push(`/book?upload=${bk.id}`)}
                      >
                        <Upload size={13} strokeWidth={2} />
                        رفع إيصال
                      </button>
                    )}
                    {canCancel && (
                      <button
                        id={`btn-cancel-${bk.id}`}
                        className="mb-btn-danger"
                        disabled={cancelling === bk.id}
                        onClick={() => handleCancel(bk.id)}
                      >
                        {cancelling === bk.id
                          ? <Loader2 size={13} strokeWidth={2} className="mb-spin" />
                          : <Trash2 size={13} strokeWidth={2} />
                        }
                        إلغاء
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
        * { box-sizing: border-box; }

        /* ══ الصفحة ══ */
        .mb-page {
          min-height: 100vh;
          background: var(--bg-base);
        }

        /* ══ الهيدر ══ */
        .mb-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
        }
        .mb-header-inner {
          max-width: 720px;
          margin-inline: auto;
          padding: 0.875rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .mb-header-title {
          flex: 1;
          text-align: center;
          font-size: var(--text-base);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0;
        }
        .mb-back-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          background: none;
          border: none;
          color: var(--color-lime);
          font-size: var(--text-sm);
          font-family: inherit;
          font-weight: var(--font-semibold);
          cursor: pointer;
          padding: 0;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .mb-back-btn:hover { opacity: 0.75; }

        /* ThemeToggle inline في الهيدر */
        .mb-theme-toggle {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-sidebar);
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .mb-theme-toggle:hover { background: var(--bg-elevated); color: var(--color-lime); }

        /* ══ المحتوى الرئيسي ══ */
        .mb-main {
          max-width: 680px;
          margin-inline: auto;
          padding: 1.5rem 1rem 5rem;
        }

        /* ══ حالات التحميل/الفراغ ══ */
        .mb-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 4rem 1rem;
          text-align: center;
        }
        .mb-state-text {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin: 0;
        }
        .mb-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-xl);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ══ الكروت ══ */
        .mb-list {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .mb-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          transition: box-shadow 0.2s;
        }
        .mb-card:hover { box-shadow: var(--shadow-md); }

        /* رأس الكرت */
        .mb-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .mb-card-info { display: flex; flex-direction: column; gap: 0.25rem; }
        .mb-card-date {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-weight: var(--font-bold);
          font-size: var(--text-sm);
          color: var(--text-primary);
        }
        .mb-card-date-icon { color: var(--color-lime); flex-shrink: 0; }
        .mb-card-details {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--text-muted);
          font-size: var(--text-xs);
        }

        /* badge الحالة — inline style للألوان */
        .mb-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-full);
          border: 1px solid;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* جسم الكرت */
        .mb-card-body {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex-wrap: wrap;
        }
        .mb-card-amount {
          font-size: 1.35rem;
          font-weight: var(--font-black);
          color: var(--color-lime);
          letter-spacing: -0.02em;
        }
        .mb-code-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-full);
          padding: 0.2rem 0.55rem;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
        }
        .mb-rejection {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--color-danger);
          background: var(--color-danger-bg);
          border: 1px solid rgba(224,85,85,.25);
          border-radius: var(--radius-md);
          padding: 0.35rem 0.625rem;
          font-size: var(--text-xs);
          width: 100%;
        }

        /* ══ النجوم ══ */
        .mb-star-row {
          display: flex;
          gap: 0.25rem;
          justify-content: center;
          align-items: center;
        }
        .mb-star {
          background: none;
          border: none;
          padding: 0.125rem;
          color: var(--border-color);
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.1s, transform 0.1s;
          cursor: default;
        }
        .mb-star:disabled { cursor: default; }
        .mb-star-filled { color: var(--color-lime); }
        .mb-star-interactive { cursor: pointer; }
        .mb-star-interactive:hover { transform: scale(1.18); color: var(--color-lime); }
        .mb-star-interactive.mb-star-filled:hover { color: var(--color-lime); }

        /* عرض التقييم read-only */
        .mb-rating-display {
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-md);
          padding: 0.625rem 0.875rem;
        }
        .mb-rating-display .mb-star-row { justify-content: flex-start; }
        .mb-rating-comment {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0.3rem 0 0;
          font-style: italic;
        }

        /* ══ فوتر الكرت ══ */
        .mb-card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .mb-card-ts {
          color: var(--text-muted);
          font-size: var(--text-xs);
        }
        .mb-card-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        /* ══ الأزرار الصغيرة ══ */
        .mb-btn-rate,
        .mb-btn-upload,
        .mb-btn-danger,
        .mb-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s, transform 0.1s;
          border: 1px solid;
          white-space: nowrap;
        }
        .mb-btn-rate {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border-color: var(--color-lime-dim);
        }
        .mb-btn-rate:hover { background: var(--color-lime-glow); }

        .mb-btn-upload {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        .mb-btn-upload:hover { border-color: var(--color-lime-dim); color: var(--color-lime); }

        .mb-btn-danger {
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border-color: rgba(224,85,85,.3);
        }
        .mb-btn-danger:hover:not(:disabled) { background: rgba(224,85,85,.2); }
        .mb-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

        .mb-btn-ghost {
          background: transparent;
          color: var(--text-muted);
          border-color: var(--border-color);
        }
        .mb-btn-ghost:hover { background: var(--bg-elevated); color: var(--text-primary); }

        /* ══ زر أساسي (فارغ + modal) ══ */
        .mb-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: 0.625rem 1.25rem;
          height: 44px;
          background: var(--color-lime);
          color: #0a1a0a;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-black);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 14px var(--color-lime-glow);
        }
        .mb-btn-primary:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .mb-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

        /* ══ رسالة الخطأ ══ */
        .mb-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25);
          border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }
        .mb-error-bar { margin-bottom: 1rem; }

        /* ══ Modal ══ */
        .mb-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.55);
          backdrop-filter: blur(4px);
          z-index: 9990;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: mb-fade-in .15s ease;
        }
        .mb-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-2xl);
          padding: 1.5rem;
          width: 100%;
          max-width: 400px;
          position: relative;
          box-shadow: var(--shadow-lg);
          animation: mb-slide-up .2s ease;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .mb-modal-head {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
        }
        .mb-modal-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mb-modal-title {
          font-size: var(--text-lg);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin: 0 0 0.2rem;
        }
        .mb-modal-sub {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0;
        }
        .mb-modal-close {
          margin-right: auto;
          width: 30px;
          height: 30px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .mb-modal-close:hover { background: var(--color-danger-bg); color: var(--color-danger); }

        .mb-stars-wrap { text-align: center; }
        .mb-stars-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-lime);
          margin: 0.35rem 0 0;
          min-height: 1.4em;
        }
        .mb-textarea {
          width: 100%;
          min-height: 90px;
          resize: vertical;
          background: var(--bg-elevated);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
          padding: var(--space-3);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .mb-textarea:focus {
          border-color: var(--color-lime-dim);
          box-shadow: 0 0 0 3px var(--color-lime-glow);
        }
        .mb-modal-actions {
          display: flex;
          gap: 0.625rem;
        }
        .mb-modal-actions .mb-btn-primary { flex: 1; }
        .mb-modal-actions .mb-btn-ghost { min-width: 80px; }

        /* ══ Spinner ══ */
        .mb-spin { animation: mb-spin .7s linear infinite; }
        .mb-spin-muted { color: var(--text-muted); }
        @keyframes mb-spin { to { transform: rotate(360deg); } }

        /* ══ Animations ══ */
        @keyframes mb-fade-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes mb-slide-up { from { transform:translateY(16px); opacity:0 } to { transform:none; opacity:1 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        .animate-fade-in { animation: fadeIn 0.3s ease both; }

        /* ══ جوال ≤480px ══ */
        @media (max-width: 480px) {
          .mb-main { padding: 1.25rem 0.875rem 5rem; }
          .mb-card { padding: 1rem; }
          .mb-card-amount { font-size: 1.15rem; }
          .mb-header-inner { padding: 0.75rem 1rem; }
          .mb-modal { padding: 1.25rem; }
        }
      `}</style>
    </div>
  )
}
