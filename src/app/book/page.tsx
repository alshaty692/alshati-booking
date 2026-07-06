'use client'
// ============================================================
// صفحة الحجز — 5 خطوات (التاريخ+الملعب مدمجان في خطوة واحدة)
// ============================================================
import './book.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import type { AvailableSlot, PriceCalculation } from '@/types'
import {
  CalendarDays, User, ClipboardCheck, CreditCard, CheckCircle2,
  ArrowLeft, ArrowRight, Dumbbell, BookOpen, Minus, Plus,
  Upload, Loader2, AlertTriangle, Lock, Droplets, Tag,
  PointerIcon,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import HeaderMenu from '@/components/book/HeaderMenu'
import WaterSelector from '@/components/book/WaterSelector'
import PriceBox from '@/components/book/PriceBox'
import SuccessStep from '@/components/book/SuccessStep'

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
  const [fullClosureInfo, setFullClosureInfo] = useState<{
    scheduledStartISO: string | null
    title: string
    message: string
  } | null>(null)

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
      // إغلاق مجدول من slots API
      if (slotsData.closure_info) {
        setFullClosureInfo(slotsData.closure_info)
      }
      if (customerData?.found && customerData.name) {
        setBooking(b => ({ ...b, customer_name: customerData.name }))
        setIsReturning(true)
      }
    }).finally(() => setLoadingSlots(false))

    fetch('/api/booking/venue-closures').then(r => r.ok ? r.json() : { closures: [] })
      .then(d => setVenueClosures(d.closures ?? []))
      .catch(() => {})
  }, [])

  const uniqueDates   = [...new Set(slots.map(s => s.day_date))].sort()
  const slotsForDate  = slots.filter(s => s.day_date === booking.date)
  const basePrice     = (courtId: string) => courtPrices[courtId] ?? 0

  // ── التحقق من إيقاف ملعب ────────────────────────────────────
  const isCourtClosed = (courtId: string, date: string) =>
    venueClosures.some(c => c.court_id === courtId && date >= c.start_date && date <= c.end_date)
  const getClosureReason = (courtId: string, date: string) =>
    venueClosures.find(c => c.court_id === courtId && date >= c.start_date && date <= c.end_date)?.reason ?? 'صيانة'

  // التحقق من إغلاق كامل مجدول (تاريخ ضمن فترة الإغلاق)
  const isFullClosureDate = (date: string) =>
    Boolean(fullClosureInfo?.scheduledStartISO && date >= fullClosureInfo.scheduledStartISO)

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
  // fallback صفر (لا 10 عشوائي) — اتساق مع WaterSelector
  const waterMaxSetting = settings.water_max_cartons !== undefined
    ? (Number(settings.water_max_cartons) || 0)
    : 0
  const waterMax   = waterStock > 0 ? Math.min(waterMaxSetting, waterStock) : 0
  const waterTotal = booking.water_quantity * waterPrice



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
            <HeaderMenu
              onMyBookings={() => router.push('/my-bookings')}
              settings={settings}
            />
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
                  const hasAvail   = slots.some(s => s.day_date === date && s.is_available)
                  const fullClosed = isFullClosureDate(date)
                  const d          = new Date(date + 'T00:00:00')
                  const isSelected = booking.date === date
                  const isDisabled = !hasAvail || fullClosed
                  return (
                    <button
                      key={date}
                      id={`date-${date}`}
                      className={`date-pill ${isSelected?'selected':''} ${isDisabled?'disabled':''} ${fullClosed?'full-closed':''}`}
                      onClick={() => {
                        if (isDisabled) return
                        setBooking(b => ({ ...b, date, court_id:'', period_number:0 }))
                      }}
                      disabled={isDisabled}
                      title={fullClosed ? (fullClosureInfo?.message ?? 'مغلق') : undefined}
                    >
                      <span className="date-pill-day">{d.toLocaleDateString('ar-SA-u-ca-gregory',{weekday:'long'})}</span>
                      <span className="date-pill-num">{d.toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric'})}</span>
                      <span className="date-pill-month">{d.toLocaleDateString('ar-SA-u-ca-gregory',{month:'long'})}</span>
                      {fullClosed && <span className="date-pill-full" style={{background:'rgba(255,80,80,0.18)',color:'#ff5050'}}>🔒 مغلق</span>}
                      {!fullClosed && !hasAvail && <span className="date-pill-full">مكتمل</span>}
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
            <WaterSelector
              quantity={booking.water_quantity}
              onChange={(newQty) => setBooking(b => ({ ...b, water_quantity: newQty }))}
              settings={settings}
            />

            {booking.price && (
              <PriceBox price={booking.price} waterTotal={waterTotal} />
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
          <SuccessStep
            date={formatDate(booking.date)}
            courtDisplayName={courtName(booking.court_id)}
            periodDisplay={getPeriodName(booking.period_number)}
            onReset={resetBooking}
            onMyBookings={() => router.push('/my-bookings')}
          />
        )}
      </main>

      {/* CSS منقول لـ book.css — مستورد في أعلى الملف */}
    </div>
  )
}
