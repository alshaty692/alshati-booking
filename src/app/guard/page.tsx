'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Droplets, CheckCircle2, Clock, RefreshCw,
  LogOut, Wifi, WifiOff, Package,
} from 'lucide-react'
import GuardThemeToggle from '@/components/guard/GuardThemeToggle'

// ── أسماء الملاعب والفترات (تطابق المشروع) ─────────────────
const COURT_LABELS: Record<string, string> = {
  football:   'كرة القدم',
  volleyball: 'الكرة الطائرة',
  multi:      'الملعب المتعدد',
}

const PERIOD_LABELS: Record<number, string> = {
  1: '5–7م',
  2: '7–9م',
  3: '9–11م',
}

interface GuardBooking {
  id: string
  booking_date: string
  court_id: string
  period_number: number
  customer_name: string
  water_quantity: number
  water_delivered_quantity: number | null
  water_delivered_at: string | null
  status: string
}

interface DeliverState {
  bookingId: string
  value: number
}

const POLL_INTERVAL_MS = 15_000 // 15 ثانية

export default function GuardPortalPage() {
  const router  = useRouter()
  const [bookings, setBookings]         = useState<GuardBooking[]>([])
  const [operationalDate, setOperDate]  = useState('')
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)
  const [loading, setLoading]           = useState(true)
  const [online, setOnline]             = useState(true)
  const [refreshing, setRefreshing]     = useState(false)

  // حالة dialog تسجيل التسليم
  const [deliver, setDeliver]           = useState<DeliverState | null>(null)
  const [deliverLoading, setDLLoading]  = useState(false)
  const [deliverError, setDError]       = useState('')

  // Polling timer ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── جلب الحجوزات ──────────────────────────────────────────
  const fetchBookings = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)

    try {
      const res = await fetch('/api/guard/bookings', {
        cache:   'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (res.status === 401) {
        router.replace('/guard/login')
        return
      }

      if (!res.ok) {
        setOnline(false)
        return
      }

      const data = await res.json()
      setBookings(data.bookings ?? [])
      setOperDate(data.operational_date ?? '')
      setLastUpdated(new Date())
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [router])

  // ── التهيئة + Polling + visibilitychange ──────────────────
  useEffect(() => {
    fetchBookings()

    // Polling كل 15 ثانية
    pollRef.current = setInterval(() => fetchBookings(), POLL_INTERVAL_MS)

    // إعادة جلب عند العودة للتبويب
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchBookings()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchBookings])

  // ── تسجيل الخروج ──────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/guard/logout', { method: 'POST' })
    router.replace('/guard/login')
  }

  // ── فتح dialog التسليم ────────────────────────────────────
  function openDeliver(booking: GuardBooking) {
    setDError('')
    setDeliver({
      bookingId: booking.id,
      value:     booking.water_quantity, // القيمة الافتراضية = المطلوبة
    })
  }

  // ── تأكيد التسليم ─────────────────────────────────────────
  async function confirmDeliver() {
    if (!deliver) return
    setDLLoading(true)
    setDError('')

    try {
      const res = await fetch(
        `/api/guard/bookings/${deliver.bookingId}/deliver`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ delivered_quantity: deliver.value }),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        setDError(data.error || 'فشل التسجيل')
        return
      }

      // تحديث الحجز محلياً فوراً
      setBookings(prev =>
        prev.map(b =>
          b.id === deliver.bookingId
            ? {
                ...b,
                water_delivered_quantity: data.booking.water_delivered_quantity,
                water_delivered_at:       data.booking.water_delivered_at,
              }
            : b
        )
      )
      setDeliver(null)
    } catch {
      setDError('خطأ في الاتصال — حاول مجدداً')
    } finally {
      setDLLoading(false)
    }
  }

  // ── تنسيق وقت التحديث ─────────────────────────────────────
  function formatLastUpdated(d: Date): string {
    const fmt = new Intl.DateTimeFormat('ar-SA', {
      timeZone: 'Asia/Riyadh',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    return fmt.format(d)
  }

  // ── تنسيق وقت التسليم ─────────────────────────────────────
  function formatDeliveredAt(isoStr: string): string {
    return new Intl.DateTimeFormat('ar-SA', {
      timeZone: 'Asia/Riyadh',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoStr))
  }

  // ── تصنيف الحجوزات: تحتاج مياه vs لا تحتاج ───────────────
  const waterBookings   = bookings.filter(b => b.water_quantity > 0)
  const noWaterBookings = bookings.filter(b => b.water_quantity === 0)
  const deliveredCount  = waterBookings.filter(b => b.water_delivered_at !== null).length
  const pendingCount    = waterBookings.length - deliveredCount

  // ── الحجز المستهدف للـ dialog ─────────────────────────────
  const deliverBooking = deliver
    ? bookings.find(b => b.id === deliver.bookingId)
    : null

  if (loading) {
    return (
      <div className="gp-loading">
        <span className="spinner" />
        <p>جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="gp-page">
      {/* ── رأس الصفحة ── */}
      <header className="gp-header">
        <div className="gp-header-inner">
          <div className="gp-header-brand">
            <div className="gp-header-icon">
              <Package size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="gp-header-title">بوابة الحارس</h1>
              <p className="gp-header-date">
                اليوم التشغيلي: <strong>{operationalDate}</strong>
              </p>
            </div>
          </div>

          <div className="gp-header-actions">
            {/* مؤشر الاتصال */}
            <div className={`gp-online-badge ${online ? 'gp-online' : 'gp-offline'}`}>
              {online
                ? <><Wifi size={13} strokeWidth={2} /> متصل</>
                : <><WifiOff size={13} strokeWidth={2} /> غير متصل</>
              }
            </div>

            {/* زر تبديل الثيم */}
            <GuardThemeToggle />

            {/* زر تحديث يدوي */}
            <button
              className="btn btn-ghost gp-refresh-btn"
              onClick={() => fetchBookings(true)}
              disabled={refreshing}
              title="تحديث يدوي"
            >
              <RefreshCw size={16} strokeWidth={2} className={refreshing ? 'gp-spin' : ''} />
            </button>

            {/* زر الخروج */}
            <button
              className="btn btn-ghost gp-logout-btn"
              onClick={handleLogout}
              title="تسجيل خروج"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* آخر تحديث */}
        {lastUpdated && (
          <div className="gp-last-updated">
            <Clock size={11} strokeWidth={2} />
            آخر تحديث: {formatLastUpdated(lastUpdated)}
            {' '}• يتجدد تلقائياً كل 15 ثانية
          </div>
        )}
      </header>

      {/* ── إحصائية سريعة ── */}
      {waterBookings.length > 0 && (
        <div className="gp-stats-row">
          <div className="gp-stat gp-stat-total">
            <span className="gp-stat-val">{waterBookings.length}</span>
            <span className="gp-stat-lbl">حجز بمياه</span>
          </div>
          <div className="gp-stat gp-stat-done">
            <CheckCircle2 size={14} strokeWidth={2} />
            <span className="gp-stat-val">{deliveredCount}</span>
            <span className="gp-stat-lbl">مُسلَّم</span>
          </div>
          <div className="gp-stat gp-stat-pending">
            <Droplets size={14} strokeWidth={2} />
            <span className="gp-stat-val">{pendingCount}</span>
            <span className="gp-stat-lbl">بانتظار التسليم</span>
          </div>
        </div>
      )}

      <div className="gp-content">
        {/* ── حجوزات بمياه ── */}
        {waterBookings.length > 0 && (
          <section className="gp-section">
            <h2 className="gp-section-title">
              <Droplets size={16} strokeWidth={2} />
              حجوزات تحتاج مياه ({waterBookings.length})
            </h2>
            <div className="gp-cards">
              {waterBookings.map(b => {
                const delivered = b.water_delivered_at !== null
                return (
                  <div
                    key={b.id}
                    className={`gp-card ${delivered ? 'gp-card-done' : 'gp-card-pending'}`}
                  >
                    {/* فترة + ملعب */}
                    <div className="gp-card-head">
                      <div className="gp-period-badge">
                        {PERIOD_LABELS[b.period_number] ?? `فترة ${b.period_number}`}
                      </div>
                      <div className="gp-court-tag">
                        {COURT_LABELS[b.court_id] ?? b.court_id}
                      </div>
                      {delivered && (
                        <div className="gp-done-badge">
                          <CheckCircle2 size={12} strokeWidth={2.5} />
                          مُسلَّم
                        </div>
                      )}
                    </div>

                    {/* اسم العميل */}
                    <div className="gp-customer-name">{b.customer_name}</div>

                    {/* كراتين المياه */}
                    <div className="gp-water-row">
                      <Droplets size={15} strokeWidth={2} className="gp-water-icon" />
                      <span className="gp-water-qty">
                        {b.water_quantity} كرتون مطلوب
                      </span>
                      {delivered && b.water_delivered_quantity !== null && (
                        <span className="gp-delivered-note">
                          ✓ {b.water_delivered_quantity} مُسلَّم
                          {b.water_delivered_at && (
                            <> الساعة {formatDeliveredAt(b.water_delivered_at)}</>
                          )}
                        </span>
                      )}
                    </div>

                    {/* زر التسليم */}
                    {!delivered ? (
                      <button
                        className="btn btn-primary gp-deliver-btn"
                        onClick={() => openDeliver(b)}
                      >
                        <CheckCircle2 size={16} strokeWidth={2} />
                        تسجيل التسليم
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost gp-redo-btn"
                        onClick={() => openDeliver(b)}
                      >
                        تعديل التسليم
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── حجوزات بدون مياه ── */}
        {noWaterBookings.length > 0 && (
          <section className="gp-section">
            <h2 className="gp-section-title gp-section-muted">
              حجوزات بدون مياه ({noWaterBookings.length})
            </h2>
            <div className="gp-list">
              {noWaterBookings.map(b => (
                <div key={b.id} className="gp-list-row">
                  <div className="gp-period-badge gp-period-sm">
                    {PERIOD_LABELS[b.period_number] ?? `فترة ${b.period_number}`}
                  </div>
                  <div className="gp-court-tag gp-court-sm">
                    {COURT_LABELS[b.court_id] ?? b.court_id}
                  </div>
                  <span className="gp-list-name">{b.customer_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── لا توجد حجوزات ── */}
        {bookings.length === 0 && (
          <div className="gp-empty">
            <Package size={40} strokeWidth={1} className="gp-empty-icon" />
            <p>لا توجد حجوزات مؤكدة ليوم {operationalDate}</p>
          </div>
        )}
      </div>

      {/* ── Dialog تسجيل التسليم ── */}
      {deliver && deliverBooking && (
        <div className="gp-overlay" onClick={() => setDeliver(null)}>
          <div className="gp-dialog animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="gp-dialog-title">تسجيل تسليم المياه</h3>

            <div className="gp-dialog-info">
              <span className="gp-dialog-name">{deliverBooking.customer_name}</span>
              <span className="gp-dialog-period">
                {PERIOD_LABELS[deliverBooking.period_number]} —{' '}
                {COURT_LABELS[deliverBooking.court_id] ?? deliverBooking.court_id}
              </span>
            </div>

            <div className="gp-dialog-field">
              <label htmlFor="deliver-qty" className="gp-dialog-label">
                الكمية المُسلَّمة (كرتون)
                <span className="gp-dialog-hint">
                  المطلوبة: {deliverBooking.water_quantity}
                </span>
              </label>
              <div className="gp-qty-row">
                <button
                  type="button"
                  className="gp-qty-btn"
                  onClick={() => setDeliver(d => d ? { ...d, value: Math.max(0, d.value - 1) } : d)}
                >−</button>
                <input
                  id="deliver-qty"
                  type="number"
                  className="input gp-qty-input"
                  value={deliver.value}
                  min={0}
                  max={999}
                  onChange={e => setDeliver(d => d ? { ...d, value: Math.max(0, parseInt(e.target.value) || 0) } : d)}
                />
                <button
                  type="button"
                  className="gp-qty-btn"
                  onClick={() => setDeliver(d => d ? { ...d, value: d.value + 1 } : d)}
                >+</button>
              </div>
            </div>

            {deliverError && (
              <div className="gp-dialog-error" role="alert">{deliverError}</div>
            )}

            <div className="gp-dialog-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setDeliver(null)}
                disabled={deliverLoading}
              >
                إلغاء
              </button>
              <button
                id="btn-confirm-deliver"
                className="btn btn-primary"
                onClick={confirmDeliver}
                disabled={deliverLoading}
              >
                {deliverLoading ? (
                  <><span className="spinner" /> جاري الحفظ...</>
                ) : (
                  <><CheckCircle2 size={16} strokeWidth={2} /> تأكيد التسليم</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Loading ── */
        .gp-loading {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          color: var(--text-muted);
        }

        /* ── Page ── */
        .gp-page {
          min-height: 100vh;
          background: var(--bg-base);
          padding-bottom: var(--space-10);
        }

        /* ── Header ── */
        .gp-header {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          padding: var(--space-4) var(--space-6);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .gp-header-inner {
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .gp-header-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .gp-header-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .gp-header-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0;
        }

        .gp-header-date {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0;
        }

        .gp-header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .gp-online-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 0.2em 0.6em;
          border-radius: var(--radius-full);
          white-space: nowrap;
        }
        .gp-online {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border: 1px solid rgba(200, 255, 62, 0.2);
        }
        [data-theme="light"] .gp-online {
          background: rgba(74,124,0,.08);
          color: #2D5A00;
          border-color: rgba(74,124,0,.2);
        }
        .gp-offline {
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224, 85, 85, 0.2);
        }

        .gp-refresh-btn, .gp-logout-btn {
          padding: var(--space-2);
          color: var(--text-muted);
          border-radius: var(--radius-md);
        }
        .gp-refresh-btn:hover, .gp-logout-btn:hover {
          color: var(--text-primary);
          background: var(--bg-elevated);
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .gp-spin { animation: spin-slow 0.8s linear infinite; }

        .gp-last-updated {
          max-width: 720px;
          margin: var(--space-2) auto 0;
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        /* ── Stats ── */
        .gp-stats-row {
          max-width: 720px;
          margin: var(--space-4) auto;
          padding: 0 var(--space-6);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-3);
        }

        .gp-stat {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          text-align: center;
        }
        .gp-stat svg { margin-bottom: 0.15rem; }
        .gp-stat-total { border-color: var(--color-lime-dim); }
        .gp-stat-done svg, .gp-stat-done { color: var(--color-lime); }
        .gp-stat-pending svg, .gp-stat-pending { color: var(--color-info); }

        .gp-stat-val {
          font-size: var(--text-xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          line-height: 1;
        }
        .gp-stat-lbl {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        /* ── Content ── */
        .gp-content {
          max-width: 720px;
          margin: 0 auto;
          padding: 0 var(--space-6);
        }

        /* ── Section ── */
        .gp-section { margin-bottom: var(--space-6); }

        .gp-section-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--color-lime);
          margin: 0 0 var(--space-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .gp-section-muted { color: var(--text-muted); }

        /* ── Cards (حجوزات مياه) ── */
        .gp-cards {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .gp-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          transition: border-color 0.2s;
        }
        .gp-card-done {
          border-color: rgba(200, 255, 62, 0.3);
          background: var(--color-lime-muted);
        }
        [data-theme="light"] .gp-card-done {
          border-color: rgba(74,124,0,.25);
          background: rgba(74,124,0,.05);
        }
        .gp-card-pending {
          border-color: rgba(74, 158, 191, 0.3);
        }

        .gp-card-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
          flex-wrap: wrap;
        }

        .gp-period-badge {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.2em 0.7em;
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }

        .gp-court-tag {
          background: var(--color-info-bg);
          border: 1px solid rgba(74, 158, 191, 0.25);
          border-radius: var(--radius-sm);
          padding: 0.2em 0.7em;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--color-info);
        }

        .gp-done-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--color-lime-muted);
          border: 1px solid rgba(200, 255, 62, 0.2);
          border-radius: var(--radius-full);
          padding: 0.15em 0.6em;
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          color: var(--color-lime);
          margin-right: auto;
        }
        [data-theme="light"] .gp-done-badge {
          background: rgba(74,124,0,.1);
          color: #2D5A00;
          border-color: rgba(74,124,0,.2);
        }

        .gp-customer-name {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }

        .gp-water-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
          flex-wrap: wrap;
        }

        .gp-water-icon { color: var(--color-info); flex-shrink: 0; }

        .gp-water-qty {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-info);
        }

        .gp-delivered-note {
          font-size: var(--text-xs);
          color: var(--color-lime);
          font-weight: var(--font-medium);
        }
        [data-theme="light"] .gp-delivered-note { color: #2D5A00; }

        .gp-deliver-btn {
          width: 100%;
          gap: var(--space-2);
          justify-content: center;
        }

        .gp-redo-btn {
          width: 100%;
          justify-content: center;
          font-size: var(--text-sm);
          color: var(--text-muted);
        }
        .gp-redo-btn:hover { color: var(--text-secondary); }

        /* ── List (حجوزات بدون مياه) ── */
        .gp-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .gp-list-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
        }

        .gp-period-sm {
          font-size: var(--text-xs);
          padding: 0.15em 0.5em;
        }
        .gp-court-sm {
          font-size: var(--text-xs);
          padding: 0.15em 0.5em;
        }

        .gp-list-name {
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        /* ── Empty ── */
        .gp-empty {
          text-align: center;
          padding: var(--space-12) var(--space-6);
          color: var(--text-muted);
        }
        .gp-empty-icon { margin: 0 auto var(--space-4); opacity: 0.3; }

        /* ── Overlay + Dialog ── */
        .gp-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg-overlay);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
        }

        .gp-dialog {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 380px;
          padding: var(--space-6);
        }

        .gp-dialog-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0 0 var(--space-4);
        }

        .gp-dialog-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-bottom: var(--space-5);
          padding: var(--space-3);
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
        }

        .gp-dialog-name {
          font-weight: var(--font-bold);
          color: var(--text-primary);
          font-size: var(--text-sm);
        }

        .gp-dialog-period {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .gp-dialog-field {
          margin-bottom: var(--space-4);
        }

        .gp-dialog-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }

        .gp-dialog-hint {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-regular);
        }

        .gp-qty-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .gp-qty-btn {
          width: 40px;
          height: 40px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .gp-qty-btn:hover {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
        }

        .gp-qty-input {
          flex: 1;
          text-align: center;
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
        }

        .gp-dialog-error {
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224, 85, 85, 0.25);
          border-right: 3px solid var(--color-danger);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
        }

        .gp-dialog-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
        }

        /* ── Responsive ── */
        @media (max-width: 540px) {
          .gp-header { padding: var(--space-3); }
          .gp-content, .gp-stats-row { padding: 0 var(--space-3); }
          .gp-stats-row { margin: var(--space-3) auto; }
          .gp-header-date { display: none; }
          .gp-online-badge { display: none; }
        }
      `}</style>
    </div>
  )
}
