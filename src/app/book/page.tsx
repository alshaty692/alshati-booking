'use client'
// ============================================================
// صفحة الحجز — 5 خطوات (التاريخ+الملعب مدمجان في خطوة واحدة)
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatAmount, getCourtName, getPeriodName } from '@/lib/utils'
import type { AvailableSlot, PriceCalculation } from '@/types'

// ── أنواع ────────────────────────────────────────────────────
interface BookingState {
  date: string
  court_id: string
  period_number: number
  customer_name: string
  code: string
  price: PriceCalculation | null
}

// ── الخطوات الـ٥ ─────────────────────────────────────────────
const STEPS = [
  { label: 'الموعد',    icon: '📅' },   // 0: تاريخ + ملعب مدمجان
  { label: 'بياناتك',  icon: '👤' },   // 1: اسم + كود
  { label: 'المراجعة', icon: '✅' },   // 2
  { label: 'الدفع',    icon: '💳' },   // 3
  { label: 'الإيصال',  icon: '📤' },   // 4: النجاح
]

// ── ثوابت التصميم ─────────────────────────────────────────────
const C = {
  navy:  '#1B2A3B',
  green: '#2D5C4E',
  gold:  '#C9A96E',
  beige: '#F5F2EC',
}
const COURTS = ['football', 'volleyball', 'multi'] as const
const COURT_ICONS: Record<string, string> = { football:'⚽', volleyball:'🏐', multi:'🏅' }

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
    date:'', court_id:'', period_number:0, customer_name:'', code:'', price:null,
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

  // ── جلب البيانات + التعرف على العميل ──────────────────────
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
      // ── التعرف التلقائي على العميل ──
      if (customerData?.found && customerData.name) {
        setBooking(b => ({ ...b, customer_name: customerData.name }))
        setIsReturning(true)
      }
    }).finally(() => setLoadingSlots(false))
  }, [])

  const uniqueDates   = [...new Set(slots.map(s => s.day_date))].sort()
  const slotsForDate  = slots.filter(s => s.day_date === booking.date)
  // الأسعار من courtPrices (محمّلة من DB مباشرة)
  const basePrice     = (courtId: string) => courtPrices[courtId] ?? 0
  const isSlotSelected = (courtId: string, period: number) =>
    booking.court_id === courtId && booking.period_number === period
  const canProceedStep0 = Boolean(booking.date && booking.court_id && booking.period_number)

  // ── تعيين السعر عند الوصول لخطوة بياناتك ─────────────────
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

  // ── التحقق من الكود ────────────────────────────────────────
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

  // ── إنشاء الحجز ───────────────────────────────────────────
  async function createBooking() {
    setCreating(true); setError('')
    try {
      const res  = await fetch('/api/booking/create', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          booking_date: booking.date, court_id: booking.court_id,
          period_number: booking.period_number, customer_name: booking.customer_name,
          code_used: booking.code.toUpperCase() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setBookingId(data.booking_id)
      setStep(3)
    } finally { setCreating(false) }
  }

  // ── رفع الإيصال ────────────────────────────────────────────
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

  // ── إعادة ضبط ─────────────────────────────────────────────
  function resetBooking() {
    setStep(0)
    setBooking({ date:'', court_id:'', period_number:0, customer_name:'', code:'', price:null })
    setBookingId(''); setUploadFile(null); setError(''); setCodeError('')
  }

  // ── شاشة التحميل ─────────────────────────────────────────
  if (loadingSlots) return (
    <div className="book-loading">
      <div className="spinner" style={{ width:'2.5rem', height:'2.5rem', borderWidth:'3px' }} />
      <p>جاري تحميل المواعيد...</p>
    </div>
  )

  return (
    <div className="book-page">

      {/* ── هيدر ── */}
      <header className="book-header">
        <div className="book-header-inner">
          <div className="book-header-logo">🏟️ مركز حي الشاطئ</div>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/my-bookings')}>
            حجوزاتي
          </button>
        </div>
      </header>

      {/* ── بانر الإغلاق ── */}
      {closureBanner?.active && (
        <div className="closure-banner">
          <div className="closure-banner-inner">
            <span className="closure-icon">🔒</span>
            <div>
              <div className="closure-msg">{closureBanner.msg || 'المركز مغلق مؤقتاً'}</div>
              {closureBanner.date && (
                <div className="closure-date">موعد العودة: {closureBanner.date}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Stepper ── */}
      {step < 4 && (
        <div className="book-stepper-wrap">
          <div className="stepper">
            {STEPS.slice(0,4).map((s,i) => (
              <div key={i} className={`step ${i===step?'active':i<step?'done':''}`}>
                <div className="step-number">{i<step?'✓':s.icon}</div>
                <div className="step-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── شريط الاختيار الحالي (live summary) ── */}
      {step === 0 && canProceedStep0 && (
        <div className="live-summary-bar">
          <div className="live-summary-inner">
            <span>📅 {formatDate(booking.date)}</span>
            <span>·</span>
            <span>{COURT_ICONS[booking.court_id]} {getCourtName(booking.court_id)}</span>
            <span>·</span>
            <span>⏰ {getPeriodName(booking.period_number)}</span>
            {basePrice(booking.court_id) > 0 && (
              <>
                <span>·</span>
                <strong style={{ color:C.gold }}>{formatAmount(basePrice(booking.court_id))}</strong>
              </>
            )}
          </div>
          <button className="live-summary-btn" onClick={() => setStep(1)}>التالي ←</button>
        </div>
      )}

      <main className="book-main">

        {/* ========== الخطوة 0: الموعد (تاريخ + ملعب مدمجان) ========== */}
        {step === 0 && !closureBanner?.active && (
          <div className="book-step animate-slide-up">

            {/* أزرار الأيام — أفقية قابلة للتمرير */}
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

            {/* الملاعب والفترات — تظهر فوراً عند اختيار يوم */}
            {!booking.date ? (
              <div className="date-hint">
                <div className="date-hint-icon">👆</div>
                <p>اختر يوماً أولاً لرؤية المواعيد المتاحة</p>
              </div>
            ) : (
              <div className="courts-container animate-fade-in">
                {COURTS.map(courtId => {
                  const courtSlots = slotsForDate.filter(s => s.court_id === courtId)
                  return (
                    <div key={courtId} className="court-block">
                      <div className="court-block-header">
                        <span className="court-block-icon">{COURT_ICONS[courtId]}</span>
                        <span className="court-block-name">{getCourtName(courtId)}</span>
                        {basePrice(courtId) > 0 && (
                          <span className="court-block-price">{formatAmount(basePrice(courtId))}</span>
                        )}
                      </div>
                      <div className="court-periods">
                        {courtSlots.length === 0 ? (
                          <div className="no-slots">لا توجد فترات</div>
                        ) : [...courtSlots].sort((a,b) => a.period_number - b.period_number).map(slot => {
                          const sel    = isSlotSelected(courtId, slot.period_number)
                          const status = !slot.is_available ? 'booked' : sel ? 'selected' : 'available'
                          return (
                            <button
                              key={slot.period_number}
                              id={`slot-${courtId}-${slot.period_number}`}
                              className={`period-chip period-chip-${status}`}
                              disabled={!slot.is_available}
                              onClick={() => {
                                if (!slot.is_available) return
                                setBooking(b => ({
                                  ...b,
                                  court_id: courtId,
                                  period_number: slot.period_number,
                                  price: null,
                                }))
                              }}
                            >
                              <span className="period-chip-time">{getPeriodName(slot.period_number)}</span>
                              <span className="period-chip-dot" />
                              <span className="period-chip-label">
                                {status==='booked'?'محجوز':status==='selected'?'مختار ✓':'متاح'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* زر التالي في الأسفل (مرئي دائماً إذا اكتمل الاختيار) */}
            {canProceedStep0 && (
              <button
                id="btn-step0-next"
                className="btn-step-next"
                onClick={() => setStep(1)}
              >
                التالي ← بياناتك
              </button>
            )}
          </div>
        )}

        {/* بانر الإغلاق بدل الملاعب */}
        {step === 0 && closureBanner?.active && (
          <div className="book-step">
            <div className="closure-card">
              <div style={{ fontSize:'3rem' }}>🔒</div>
              <h2>المركز مغلق مؤقتاً</h2>
              <p>{closureBanner.msg || 'نأسف للإزعاج، سنعود قريباً'}</p>
              {closureBanner.date && <p>موعد العودة: <strong>{closureBanner.date}</strong></p>}
            </div>
          </div>
        )}

        {/* ========== الخطوة 1: بياناتك ========== */}
        {step === 1 && (
          <div className="book-step animate-slide-up">
            <button className="step-back" onClick={() => setStep(0)}>← رجوع</button>
            <h2 className="step-title">بيانات الحجز</h2>

            {/* ملخص مصغّر */}
            <div className="selection-summary">
              <div className="selection-chip">📅 {formatDate(booking.date)}</div>
              <div className="selection-chip">{COURT_ICONS[booking.court_id]} {getCourtName(booking.court_id)}</div>
              <div className="selection-chip">⏰ {getPeriodName(booking.period_number)}</div>
            </div>

            <div className="form-group">
              <label htmlFor="customer-name">اسمك الكريم</label>
              {isReturning ? (
                <div className="returning-welcome">
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1rem', background:'rgba(45,92,78,.1)', border:'1px solid rgba(45,92,78,.25)', borderRadius:'10px', marginBottom:'0.5rem' }}>
                    <span style={{ fontSize:'1.3rem' }}>👋</span>
                    <span style={{ fontWeight:700, color:'#2D5C4E' }}>مرحباً بعودتك يا {booking.customer_name}!</span>
                  </div>
                  <button type="button" style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.8rem', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}
                    onClick={() => setIsReturning(false)}>تعديل الاسم</button>
                </div>
              ) : (
                <input
                  id="customer-name" type="text" className="input"
                  placeholder="أدخل اسمك الكريم"
                  value={booking.customer_name}
                  onChange={e => setBooking(b => ({ ...b, customer_name: e.target.value }))}
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="discount-code">كود الخصم (اختياري)</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input
                  id="discount-code" type="text" className="input"
                  placeholder="SUMMER25"
                  value={booking.code}
                  onChange={e => { setBooking(b => ({ ...b, code:e.target.value.toUpperCase(), price:null })); setCodeError('') }}
                  style={{ flex:1 }}
                />
                <button id="btn-validate-code" type="button" className="btn btn-secondary"
                  onClick={validateCode} disabled={codeLoading}>
                  {codeLoading ? <span className="spinner" /> : 'تحقق'}
                </button>
              </div>
              {codeError && <div className="form-error" style={{ marginTop:'0.5rem' }}>{codeError}</div>}
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
                <div className="price-row total">
                  <span>الإجمالي</span>
                  <strong>{formatAmount(booking.price.final_price)}</strong>
                </div>
              </div>
            )}

            <button id="btn-to-review" className="btn-step-next"
              style={{ marginTop:'1.5rem' }}
              disabled={!booking.customer_name.trim() || !booking.price}
              onClick={() => setStep(2)}>
              مراجعة الحجز →
            </button>
          </div>
        )}

        {/* ========== الخطوة 2: المراجعة ========== */}
        {step === 2 && (
          <div className="book-step animate-slide-up">
            <button className="step-back" onClick={() => setStep(1)}>← رجوع</button>
            <h2 className="step-title">مراجعة الحجز</h2>
            <p className="step-desc">تأكد من البيانات قبل الدفع</p>

            <div className="review-card card">
              {[
                ['التاريخ',   formatDate(booking.date)],
                ['الملعب',    getCourtName(booking.court_id)],
                ['الفترة',    getPeriodName(booking.period_number)],
                ['الاسم',     booking.customer_name],
                ...(booking.code ? [['الكود', booking.code]] : []),
              ].map(([label,value]) => (
                <div key={label} className="review-row">
                  <span className="review-label">{label}</span>
                  <span style={{ fontWeight:600 }}>{value}</span>
                </div>
              ))}
              <div className="review-row total-row">
                <span className="review-label">المبلغ المطلوب</span>
                <strong className="review-total">{formatAmount(booking.price?.final_price ?? 0)}</strong>
              </div>
            </div>

            {error && <div className="form-error" style={{ marginTop:'1rem' }}>{error}</div>}

            <button id="btn-confirm-booking" className="btn-step-next"
              style={{ marginTop:'1.5rem' }} disabled={creating} onClick={createBooking}>
              {creating ? <><span className="spinner" /> جاري الحجز...</> : 'تأكيد وانتقل للدفع →'}
            </button>
          </div>
        )}

        {/* ========== الخطوة 3: الدفع ========== */}
        {step === 3 && (
          <div className="book-step animate-slide-up">
            <h2 className="step-title">ادفع بالتحويل البنكي</h2>
            <p className="step-desc">حوّل المبلغ ثم ارفع صورة الإيصال</p>

            <div className="bank-card card">
              <div className="bank-amount">{formatAmount(booking.price?.final_price ?? 0)}</div>
              {[
                ['البنك',         settings.bank_name || '—'],
                ['اسم الحساب',   settings.bank_account_name || '—'],
                ['رقم الآيبان',  settings.bank_iban || '—'],
                ['رقم الحساب',   settings.bank_account_number || '—'],
              ].map(([label,value]) => (
                <div key={label} className="bank-detail">
                  <span>{label}</span>
                  <strong style={{ fontFamily:'monospace', fontSize:'0.85rem' }}>{value}</strong>
                </div>
              ))}
            </div>

            <div className="upload-section">
              <h3>ارفع صورة الإيصال</h3>
              <div className="upload-area" onClick={() => document.getElementById('receipt-file')?.click()}>
                {uploadFile ? (
                  <div className="upload-selected">
                    <span>📎 {uploadFile.name}</span>
                    <span className="upload-size">({(uploadFile.size/1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <div className="upload-icon">📤</div>
                    <p>اضغط لاختيار صورة الإيصال</p>
                    <small>JPG, PNG, PDF — حد 5MB</small>
                  </div>
                )}
              </div>
              <input id="receipt-file" type="file" accept="image/*,application/pdf"
                style={{ display:'none' }} onChange={e => setUploadFile(e.target.files?.[0]??null)} />
              {error && <div className="form-error" style={{ marginTop:'0.75rem' }}>{error}</div>}
              <button id="btn-upload-receipt" className="btn-step-next"
                style={{ marginTop:'1rem' }} disabled={!uploadFile||uploading} onClick={uploadReceipt}>
                {uploading ? <><span className="spinner" /> جاري الرفع...</> : 'رفع الإيصال →'}
              </button>
            </div>
          </div>
        )}

        {/* ========== الخطوة 4: النجاح ========== */}
        {step === 4 && (
          <div className="book-step success-step animate-slide-up">
            <div className="success-icon">🎉</div>
            <h2>تم استلام حجزك!</h2>
            <p>سيتم مراجعة الإيصال وتأكيد الحجز خلال فترة وجيزة</p>
            <div className="review-card card" style={{ margin:'1.5rem 0', textAlign:'right' }}>
              <div className="review-row"><span className="review-label">التاريخ</span><span>{formatDate(booking.date)}</span></div>
              <div className="review-row"><span className="review-label">الملعب</span><span>{getCourtName(booking.court_id)}</span></div>
              <div className="review-row"><span className="review-label">الفترة</span><span>{getPeriodName(booking.period_number)}</span></div>
            </div>
            <button id="btn-new-booking" className="btn-step-next" onClick={resetBooking}>حجز جديد</button>
            <button id="btn-my-bookings" className="btn btn-secondary btn-full"
              style={{ marginTop:'0.75rem' }} onClick={() => router.push('/my-bookings')}>
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
        .book-page  { min-height: 100vh; background: ${C.beige}; font-family: 'Tajawal','IBM Plex Sans Arabic',sans-serif; }
        .book-loading {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 1rem; color: #64748b;
          font-family: 'Tajawal',sans-serif;
        }

        /* ── هيدر ── */
        .book-header { background: ${C.navy}; position: sticky; top: 0; z-index: 50; }
        .book-header-inner {
          max-width: 720px; margin: 0 auto;
          padding: 0.875rem 1.25rem;
          display: flex; align-items: center; justify-content: space-between;
        }
        .book-header-logo { font-weight: 800; font-size: 1rem; color: ${C.gold}; }

        /* ── بانر الإغلاق ── */
        .closure-banner { background: ${C.green}; padding: 0.875rem 1.25rem; }
        .closure-banner-inner {
          max-width: 720px; margin: 0 auto;
          display: flex; align-items: center; gap: 0.875rem;
        }
        .closure-icon { font-size: 1.5rem; }
        .closure-msg  { font-weight: 700; color: #fff; font-size: 0.95rem; }
        .closure-date { color: ${C.gold}; font-size: 0.8rem; margin-top: 0.15rem; }

        /* ── Stepper ── */
        .book-stepper-wrap { background: ${C.navy}; padding: 0 1rem; }
        .book-stepper-wrap .stepper { max-width: 720px; margin: 0 auto; }
        .book-stepper-wrap .step-label { color: rgba(255,255,255,.6); font-size: 0.75rem; }
        .book-stepper-wrap .step.active .step-label { color: ${C.gold}; }
        .book-stepper-wrap .step.done  .step-label { color: rgba(255,255,255,.5); }
        .book-stepper-wrap .step-number {
          border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: rgba(255,255,255,.5);
        }
        .book-stepper-wrap .step.active .step-number { background: ${C.gold}; border-color: ${C.gold}; color: ${C.navy}; }
        .book-stepper-wrap .step.done  .step-number  { background: ${C.green}; border-color: ${C.green}; color: #fff; }

        /* ── شريط الاختيار اللحظي ── */
        .live-summary-bar {
          background: ${C.navy};
          border-bottom: 2px solid ${C.gold};
          padding: 0.5rem 1.25rem;
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.5rem; flex-wrap: wrap;
        }
        .live-summary-inner {
          display: flex; align-items: center; gap: 0.625rem;
          flex-wrap: wrap; color: rgba(255,255,255,.85); font-size: 0.85rem;
        }
        .live-summary-btn {
          background: ${C.gold}; color: ${C.navy};
          border: none; border-radius: 8px;
          padding: 0.4rem 0.875rem; font-weight: 800; font-size: 0.85rem;
          cursor: pointer; white-space: nowrap; font-family: 'Tajawal',sans-serif;
          transition: all 0.15s;
        }
        .live-summary-btn:hover { background: #d4b77a; }

        /* ── المحتوى ── */
        .book-main { max-width: 720px; margin: 0 auto; padding: 1.25rem 1rem 5rem; }
        .book-step { animation: slideUp 0.3s ease; }
        .step-title { font-size: 1.4rem; margin-bottom: 0.4rem; color: ${C.navy}; font-weight: 800; }
        .step-desc  { color: #64748b; margin-bottom: 1.25rem; font-size: 0.9rem; }
        .step-back  {
          background: none; border: none; color: ${C.green};
          font-size: 0.875rem; font-family: inherit; cursor: pointer;
          padding: 0; margin-bottom: 1rem; font-weight: 700;
        }
        .step-back:hover { text-decoration: underline; }

        /* ── أزرار الأيام (أفقية قابلة للتمرير) ── */
        .dates-scroll-wrap {
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          margin: 0 -1rem 1.5rem; padding: 0 1rem;
          scrollbar-width: none;
        }
        .dates-scroll-wrap::-webkit-scrollbar { display: none; }
        .dates-scroll {
          display: flex; gap: 0.625rem;
          padding-bottom: 0.5rem; width: max-content;
        }

        .date-pill {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.1rem; padding: 0.75rem 0.625rem;
          border: 2px solid #E2DDD4; border-radius: 12px;
          background: #fff; cursor: pointer;
          min-width: 80px; transition: all 0.18s ease;
          font-family: 'Tajawal',sans-serif; position: relative;
        }
        .date-pill:hover:not(:disabled) { border-color: ${C.green}; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(45,92,78,.15); }
        .date-pill.selected { border-color: ${C.green}; background: #e8f4f0; }
        .date-pill.disabled { opacity: 0.4; cursor: not-allowed; }
        /* اسم اليوم — أعلى */ 
        .date-pill-day   { font-size: 0.72rem; color: #64748b; font-weight: 700; white-space: nowrap; }
        /* رقم اليوم — كبير وبارز */
        .date-pill-num   { font-size: 1.9rem; font-weight: 900; line-height: 1.05; color: ${C.navy}; }
        /* اسم الشهر — تحت */
        .date-pill-month { font-size: 0.72rem; color: ${C.green}; font-weight: 700; white-space: nowrap; }
        .date-pill-full  { position: absolute; bottom: 0.25rem; font-size: 0.6rem; color: #ef4444; font-weight: 700; }
        .date-pill.selected .date-pill-day   { color: ${C.green}; }
        .date-pill.selected .date-pill-num   { color: ${C.green}; }
        .date-pill.selected .date-pill-month { color: ${C.green}; }

        /* ── تلميح اختر يوماً ── */
        .date-hint {
          text-align: center; padding: 3rem 1rem;
          color: #94a3b8; font-size: 0.9rem;
        }
        .date-hint-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
        .date-hint p    { margin: 0; }

        /* ── الملاعب والفترات ── */
        .courts-container { display: flex; flex-direction: column; gap: 1rem; }
        .court-block {
          background: #fff;
          border: 0.5px solid #E2DDD4;
          border-radius: 14px; padding: 1rem 1.25rem;
          box-shadow: 0 2px 8px rgba(27,42,59,.06);
        }
        .court-block-header {
          display: flex; align-items: center; gap: 0.625rem;
          margin-bottom: 0.875rem;
        }
        .court-block-icon  { font-size: 1.35rem; }
        .court-block-name  { font-weight: 800; font-size: 1rem; color: ${C.navy}; flex: 1; }
        .court-block-price { font-size: 0.8rem; color: #64748b; background: ${C.beige}; padding: 0.2rem 0.625rem; border-radius: 99px; }

        .court-periods { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.625rem; direction: rtl; }
        .no-slots      { color: #94a3b8; font-size: 0.85rem; padding: 0.5rem 0; }

        /* فترة — ٣ حالات */
        .period-chip {
          display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
          padding: 0.875rem 0.5rem; border-radius: 10px;
          border: 2px solid transparent; cursor: pointer;
          font-family: 'Tajawal',sans-serif; transition: all 0.18s ease;
          position: relative; overflow: hidden;
        }
        .period-chip-time  { font-size: 0.9rem; font-weight: 800; }
        .period-chip-dot   { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .period-chip-label { font-size: 0.68rem; font-weight: 600; }

        /* متاح — أخضر فاتح */
        .period-chip-available {
          background: #e8f4f0; border-color: #b8ddd3; color: ${C.green};
        }
        .period-chip-available .period-chip-dot   { background: ${C.green}; }
        .period-chip-available .period-chip-label { color: ${C.green}; }
        .period-chip-available:hover { border-color: ${C.green}; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(45,92,78,.2); }

        /* مختار — كحلي */
        .period-chip-selected {
          background: ${C.navy}; border-color: ${C.navy}; color: ${C.gold};
          box-shadow: 0 4px 16px rgba(27,42,59,.3);
        }
        .period-chip-selected .period-chip-dot   { background: ${C.gold}; }
        .period-chip-selected .period-chip-label { color: ${C.gold}; }
        .period-chip-selected:hover { transform: translateY(-1px); }

        /* محجوز — رمادي */
        .period-chip-booked {
          background: #f1f5f9; border-color: #e2e8f0; color: #94a3b8;
          opacity: 0.6; cursor: not-allowed;
        }
        .period-chip-booked .period-chip-dot   { background: #94a3b8; }
        .period-chip-booked .period-chip-label { color: #94a3b8; }

        /* ── زر التالي ── */
        .btn-step-next {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          width: 100%; padding: 0.875rem 1.5rem;
          background: ${C.green}; color: #fff;
          border: none; border-radius: 12px;
          font-size: 1rem; font-weight: 800; cursor: pointer;
          font-family: 'Tajawal',sans-serif; transition: all 0.18s;
          text-decoration: none;
        }
        .btn-step-next:hover:not(:disabled) { background: #1f4035; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(45,92,78,.35); }
        .btn-step-next:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

        /* ── ملخص الاختيارات (خطوة بياناتك) ── */
        .selection-summary {
          display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem;
        }
        .selection-chip {
          background: #fff; border: 1px solid #E2DDD4;
          border-radius: 99px; padding: 0.35rem 0.875rem;
          font-size: 0.82rem; font-weight: 600; color: ${C.navy};
        }

        /* ── السعر ── */
        .form-group { margin-bottom: 1.25rem; }
        .form-group label { display: block; font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem; color: ${C.navy}; }
        .price-box {
          background: ${C.beige}; border: 1px solid #E2DDD4; border-radius: 10px;
          padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;
        }
        .price-row { display: flex; justify-content: space-between; font-size: 0.95rem; }
        .price-row.discount { color: ${C.green}; }
        .price-row.total { font-size: 1.1rem; border-top: 1px solid #E2DDD4; padding-top: 0.5rem; margin-top: 0.25rem; color: ${C.navy}; }
        .price-row.total strong { color: ${C.green}; font-size: 1.2rem; }

        /* ── المراجعة ── */
        .review-card { display: flex; flex-direction: column; gap: 0; }
        .review-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #E2DDD4; font-size: 0.95rem; }
        .review-row:last-child { border-bottom: none; }
        .review-label { color: #64748b; font-size: 0.875rem; }
        .total-row { background: ${C.beige}; padding: 1rem; margin: 0 -1.5rem -1.5rem; border-radius: 0 0 12px 12px; }
        .review-total { font-size: 1.5rem; color: ${C.green}; font-weight: 800; }

        /* ── البنك ── */
        .bank-card { text-align: center; margin-bottom: 1.5rem; }
        .bank-amount { font-size: 2.5rem; font-weight: 800; color: ${C.green}; margin-bottom: 1.25rem; }
        .bank-detail { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid #E2DDD4; font-size: 0.9rem; }
        .bank-detail:last-child { border-bottom: none; }
        .upload-section { background: #fff; border-radius: 14px; border: 0.5px solid #E2DDD4; padding: 1.25rem; }
        .upload-section h3 { margin: 0 0 1rem; font-size: 1rem; color: ${C.navy}; font-weight: 800; }
        .upload-area { border: 2px dashed #E2DDD4; border-radius: 10px; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: all 0.18s; }
        .upload-area:hover { border-color: ${C.green}; background: #e8f4f0; }
        .upload-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .upload-placeholder p { margin: 0 0 0.25rem; color: ${C.navy}; font-weight: 600; }
        .upload-placeholder small { color: #64748b; }
        .upload-selected { display: flex; align-items: center; gap: 0.5rem; justify-content: center; font-weight: 600; }
        .upload-size { color: #64748b; font-size: 0.8rem; }

        /* ── النجاح ── */
        .success-step { text-align: center; padding-top: 2rem; }
        .success-icon { font-size: 5rem; margin-bottom: 1rem; }
        .success-step h2 { font-size: 1.6rem; color: ${C.navy}; font-weight: 800; margin-bottom: 0.5rem; }
        .success-step p { color: #64748b; max-width: 320px; margin: 0 auto; }

        /* ── الإغلاق ── */
        .closure-card {
          background: #fff; border: 0.5px solid #E2DDD4; border-radius: 14px;
          padding: 3rem 2rem; text-align: center;
        }
        .closure-card h2 { color: ${C.navy}; margin-bottom: 0.75rem; }
        .closure-card p  { color: #64748b; margin: 0.5rem 0; }

        /* ── خطأ ── */
        .form-error { background: #fee2e2; color: #991b1b; padding: 0.6rem 0.875rem; border-radius: 8px; font-size: 0.875rem; border-right: 3px solid #ef4444; }

        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        .animate-slide-up { animation: slideUp 0.3s ease; }
        .animate-fade-in  { animation: fadeIn 0.25s ease; }
      `}</style>
    </div>
  )
}
