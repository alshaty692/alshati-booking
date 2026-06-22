'use client'
// ============================================================
// صفحة الحجز — 5 خطوات (التاريخ+الملعب مدمجان في خطوة واحدة)
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import type { AvailableSlot, PriceCalculation } from '@/types'
import {
  CalendarDays, User, ClipboardCheck, CreditCard, CheckCircle2,
  ArrowLeft, ArrowRight, Dumbbell, BookOpen, Minus, Plus,
  Upload, Loader2, AlertTriangle, Lock, Droplets, Tag,
  PointerIcon, PartyPopper,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

// ── أنواع ────────────────────────────────────────────────────
interface BookingState {
  date: string
  court_id: string
  period_number: number
  customer_name: string
  code: string
  price: PriceCalculation | null
  water_quantity: number
}

// ── الخطوات الـ٤ ─────────────────────────────────────────────
const STEPS = [
  { label: 'الموعد',    Icon: CalendarDays  },
  { label: 'بياناتك',  Icon: User           },
  { label: 'المراجعة', Icon: ClipboardCheck },
  { label: 'الدفع',    Icon: CreditCard     },
]

const COURTS = ['football', 'volleyball', 'multi'] as const
const COURT_ICONS: Record<string, string> = { football:'⚽', volleyball:'🏐', multi:'🏀🏐' }

// ── الصفحة ───────────────────────────────────────────────────
export default function BookPage() {
  const router = useRouter()
  const datesRef = useRef<HTMLDivElement>(null)

  const [step,         setStep]        = useState(0)
  const [slots,        setSlots]       = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots]= useState(true)
  const [courtPrices,  setCourtPrices] = useState<Record<string,number>>({ football:0, volleyball:0, multi:0 })
  const [closureBanner,setClosure]     = useState<{active:boolean;msg:string;date:string}|null>(null)
  const [booking,      setBooking]     = useState<BookingState>({
    date:'', court_id:'', period_number:0, customer_name:'', code:'', price:null, water_quantity:0,
  })
  const [codeError,   setCodeError]   = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [bookingId,   setBookingId]   = useState('')
  const [uploadFile,  setUploadFile]  = useState<File|null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState('')
  const [settings,    setSettings]    = useState<Record<string,string>>({})
  const [isReturning, setIsReturning] = useState(false)
  const [holdExpiry,  setHoldExpiry]  = useState<string|null>(null)
  const [venueClosures, setVenueClosures] = useState<{court_id:string;start_date:string;end_date:string;reason:string}[]>([])
  const [slotTakenError, setSlotTakenError] = useState('')

  // ── حجز/تحرير مؤقت للفترة ──────────────────────────────────
  const holdSlot = useCallback(async (court_id: string, booking_date: string, period_number: number) => {
    try {
      const res = await fetch('/api/booking/hold-slot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ court_id, booking_date, period_number }),
      })
      const data = await res.json()
      if (res.ok && data.expires_at) setHoldExpiry(data.expires_at)
      return res.ok
    } catch { return false }
  }, [])

  const releaseSlot = useCallback(async () => {
    try {
      await fetch('/api/booking/release-slot', { method: 'POST' })
      setHoldExpiry(null)
    } catch { /* silent */ }
  }, [])

  // ── إعادة إنشاء hold (تجديد أو استعادة بعد انتهاء مدته) ─────
  const renewHold = useCallback(async (court_id: string, booking_date: string, period_number: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/booking/hold-slot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ court_id, booking_date, period_number }),
      })
      const data = await res.json()
      if (res.ok && data.expires_at) { setHoldExpiry(data.expires_at); return true }
      return false
    } catch { return false }
  }, [])

  // ── التحقق من التوافر الفعلي ─────────────────────────────────
  const verifySlotStillAvailable = useCallback(async (
    date: string, court_id: string, period_number: number
  ): Promise<boolean> => {
    try {
      const res  = await fetch('/api/booking/slots')
      const data = await res.json()
      const fresh = (data.slots ?? []) as AvailableSlot[]
      setSlots(fresh)
      const target = fresh.find(
        s => s.day_date === date && s.court_id === court_id && s.period_number === period_number
      )
      return target?.is_available === true
    } catch { return true }
  }, [])

  // ── تنظيف عند مغادرة الصفحة ────────────────────────────────
  useEffect(() => {
    return () => { fetch('/api/booking/release-slot', { method: 'POST' }).catch(() => {}) }
  }, [])

  // ── جلب البيانات ───────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/booking/slots').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/booking/prices').then(r => r.json()),
      fetch('/api/booking/lookup-customer', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(r => r.json()).catch(() => ({ found: false })),
    ]).then(([slotsData, settingsData, pricesData, customerData]) => {
      setSlots(slotsData.slots ?? [])
      const s = settingsData.settings ?? {}
      setSettings(s)
      if (pricesData.prices) setCourtPrices(pricesData.prices)
      if (s.closure_active === '1') {
        setClosure({ active:true, msg: s.closure_message ?? '', date: s.closure_return_date ?? '' })
      }
      if (customerData?.found && customerData.name) {
        setBooking(b => ({ ...b, customer_name: customerData.name }))
        setIsReturning(true)
      }
    }).finally(() => setLoadingSlots(false))

    fetch('/api/admin/venue-closures').then(r => r.ok ? r.json() : { closures: [] })
      .then(d => setVenueClosures(d.closures ?? []))
      .catch(() => {})
  }, [])

  const uniqueDates   = [...new Set(slots.map(s => s.day_date))].sort()
  const slotsForDate  = slots.filter(s => s.day_date === booking.date)
  const basePrice     = (courtId: string) => courtPrices[courtId] ?? 0

  // ── اسم الملعب من الإعدادات ─────────────────────────────────
  const courtName = (courtId: string): string => {
    const fromSettings: Record<string, string> = {
      football:   settings.venue_1_name ?? '',
      volleyball: settings.venue_2_name ?? '',
      multi:      settings.venue_3_name ?? '',
    }
    return fromSettings[courtId] || getCourtName(courtId)
  }
  const isSlotSelected = (courtId: string, period: number) =>
    booking.court_id === courtId && booking.period_number === period
  const canProceedStep0 = Boolean(booking.date && booking.court_id && booking.period_number)

  // ── حساب سعر المياه + مخزون ─────────────────────────────────
  const waterPrice = Number(settings.water_price_per_carton) || 20
  const waterStock = Number(settings.water_stock_available ?? '999')
  const waterMaxSetting = Number(settings.water_max_cartons) || 10
  const waterMax   = waterStock > 0 ? Math.min(waterMaxSetting, waterStock) : 0
  const waterTotal = booking.water_quantity * waterPrice

  // ── التحقق من إيقاف ملعب ────────────────────────────────────
  const isCourtClosed = (courtId: string, date: string) =>
    venueClosures.some(c => c.court_id === courtId && date >= c.start_date && date <= c.end_date)
  const getClosureReason = (courtId: string, date: string) =>
    venueClosures.find(c => c.court_id === courtId && date >= c.start_date && date <= c.end_date)?.reason ?? 'صيانة'

  // ── تعيين السعر عند الوصول لخطوة بياناتك ──────────────────
  useEffect(() => {
    if (step === 1 && booking.court_id && !booking.price) {
      setBooking(b => ({
        ...b, price: {
          base_price: basePrice(b.court_id),
          discount_amount: 0,
          final_price: basePrice(b.court_id),
        }
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── التحقق من الكود ─────────────────────────────────────────
  async function validateCode() {
    if (!booking.code.trim()) {
      setBooking(b => ({ ...b, price: { base_price:basePrice(b.court_id), discount_amount:0, final_price:basePrice(b.court_id) } }))
      return
    }
    setCodeLoading(true); setCodeError('')
    try {
      const res  = await fetch('/api/booking/validate-code', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ court_id:booking.court_id, code:booking.code.toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setCodeError(data.error ?? 'كود غير صالح'); return }
      setBooking(b => ({ ...b, price: data }))
    } catch { setCodeError('خطأ في التحقق') }
    finally { setCodeLoading(false) }
  }

  // ── إنشاء الحجز ────────────────────────────────────────────
  async function createBooking() {
    setCreating(true); setError('')
    try {
      const holdOk = await renewHold(booking.court_id, booking.date, booking.period_number)
      if (!holdOk) {
        setError('عذراً، هذه الفترة أُخذت للتو من عميل آخر. يرجى العودة واختيار فترة أخرى.')
        setCreating(false)
        return
      }
      const res  = await fetch('/api/booking/create', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          booking_date: booking.date, court_id: booking.court_id,
          period_number: booking.period_number, customer_name: booking.customer_name,
          code_used: booking.code.toUpperCase() || undefined,
          water_quantity: booking.water_quantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setBookingId(data.booking_id)
      setStep(3)
    } finally { setCreating(false) }
  }

  // ── رفع الإيصال ─────────────────────────────────────────────
  async function uploadReceipt() {
    if (!uploadFile || !bookingId) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('receipt', uploadFile)
      fd.append('booking_id', bookingId)
      const res  = await fetch('/api/booking/upload-receipt', { method:'POST', body:fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setStep(4)
    } finally { setUploading(false) }
  }

  // ── إعادة ضبط ──────────────────────────────────────────────
  function resetBooking() {
    releaseSlot()
    setStep(0)
    setBooking({ date:'', court_id:'', period_number:0, customer_name:'', code:'', price:null, water_quantity:0 })
    setBookingId(''); setUploadFile(null); setError(''); setCodeError(''); setSlotTakenError('')
  }

  return (
    <div className="book-page">

      {/* ── شاشة التحميل ── */}
      {loadingSlots && (
        <div className="book-loading-screen">
          <Loader2 size={36} strokeWidth={1.75} className="book-loading-spinner" />
          <p className="book-loading-text">جاري تحميل المواعيد...</p>
        </div>
      )}

      {/* ── هيدر ── */}
      <header className="book-header">
        <div className="book-header-inner">
          <div className="book-header-logo">
            <Dumbbell size={18} strokeWidth={1.75} className="book-header-icon" />
            مركز حي الشاطئ
          </div>
          <div className="book-header-actions">
            <button className="book-header-btn" onClick={() => router.push('/my-bookings')}>
              <BookOpen size={14} strokeWidth={2} />
              حجوزاتي
            </button>
            <ThemeToggle className="book-theme-toggle" />
          </div>
        </div>
      </header>

      {/* ── بانر الإغلاق ── */}
      {closureBanner?.active && (
        <div className="closure-banner">
          <div className="closure-banner-inner">
            <Lock size={20} strokeWidth={2} className="closure-icon" />
            <div>
              <div className="closure-msg">{closureBanner.msg || 'المركز مغلق مؤقتاً'}</div>
              {closureBanner.date && (
                <div className="closure-date">موعد العودة: {closureBanner.date}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Progress Bar Stepper ── */}
      {step < 4 && (
        <div className="book-progress-wrap">
          <div className="book-progress-bar">
            <div
              className="book-progress-fill"
              style={{ width: `${(step + 1) * 25}%` }}
            />
          </div>
          <div className="book-progress-label">
            <span className="book-progress-step">الخطوة {step + 1} من 4</span>
            <span className="book-progress-name">{STEPS[step]?.label ?? ''}</span>
          </div>
        </div>
      )}

      {/* ── شريط الاختيار اللحظي ── */}
      {step === 0 && canProceedStep0 && (
        <div className="live-summary-bar">
          <div className="live-summary-inner">
            <CalendarDays size={13} strokeWidth={2} />
            <span>{formatDate(booking.date)}</span>
            <span className="live-sep">·</span>
            <span>{COURT_ICONS[booking.court_id]} {courtName(booking.court_id)}</span>
            <span className="live-sep">·</span>
            <span>{getPeriodName(booking.period_number)}</span>
            {basePrice(booking.court_id) > 0 && (
              <>
                <span className="live-sep">·</span>
                <strong className="live-price">{formatAmount(basePrice(booking.court_id))}</strong>
              </>
            )}
          </div>
          <button className="live-summary-btn" onClick={() => setStep(1)}>
            التالي
            <ArrowLeft size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <main className="book-main">

        {/* ========== الخطوة 0: الموعد ========== */}
        {step === 0 && !closureBanner?.active && (
          <div className="book-step animate-slide-up">

            {/* أزرار الأيام */}
            <div className="dates-scroll-wrap" ref={datesRef}>
              <div className="dates-scroll">
                {uniqueDates.map(date => {
                  const hasAvail = slots.some(s => s.day_date === date && s.is_available)
                  const d        = new Date(date + 'T00:00:00')
                  const isSelected = booking.date === date
                  return (
                    <button
                      key={date}
                      id={`date-${date}`}
                      className={`date-pill ${isSelected?'selected':''} ${!hasAvail?'disabled':''}`}
                      onClick={() => {
                        if (!hasAvail) return
                        setBooking(b => ({ ...b, date, court_id:'', period_number:0 }))
                      }}
                      disabled={!hasAvail}
                    >
                      <span className="date-pill-day">{d.toLocaleDateString('ar-SA',{weekday:'long'})}</span>
                      <span className="date-pill-num">{d.getDate()}</span>
                      <span className="date-pill-month">{d.toLocaleDateString('ar-SA',{month:'long'})}</span>
                      {!hasAvail && <span className="date-pill-full">مكتمل</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* الملاعب والفترات */}
            {!booking.date ? (
              <div className="date-hint">
                <div className="date-hint-icon">
                  <PointerIcon size={28} strokeWidth={1.5} />
                </div>
                <p>اختر يوماً أولاً لرؤية المواعيد المتاحة</p>
              </div>
            ) : (
              <div className="courts-grid animate-fade-in">
                {COURTS.map(courtId => {
                  const courtSlots = slotsForDate.filter(s => s.court_id === courtId)
                  const closed = isCourtClosed(courtId, booking.date)
                  return (
                    <div key={courtId} className={`court-col ${closed ? 'court-col-closed' : ''}`}>
                      {/* عنوان الملعب */}
                      <div className="court-col-head">
                        <span className="court-col-icon">{COURT_ICONS[courtId]}</span>
                        <span className="court-col-name">{courtName(courtId)}</span>
                        {!closed && basePrice(courtId) > 0 && (
                          <span className="court-col-price">{formatAmount(basePrice(courtId))}</span>
                        )}
                        {closed && (
                          <span className="court-col-closed-tag">موقوف</span>
                        )}
                      </div>

                      {/* الفترات */}
                      {closed ? (
                        <div className="court-col-unavail">تحت الصيانة</div>
                      ) : courtSlots.length === 0 ? (
                        <div className="court-col-unavail">لا فترات</div>
                      ) : (
                        <div className="court-col-periods">
                          {[...courtSlots].sort((a,b) => a.period_number - b.period_number).map(slot => {
                            const sel    = isSlotSelected(courtId, slot.period_number)
                            const isHeld = (slot as AvailableSlot & { is_held?: boolean }).is_held
                            const status = !slot.is_available ? (isHeld ? 'held' : 'booked') : sel ? 'selected' : 'available'
                            return (
                              <button
                                key={slot.period_number}
                                id={`slot-${courtId}-${slot.period_number}`}
                                className={`court-period-btn court-period-${status}`}
                                disabled={!slot.is_available}
                                onClick={async () => {
                                  if (!slot.is_available) return
                                  const ok = await holdSlot(courtId, booking.date, slot.period_number)
                                  if (!ok) {
                                    const res = await fetch('/api/booking/slots')
                                    const data = await res.json()
                                    setSlots(data.slots ?? [])
                                    return
                                  }
                                  setBooking(b => ({
                                    ...b,
                                    court_id: courtId,
                                    period_number: slot.period_number,
                                    price: null,
                                  }))
                                }}
                              >
                                <span className="cpb-time">{getPeriodName(slot.period_number)}</span>
                                <span className="cpb-dot" />
                                <span className="cpb-state">
                                  {status==='held'    ? 'قيد الحجز' :
                                   status==='booked'  ? 'محجوز' :
                                   status==='selected'? '✓ مختار' : 'متاح'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {canProceedStep0 && (
              <button
                id="btn-step0-next"
                className="btn-step-next"
                onClick={() => setStep(1)}
              >
                التالي — بياناتك
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {/* بانر الإغلاق بدل الملاعب */}
        {step === 0 && closureBanner?.active && (
          <div className="book-step">
            <div className="closure-card">
              <div className="closure-card-icon"><Lock size={36} strokeWidth={1.5} /></div>
              <h2>المركز مغلق مؤقتاً</h2>
              <p>{closureBanner.msg || 'نأسف للإزعاج، سنعود قريباً'}</p>
              {closureBanner.date && <p>موعد العودة: <strong>{closureBanner.date}</strong></p>}
            </div>
          </div>
        )}

        {/* ========== الخطوة 1: بياناتك ========== */}
        {step === 1 && (
          <div className="book-step animate-slide-up">
            <button className="step-back" onClick={() => { releaseSlot(); setStep(0) }}>
              <ArrowRight size={15} strokeWidth={2} />
              رجوع
            </button>
            <h2 className="step-title">بيانات الحجز</h2>

            {/* ملخص مصغّر */}
            <div className="selection-summary">
              <div className="selection-chip">
                <CalendarDays size={13} strokeWidth={2} />
                {formatDate(booking.date)}
              </div>
              <div className="selection-chip">
                <span>{COURT_ICONS[booking.court_id]}</span>
                {courtName(booking.court_id)}
              </div>
              <div className="selection-chip">
                <CheckCircle2 size={13} strokeWidth={2} />
                {getPeriodName(booking.period_number)}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="customer-name">
                <User size={14} strokeWidth={2} />
                اسمك الكريم
              </label>
              {isReturning ? (
                <div className="returning-welcome">
                  <div className="returning-card">
                    <span className="returning-emoji">👋</span>
                    <span className="returning-name">مرحباً بعودتك يا {booking.customer_name}!</span>
                  </div>
                  <button
                    type="button"
                    className="returning-edit-btn"
                    onClick={() => setIsReturning(false)}
                  >
                    تعديل الاسم
                  </button>
                </div>
              ) : (
                <div className="field-wrap">
                  <User size={16} strokeWidth={1.75} className="field-icon" />
                  <input
                    id="customer-name" type="text" className="bk-input"
                    placeholder="أدخل اسمك الكريم"
                    value={booking.customer_name}
                    onChange={e => setBooking(b => ({ ...b, customer_name: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="discount-code">
                <Tag size={14} strokeWidth={2} />
                كود الخصم (اختياري)
              </label>
              <div className="code-row">
                <div className="field-wrap" style={{ flex: 1 }}>
                  <Tag size={16} strokeWidth={1.75} className="field-icon" />
                  <input
                    id="discount-code" type="text" className="bk-input"
                    placeholder="SUMMER25"
                    value={booking.code}
                    onChange={e => { setBooking(b => ({ ...b, code:e.target.value.toUpperCase(), price:null })); setCodeError('') }}
                    dir="ltr"
                  />
                </div>
                <button
                  id="btn-validate-code" type="button" className="btn-validate-code"
                  onClick={validateCode} disabled={codeLoading}
                >
                  {codeLoading ? <Loader2 size={14} strokeWidth={2} className="bk-spin" /> : 'تحقق'}
                </button>
              </div>
              {codeError && (
                <div className="bk-error" style={{ marginTop:'0.5rem' }}>
                  <AlertTriangle size={13} strokeWidth={2} />
                  {codeError}
                </div>
              )}
            </div>

            {/* ── قسم المياه ── */}
            <div className="form-group">
              <label>
                <Droplets size={14} strokeWidth={2} />
                كراتين مياه 💧 (اختياري)
              </label>
              {waterStock <= 0 ? (
                <p className="water-unavailable">المياه غير متوفرة حالياً</p>
              ) : (
                <>
                  <p className="water-hint">
                    كل كرتون {formatAmount(waterPrice)}
                    {waterStock <= 10 && <span className="water-low"> (متبقي {waterStock} كرتون)</span>}
                  </p>
                  <div className="water-counter">
                    <button
                      type="button" className="water-btn"
                      disabled={booking.water_quantity <= 0}
                      onClick={() => setBooking(b => ({ ...b, water_quantity: Math.max(0, b.water_quantity - 1) }))}
                    >
                      <Minus size={16} strokeWidth={2.5} />
                    </button>
                    <span className="water-qty">{booking.water_quantity}</span>
                    <button
                      type="button" className="water-btn"
                      disabled={booking.water_quantity >= waterMax}
                      onClick={() => setBooking(b => ({ ...b, water_quantity: Math.min(waterMax, b.water_quantity + 1) }))}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                    {booking.water_quantity > 0 && (
                      <span className="water-total">= {formatAmount(waterTotal)}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {booking.price && (
              <div className="price-box animate-fade-in">
                <div className="price-row">
                  <span>السعر الأصلي</span>
                  <span>{formatAmount(booking.price.base_price)}</span>
                </div>
                {booking.price.discount_amount > 0 && (
                  <div className="price-row discount">
                    <span>الخصم 🎉</span>
                    <span>- {formatAmount(booking.price.discount_amount)}</span>
                  </div>
                )}
                {booking.water_quantity > 0 && (
                  <div className="price-row">
                    <span>💧 مياه ({booking.water_quantity} كرتون)</span>
                    <span>{formatAmount(waterTotal)}</span>
                  </div>
                )}
                <div className="price-row total">
                  <span>الإجمالي</span>
                  <strong>{formatAmount((booking.price.final_price ?? 0) + waterTotal)}</strong>
                </div>
              </div>
            )}

            <button
              id="btn-to-review"
              className="btn-step-next"
              style={{ marginTop:'1.5rem' }}
              disabled={!booking.customer_name.trim() || !booking.price}
              onClick={() => setStep(2)}
            >
              مراجعة الحجز
              <ArrowLeft size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* ========== الخطوة 2: المراجعة ========== */}
        {step === 2 && (
          <div className="book-step animate-slide-up">
            <button className="step-back" onClick={() => setStep(1)}>
              <ArrowRight size={15} strokeWidth={2} />
              رجوع
            </button>
            <h2 className="step-title">مراجعة الحجز</h2>
            <p className="step-desc">تأكد من البيانات قبل الدفع</p>

            {slotTakenError && (
              <div className="slot-taken-alert">
                <AlertTriangle size={20} strokeWidth={2} className="slot-taken-icon" />
                <div>
                  <strong>الفترة لم تعد متاحة</strong>
                  <p style={{ margin:'0.25rem 0 0', fontSize:'0.85rem' }}>{slotTakenError}</p>
                </div>
                <button
                  className="slot-taken-btn"
                  onClick={() => { setSlotTakenError(''); setBooking(b => ({ ...b, court_id:'', period_number:0, price:null })); setStep(0) }}
                >
                  اختر فترة أخرى
                </button>
              </div>
            )}

            <div className="review-card">
              {[
                ['التاريخ',   formatDate(booking.date)],
                ['الملعب',    courtName(booking.court_id)],
                ['الفترة',    getPeriodName(booking.period_number)],
                ['الاسم',     booking.customer_name],
                ...(booking.code ? [['الكود', booking.code]] : []),
                ...(booking.water_quantity > 0 ? [['💧 مياه', `${booking.water_quantity} كرتون (${formatAmount(waterTotal)})`]] : []),
              ].map(([label,value]) => (
                <div key={label} className="review-row">
                  <span className="review-label">{label}</span>
                  <span style={{ fontWeight:600 }}>{value}</span>
                </div>
              ))}
              <div className="review-row total-row">
                <span className="review-label">المبلغ المطلوب</span>
                <strong className="review-total">{formatAmount((booking.price?.final_price ?? 0) + waterTotal)}</strong>
              </div>
            </div>

            {error && (
              <div className="bk-error bk-error-bar">
                <AlertTriangle size={14} strokeWidth={2} />
                {error}
              </div>
            )}

            <button
              id="btn-confirm-booking"
              className="btn-step-next"
              style={{ marginTop:'1.5rem' }}
              disabled={creating || !!slotTakenError}
              onClick={async () => {
                setCreating(true)
                const still = await verifySlotStillAvailable(booking.date, booking.court_id, booking.period_number)
                if (!still) {
                  setSlotTakenError('هذه الفترة أُخذت من عميل آخر خلال تصفحك. اختر فترة أخرى من نفس اليوم أو يوم مختلف.')
                  setCreating(false)
                  return
                }
                await createBooking()
              }}
            >
              {creating
                ? <><Loader2 size={16} strokeWidth={2} className="bk-spin" />جاري التحقق...</>
                : <>تأكيد وانتقل للدفع<ArrowLeft size={16} strokeWidth={2.5} /></>
              }
            </button>
          </div>
        )}

        {/* ========== الخطوة 3: الدفع ========== */}
        {step === 3 && (
          <div className="book-step animate-slide-up">
            <h2 className="step-title">ادفع بالتحويل البنكي</h2>
            <p className="step-desc">حوّل المبلغ ثم ارفع صورة الإيصال</p>

            <div className="bank-card">
              <div className="bank-amount">{formatAmount((booking.price?.final_price ?? 0) + waterTotal)}</div>
              {[
                ['البنك',         settings.bank_name || '—'],
                ['اسم الحساب',   settings.bank_account_name || '—'],
                ['رقم الآيبان',  settings.bank_iban || '—'],
                ['رقم الحساب',   settings.bank_account_number || '—'],
              ].map(([label,value]) => (
                <div key={label} className="bank-detail">
                  <span>{label}</span>
                  <strong className="bank-value">{value}</strong>
                </div>
              ))}
            </div>

            <div className="upload-section">
              <h3>
                <Upload size={16} strokeWidth={2} />
                ارفع صورة الإيصال
              </h3>
              <div className="upload-area" onClick={() => document.getElementById('receipt-file')?.click()}>
                {uploadFile ? (
                  <div className="upload-selected">
                    <Upload size={18} strokeWidth={1.75} className="upload-file-icon" />
                    <span>{uploadFile.name}</span>
                    <span className="upload-size">({(uploadFile.size/1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <div className="upload-icon-wrap">
                      <Upload size={28} strokeWidth={1.5} />
                    </div>
                    <p>اضغط لاختيار صورة الإيصال</p>
                    <small>JPG, PNG, PDF — حد 5MB</small>
                  </div>
                )}
              </div>
              <input
                id="receipt-file" type="file" accept="image/*,application/pdf"
                style={{ display:'none' }} onChange={e => setUploadFile(e.target.files?.[0]??null)}
              />
              {error && (
                <div className="bk-error bk-error-bar">
                  <AlertTriangle size={14} strokeWidth={2} />
                  {error}
                </div>
              )}
              <button
                id="btn-upload-receipt"
                className="btn-step-next"
                style={{ marginTop:'1rem' }}
                disabled={!uploadFile||uploading}
                onClick={uploadReceipt}
              >
                {uploading
                  ? <><Loader2 size={16} strokeWidth={2} className="bk-spin" />جاري الرفع...</>
                  : <>رفع الإيصال<ArrowLeft size={16} strokeWidth={2.5} /></>
                }
              </button>
            </div>
          </div>
        )}

        {/* ========== الخطوة 4: النجاح ========== */}
        {step === 4 && (
          <div className="book-step success-step animate-slide-up">
            <div className="success-icon-wrap">
              <PartyPopper size={40} strokeWidth={1.5} />
            </div>
            <h2 className="success-title">تم استلام حجزك!</h2>
            <p className="success-desc">سيتم مراجعة الإيصال وتأكيد الحجز خلال فترة وجيزة</p>
            <div className="review-card" style={{ margin:'1.5rem 0' }}>
              <div className="review-row"><span className="review-label">التاريخ</span><span>{formatDate(booking.date)}</span></div>
              <div className="review-row"><span className="review-label">الملعب</span><span>{courtName(booking.court_id)}</span></div>
              <div className="review-row"><span className="review-label">الفترة</span><span>{getPeriodName(booking.period_number)}</span></div>
            </div>
            <button id="btn-new-booking" className="btn-step-next" onClick={resetBooking}>
              <CalendarDays size={16} strokeWidth={2} />
              حجز جديد
            </button>
            <button
              id="btn-my-bookings"
              className="btn-step-secondary"
              style={{ marginTop:'0.75rem' }}
              onClick={() => router.push('/my-bookings')}
            >
              <BookOpen size={16} strokeWidth={2} />
              عرض حجوزاتي
            </button>
          </div>
        )}
      </main>

      {/* ======================================================
          CSS
         ====================================================== */}
      <style>{`
        * { box-sizing: border-box; }

        /* ── الصفحة ── */
        .book-page {
          min-height: 100vh;
          background: var(--bg-base);
          font-family: 'Tajawal','IBM Plex Sans Arabic',sans-serif;
        }

        /* ── شاشة التحميل ── */
        .book-loading-screen {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: var(--bg-base);
          z-index: 9999;
        }
        .book-loading-spinner {
          color: var(--color-lime);
          animation: bk-spin 0.75s linear infinite;
        }
        .book-loading-text {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        /* ── هيدر ── */
        .book-header {
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-sidebar);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .book-header-inner {
          max-width: 720px;
          margin-inline: auto;
          padding: 0.875rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .book-header-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 800;
          font-size: 1rem;
          color: var(--text-primary);
        }
        .book-header-icon { color: var(--color-lime); }
        .book-header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .book-header-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: transparent;
          border: 1px solid var(--border-sidebar);
          color: var(--text-muted);
          border-radius: var(--radius-md);
          padding: 0.35rem 0.75rem;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .book-header-btn:hover { border-color: var(--color-lime-dim); color: var(--color-lime); }
        .book-theme-toggle {
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
        .book-theme-toggle:hover { background: var(--bg-elevated); color: var(--color-lime); }

        /* ── بانر الإغلاق ── */
        .closure-banner {
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border-color);
          padding: 0.875rem 1.25rem;
        }
        .closure-banner-inner {
          max-width: 720px;
          margin-inline: auto;
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }
        .closure-icon { color: var(--color-warning); flex-shrink: 0; }
        .closure-msg  { font-weight: 700; color: var(--text-primary); font-size: 0.95rem; }
        .closure-date { color: var(--color-lime); font-size: 0.8rem; margin-top: 0.15rem; }

        /* ── Progress Bar ── */
        .book-progress-wrap {
          background: var(--bg-sidebar);
          padding: 0.75rem 1.25rem 0.625rem;
          border-bottom: 1px solid var(--border-sidebar);
        }
        .book-progress-bar {
          height: 4px;
          background: var(--bg-elevated);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }
        .book-progress-fill {
          height: 100%;
          background: var(--color-lime);
          border-radius: 99px;
          transition: width 0.4s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 0 8px var(--color-lime-glow);
        }
        .book-progress-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .book-progress-step {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .book-progress-name {
          font-size: 0.8rem;
          color: var(--color-lime);
          font-weight: 700;
        }

        /* ── شريط الاختيار اللحظي ── */
        .live-summary-bar {
          background: var(--bg-sidebar);
          border-bottom: 2px solid var(--color-lime-dim);
          padding: 0.5rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .live-summary-inner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          color: var(--text-secondary);
          font-size: 0.82rem;
        }
        .live-sep { color: var(--text-muted); }
        .live-price { color: var(--color-lime); font-weight: 800; }
        .live-summary-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: var(--color-lime);
          color: #0a1a0a;
          border: none;
          border-radius: var(--radius-md);
          padding: 0.4rem 0.875rem;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          font-family: 'Tajawal',sans-serif;
          transition: opacity 0.15s;
        }
        .live-summary-btn:hover { opacity: 0.88; }

        /* ── المحتوى ── */
        .book-main {
          display: block;
          width: 100%;
          max-width: 720px;
          margin-inline: auto;
          padding: 1.25rem 1rem 5rem;
        }
        .book-step { animation: bk-slide-up 0.3s ease; }
        .step-title {
          font-size: 1.4rem;
          margin-bottom: 0.4rem;
          color: var(--text-primary);
          font-weight: 800;
        }
        .step-desc  { color: var(--text-muted); margin-bottom: 1.25rem; font-size: 0.9rem; }
        .step-back  {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background: none;
          border: none;
          color: var(--color-lime);
          font-size: 0.875rem;
          font-family: inherit;
          cursor: pointer;
          padding: 0;
          margin-bottom: 1rem;
          font-weight: 700;
          transition: opacity 0.15s;
        }
        .step-back:hover { opacity: 0.7; }

        /* ── أزرار الأيام ── */
        .dates-scroll-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 0 -1rem 1.5rem;
          padding: 0 1rem;
          scrollbar-width: none;
        }
        .dates-scroll-wrap::-webkit-scrollbar { display: none; }
        .dates-scroll {
          display: flex;
          gap: 0.625rem;
          padding-bottom: 0.5rem;
          width: max-content;
        }

        .date-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          padding: 0.75rem 0.625rem;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          cursor: pointer;
          min-width: 80px;
          transition: all 0.18s ease;
          font-family: 'Tajawal',sans-serif;
          position: relative;
        }
        .date-pill:hover:not(:disabled) {
          border-color: var(--color-lime-dim);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--color-lime-glow);
        }
        .date-pill.selected {
          border-color: var(--color-lime);
          background: var(--color-lime-muted);
          box-shadow: 0 0 0 2px var(--color-lime-glow);
        }
        .date-pill.disabled { opacity: 0.35; cursor: not-allowed; }
        .date-pill-day   { font-size: 0.72rem; color: var(--text-muted); font-weight: 700; white-space: nowrap; }
        .date-pill-num   { font-size: 1.9rem; font-weight: 900; line-height: 1.05; color: var(--text-primary); }
        .date-pill-month { font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; white-space: nowrap; }
        .date-pill-full  { position: absolute; bottom: 0.25rem; font-size: 0.6rem; color: var(--color-danger); font-weight: 700; }
        .date-pill.selected .date-pill-day   { color: var(--color-lime); }
        .date-pill.selected .date-pill-num   { color: var(--color-lime); }
        .date-pill.selected .date-pill-month { color: var(--color-lime); }

        /* ── كمبيوتر: عرض كامل ── */
        @media (min-width: 1024px) {
          .book-main {
            max-width: none;
            padding: 1.5rem 10vw 5rem;
          }
          .book-header-inner {
            max-width: none;
            padding: 0.875rem 10vw;
          }
          .closure-banner-inner {
            max-width: none;
            padding: 0.875rem 10vw;
          }
          .book-progress-wrap {
            padding: 0.75rem 10vw 0.625rem;
          }
          .live-summary-bar {
            padding: 0.5rem 10vw;
          }
          .dates-scroll-wrap {
            overflow-x: visible;
            margin: 0 0 1.5rem;
            padding: 0;
          }
          .dates-scroll {
            width: 100%;
            flex-wrap: nowrap;
          }
          .date-pill {
            flex: 1;
            min-width: 0;
          }
          .courts-grid { gap: 0.75rem; }
          .court-col   { padding: 0.875rem 0.75rem; }
        }

        /* ── تلميح اختر يوماً ── */
        .date-hint {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .date-hint-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.75rem;
          width: 56px;
          height: 56px;
          border-radius: var(--radius-xl);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--color-lime);
        }
        .date-hint p { margin: 0; }

        /* ── شبكة الملاعب (3 أعمدة) ── */
        .courts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .court-col {
          background: var(--bg-surface);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 0.625rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: border-color 0.15s;
        }
        .court-col-closed {
          opacity: 0.55;
          background: var(--bg-elevated);
        }
        .court-col-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          text-align: center;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
        }
        .court-col-icon  { font-size: 1.5rem; line-height: 1; }
        .court-col-name  { font-size: 0.72rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
        .court-col-price {
          font-size: 0.65rem;
          color: var(--text-muted);
          background: var(--bg-elevated);
          padding: 0.1rem 0.4rem;
          border-radius: 99px;
          white-space: nowrap;
        }
        .court-col-closed-tag {
          font-size: 0.6rem;
          color: var(--color-danger);
          font-weight: 700;
          background: var(--color-danger-bg);
          padding: 0.1rem 0.35rem;
          border-radius: 99px;
        }
        .court-col-unavail {
          font-size: 0.68rem;
          color: var(--text-muted);
          text-align: center;
          padding: 0.5rem 0;
          font-style: italic;
        }

        /* ── أزرار الفترة ── */
        .court-col-periods {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .court-period-btn {
          width: 100%;
          padding: 0.45rem 0.25rem;
          border-radius: var(--radius-md);
          border: 1.5px solid transparent;
          cursor: pointer;
          font-family: 'Tajawal',sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          transition: all 0.15s ease;
        }
        .cpb-time  { font-size: 0.7rem; font-weight: 800; line-height: 1; }
        .cpb-dot   { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .cpb-state { font-size: 0.58rem; font-weight: 600; }

        /* متاح */
        .court-period-available {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
        }
        .court-period-available .cpb-dot   { background: var(--color-lime); }
        .court-period-available .cpb-state { color: var(--color-lime); }
        .court-period-available:hover {
          border-color: var(--color-lime);
          transform: translateY(-1px);
          box-shadow: 0 3px 8px var(--color-lime-glow);
        }

        /* مختار */
        .court-period-selected {
          background: var(--color-lime);
          border-color: var(--color-lime);
          color: #0a1a0a;
          box-shadow: 0 3px 10px var(--color-lime-glow);
        }
        .court-period-selected .cpb-dot   { background: #0a1a0a; }
        .court-period-selected .cpb-state { color: #0a1a0a; font-weight: 900; }
        .court-period-selected:hover { transform: translateY(-1px); }

        /* محجوز / قيد الحجز */
        .court-period-booked,
        .court-period-held {
          background: var(--bg-elevated);
          border-color: var(--border-color);
          color: var(--text-muted);
          opacity: 0.5;
          cursor: not-allowed;
        }
        .court-period-held {
          opacity: 0.65;
          border-color: rgba(234,179,8,.3);
          background: rgba(234,179,8,.06);
          color: #ca8a04;
        }
        .court-period-booked .cpb-dot  { background: var(--text-muted); }
        .court-period-held   .cpb-dot  { background: #ca8a04; }
        .court-period-booked .cpb-state { color: var(--text-muted); }
        .court-period-held   .cpb-state { color: #ca8a04; }

        /* ── زر التالي (الرئيسي) ── */
        .btn-step-next {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          width: 100%;
          padding: 0.875rem 1.5rem;
          background: var(--color-lime);
          color: #0a1a0a;
          border: none;
          border-radius: var(--radius-lg);
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          font-family: 'Tajawal',sans-serif;
          transition: opacity 0.18s, transform 0.1s, box-shadow 0.18s;
          box-shadow: 0 4px 16px var(--color-lime-glow);
        }
        .btn-step-next:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px var(--color-lime-glow);
        }
        .btn-step-next:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* ── زر ثانوي (عرض حجوزاتي) ── */
        .btn-step-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          width: 100%;
          padding: 0.75rem 1.5rem;
          background: transparent;
          color: var(--text-muted);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-lg);
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Tajawal',sans-serif;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .btn-step-secondary:hover {
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
          background: var(--color-lime-muted);
        }

        /* ── ملخص الاختيارات ── */
        .selection-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .selection-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 99px;
          padding: 0.35rem 0.875rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        /* ── حقول الإدخال ── */
        .form-group { margin-bottom: 1.25rem; }
        .form-group label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }
        .field-wrap { position: relative; }
        .field-icon {
          position: absolute;
          top: 50%;
          right: var(--space-3);
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .bk-input {
          width: 100%;
          height: 44px;
          padding: 0 var(--space-3);
          padding-right: calc(var(--space-3) + 16px + var(--space-2));
          background: var(--bg-elevated);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-base);
          font-family: 'Tajawal','IBM Plex Sans Arabic',sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .bk-input:focus {
          border-color: var(--color-lime-dim);
          box-shadow: 0 0 0 3px var(--color-lime-glow);
        }

        /* ── صف الكود ── */
        .code-row {
          display: flex;
          gap: 0.5rem;
        }
        .btn-validate-code {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          height: 44px;
          padding: 0 1rem;
          background: var(--bg-elevated);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          font-family: 'Tajawal',sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s, color 0.15s;
        }
        .btn-validate-code:hover:not(:disabled) {
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
        }
        .btn-validate-code:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── العميل العائد ── */
        .returning-card {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-lg);
          margin-bottom: 0.5rem;
        }
        .returning-emoji { font-size: 1.3rem; }
        .returning-name  { font-weight: 700; color: var(--color-lime); }
        .returning-edit-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          text-decoration: underline;
          font-family: inherit;
          padding: 0;
        }
        .returning-edit-btn:hover { color: var(--text-primary); }

        /* ── المياه ── */
        .water-unavailable {
          font-size: 0.85rem;
          color: var(--color-danger);
          margin: 0.25rem 0 0;
          font-weight: 600;
        }
        .water-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0 0 0.5rem;
        }
        .water-low {
          color: var(--color-warning);
          margin-right: 0.5rem;
          font-weight: 700;
        }
        .water-counter {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .water-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1.5px solid var(--border-color);
          background: var(--bg-elevated);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .water-btn:hover:not(:disabled) {
          border-color: var(--color-lime-dim);
          background: var(--color-lime-muted);
          color: var(--color-lime);
        }
        .water-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .water-qty {
          font-size: 1.4rem;
          font-weight: 800;
          min-width: 2rem;
          text-align: center;
          color: var(--text-primary);
        }
        .water-total {
          font-size: 0.85rem;
          color: var(--color-lime);
          font-weight: 700;
        }

        /* ── صندوق السعر ── */
        .price-box {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .price-row { display: flex; justify-content: space-between; font-size: 0.95rem; color: var(--text-primary); }
        .price-row.discount { color: var(--color-lime); }
        .price-row.total {
          font-size: 1.1rem;
          border-top: 1px solid var(--border-color);
          padding-top: 0.5rem;
          margin-top: 0.25rem;
          color: var(--text-primary);
        }
        .price-row.total strong { color: var(--color-lime); font-size: 1.2rem; }

        /* ── المراجعة ── */
        .review-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .review-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 0.95rem;
          color: var(--text-primary);
        }
        .review-row:last-child { border-bottom: none; }
        .review-label { color: var(--text-muted); font-size: 0.875rem; }
        .total-row {
          background: var(--color-lime-muted);
          border-top: 1px solid var(--color-lime-dim) !important;
          padding: 1rem 1.25rem !important;
        }
        .review-total { font-size: 1.5rem; color: var(--color-lime); font-weight: 800; }

        /* ── تنبيه الفترة المأخوذة ── */
        .slot-taken-alert {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background: rgba(234,179,8,.08);
          border: 1.5px solid rgba(234,179,8,.4);
          border-radius: var(--radius-lg);
          padding: 0.875rem 1rem;
          margin-bottom: 1rem;
        }
        .slot-taken-icon { color: var(--color-warning); flex-shrink: 0; margin-top: 1px; }
        .slot-taken-alert > div { flex: 1; }
        .slot-taken-alert strong { display: block; color: #92400e; font-size: 0.9rem; }
        .slot-taken-btn {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: var(--radius-md);
          padding: 0.35rem 0.75rem;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          align-self: flex-start;
          transition: border-color 0.15s;
        }
        .slot-taken-btn:hover { border-color: var(--color-lime-dim); }

        /* ── البنك ── */
        .bank-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .bank-amount {
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--color-lime);
          margin-bottom: 1.25rem;
          text-shadow: 0 0 20px var(--color-lime-glow);
        }
        .bank-detail {
          display: flex;
          justify-content: space-between;
          padding: 0.6rem 0;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 0.9rem;
          color: var(--text-primary);
          text-align: right;
        }
        .bank-detail:last-child { border-bottom: none; }
        .bank-value { font-family: monospace; font-size: 0.85rem; color: var(--text-secondary); }

        /* ── رفع الإيصال ── */
        .upload-section {
          background: var(--bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
          padding: 1.25rem;
        }
        .upload-section h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 1rem;
          font-size: 1rem;
          color: var(--text-primary);
          font-weight: 800;
        }
        .upload-area {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-lg);
          padding: 2rem 1rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.18s, background 0.18s;
        }
        .upload-area:hover {
          border-color: var(--color-lime-dim);
          background: var(--color-lime-muted);
        }
        .upload-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-xl);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.75rem;
        }
        .upload-placeholder p { margin: 0 0 0.25rem; color: var(--text-primary); font-weight: 600; }
        .upload-placeholder small { color: var(--text-muted); font-size: 0.78rem; }
        .upload-selected {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
          font-weight: 600;
          color: var(--color-lime);
        }
        .upload-file-icon { flex-shrink: 0; }
        .upload-size { color: var(--text-muted); font-size: 0.8rem; }

        /* ── النجاح ── */
        .success-step { text-align: center; padding-top: 2rem; }
        .success-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-2xl);
          background: var(--color-lime-muted);
          border: 1.5px solid var(--color-lime-dim);
          color: var(--color-lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          box-shadow: 0 0 28px var(--color-lime-glow);
        }
        .success-title { font-size: 1.6rem; color: var(--text-primary); font-weight: 800; margin-bottom: 0.5rem; }
        .success-desc  { color: var(--text-muted); max-width: 320px; margin: 0 auto 0; }

        /* ── الإغلاق الكامل ── */
        .closure-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 3rem 2rem;
          text-align: center;
        }
        .closure-card-icon {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-2xl);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
        }
        .closure-card h2 { color: var(--text-primary); margin-bottom: 0.75rem; }
        .closure-card p  { color: var(--text-muted); margin: 0.5rem 0; }

        /* ── رسالة الخطأ ── */
        .bk-error {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.25);
          border-right: 3px solid var(--color-danger);
          padding: 0.6rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
        }
        .bk-error-bar { margin-top: 1rem; }

        /* ── Spinner ── */
        .bk-spin { animation: bk-spin 0.7s linear infinite; }

        /* ── Animations ── */
        @keyframes bk-spin     { to { transform: rotate(360deg); } }
        @keyframes bk-slide-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn      { from { opacity:0; } to { opacity:1; } }
        .animate-slide-up { animation: bk-slide-up 0.3s ease; }
        .animate-fade-in  { animation: fadeIn 0.25s ease; }

        /* ── جوال ≤480px ── */
        @media (max-width: 480px) {
          .book-main { padding: 1rem 0.875rem 5rem; }
          .bank-amount { font-size: 2rem; }
          .review-total { font-size: 1.25rem; }
        }
      `}</style>
    </div>
  )
}
