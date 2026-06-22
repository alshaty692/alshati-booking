'use client'

import { useState, useEffect, useCallback } from 'react'

/* ================================================================
   ثوابت
   ================================================================ */
const COURTS = [
  { id: 'football',   label: 'كرة القدم',   icon: '⚽' },
  { id: 'volleyball', label: 'الكرة الطائرة', icon: '🏐' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏅' },
]

const PERIODS = [
  { num: 1, label: '5-7م'  },
  { num: 2, label: '7-9م'  },
  { num: 3, label: '9-11م' },
]

const CLOSURE_REASONS = ['صيانة', 'فعالية خاصة', 'إجازة رسمية', 'أخرى']
const BLOCK_REASONS   = ['صيانة', 'فعالية', 'إجازة', 'أخرى']

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const AR_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

/* ================================================================
   مساعدات التاريخ
   ================================================================ */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  // احسب يوم الأسبوع (0=Sun) ثم اذهب للاثنين
  const day = d.getDay() // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateAr(date: Date): string {
  return `${date.getDate()} ${AR_MONTHS[date.getMonth()]}`
}

/* ================================================================
   أنواع
   ================================================================ */
interface SlotRow {
  court_id:      string
  day_date:      string
  period_number: number
  is_available:  boolean
}

interface BlockedRow {
  id:            string
  court_id:      string
  date:          string
  period_number: number
  reason:        string | null
}

interface AvailData {
  slots:    SlotRow[]
  blocked:  BlockedRow[]
  settings: Record<string, string>
}

interface SlotTarget {
  court_id:      string
  date:          string
  period_number: number
}

interface BookingDetail {
  id:               string
  customer_name:    string
  customer_phone:   string
  status:           string
  base_price:       number
  discount_amount:  number
  final_price:      number
  code_used:        string | null
  water_quantity:   number
  is_manual:        boolean
  court_id:         string
  booking_date:     string
  period_number:    number
}

/* ================================================================
   مكوّن الصفحة
   ================================================================ */
export default function AvailabilityPage() {
  /* ── حالة الإغلاق الكامل ── */
  const [closureActive,     setClosureActive]     = useState(false)
  const [closureReason,     setClosureReason]     = useState('')
  const [closureReturnDate, setClosureReturnDate] = useState('')
  const [closureMessage,    setClosureMessage]    = useState('')
  const [closureSaving,     setClosureSaving]     = useState(false)
  const [closureMsg,        setClosureMsg]        = useState<{ type:'ok'|'err'; text:string } | null>(null)

  /* ── حالة شبكة التوافر ── */
  const [weekStart,  setWeekStart]  = useState<Date>(() => getMondayOfWeek(new Date()))
  const [avail,      setAvail]      = useState<AvailData | null>(null)
  const [gridLoading,setGridLoading]= useState(false)

  /* ── حالة مودال الحجب ── */
  const [blockTarget, setBlockTarget] = useState<{ court_id:string; date:string; period_number:number } | null>(null)
  const [blockReason, setBlockReason] = useState('صيانة')
  const [blockSaving, setBlockSaving] = useState(false)

  /* ── حالة مودال فكّ الحجب ── */
  const [unblockTarget, setUnblockTarget] = useState<BlockedRow | null>(null)
  const [unblockSaving,  setUnblockSaving]  = useState(false)

  /* ── حالة مودال اختيار الإجراء (خلية متاحة) ── */
  const [slotChoiceTarget, setSlotChoiceTarget] = useState<SlotTarget | null>(null)

  /* ── حالة مودال الحجز السريع ── */
  const [quickBookTarget, setQuickBookTarget] = useState<SlotTarget | null>(null)
  const [qbPhone,        setQbPhone]        = useState('')
  const [qbName,         setQbName]         = useState('')
  const [qbNameEditable, setQbNameEditable] = useState(false)
  const [qbStatus,       setQbStatus]       = useState<'confirmed'|'pending'>('confirmed')
  const [qbCode,         setQbCode]         = useState('')
  const [qbWater,        setQbWater]        = useState(0)
  const [qbSearching,    setQbSearching]    = useState(false)
  const [qbCustomer,     setQbCustomer]     = useState<{ found: boolean; name?: string; id?: string; is_suspended?: boolean; suspension_reason?: string | null } | null>(null)
  const [qbPrice,        setQbPrice]        = useState<{ base_price: number; discount_amount: number; final_price: number } | null>(null)
  const [qbSaving,       setQbSaving]       = useState(false)

  /* ── حالة مودال تفاصيل الحجز (خلية محجوزة) ── */
  const [bookingDetail,      setBookingDetail]      = useState<BookingDetail | null>(null)
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false)
  const [cancelMode,         setCancelMode]         = useState(false)
  const [cancelReason,       setCancelReason]       = useState('')
  const [cancelSaving,       setCancelSaving]       = useState(false)

  /* ── toast ── */
  const [toast, setToast] = useState<{ type:'ok'|'err'; text:string } | null>(null)
  const showToast = useCallback((type:'ok'|'err', text:string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }, [])

  /* ── حالة إيقافات الملاعب ── */
  const [venueClosures, setVenueClosures] = useState<{id:string;court_id:string;start_date:string;end_date:string;reason:string|null;created_at:string}[]>([])
  const [vcLoading, setVcLoading] = useState(false)
  const [vcForm, setVcForm] = useState({ court_id:'football', start_date:'', end_date:'', reason:'صيانة' })
  const [vcSaving, setVcSaving] = useState(false)

  const fetchClosures = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/venue-closures')
      const data = await r.json()
      setVenueClosures(data.closures ?? [])
    } catch {}
  }, [])

  const addClosure = async () => {
    if (!vcForm.start_date || !vcForm.end_date) { showToast('err', 'حدد تاريخ البداية والنهاية'); return }
    setVcSaving(true)
    try {
      const r = await fetch('/api/admin/venue-closures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vcForm),
      })
      if (r.ok) {
        showToast('ok', 'تم إضافة الإيقاف')
        setVcForm(f => ({ ...f, start_date:'', end_date:'', reason:'صيانة' }))
        fetchClosures()
      } else {
        const d = await r.json()
        showToast('err', d.error ?? 'فشل الحفظ')
      }
    } catch { showToast('err', 'خطأ في الاتصال') }
    finally { setVcSaving(false) }
  }

  const deleteClosure = async (id: string) => {
    try {
      const r = await fetch('/api/admin/venue-closures', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (r.ok) { showToast('ok', 'تم حذف الإيقاف'); fetchClosures() }
    } catch {}
  }

  /* ── جلب الإعدادات + الإيقافات عند التحميل ── */
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => {
        if (!settings) return
        setClosureActive(settings.closure_active === '1')
        setClosureReason(settings.closure_reason ?? '')
        setClosureReturnDate(settings.closure_return_date ?? '')
        setClosureMessage(settings.closure_message ?? '')
      })
      .catch(() => {})
    fetchClosures()
  }, [fetchClosures])

  /* ── جلب بيانات الشبكة ── */
  const fetchGrid = useCallback(async (monday: Date) => {
    setGridLoading(true)
    try {
      const from = toISO(monday)
      const to   = toISO(addDays(monday, 6))
      const r = await fetch(`/api/admin/availability?from=${from}&to=${to}`)
      const data = await r.json()
      setAvail(data)
    } catch {
      showToast('err', 'فشل تحميل بيانات التوافر')
    } finally {
      setGridLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchGrid(weekStart) }, [weekStart, fetchGrid])

  /* ── حفظ الإغلاق الكامل ── */
  async function saveClosureSettings() {
    setClosureSaving(true)
    setClosureMsg(null)
    try {
      const updates = [
        { key: 'closure_active',      value: closureActive ? '1' : '0' },
        { key: 'closure_reason',      value: closureReason },
        { key: 'closure_return_date', value: closureReturnDate },
        { key: 'closure_message',     value: closureMessage },
      ]
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (r.ok) setClosureMsg({ type:'ok', text:'تم الحفظ بنجاح ✓' })
      else       setClosureMsg({ type:'err', text:'حدث خطأ في الحفظ' })
    } catch {
      setClosureMsg({ type:'err', text:'تعذّر الاتصال بالخادم' })
    } finally {
      setClosureSaving(false)
    }
  }

  /* ── حجب فترة ── */
  async function handleBlock() {
    if (!blockTarget) return
    setBlockSaving(true)
    try {
      const r = await fetch('/api/admin/availability/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...blockTarget, reason: blockReason }),
      })
      if (r.ok) {
        showToast('ok', 'تم حجب الفترة')
        setBlockTarget(null)
        fetchGrid(weekStart)
      } else {
        const d = await r.json()
        showToast('err', d.error ?? 'فشل الحجب')
      }
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setBlockSaving(false)
    }
  }

  /* ── فكّ حجب فترة ── */
  async function handleUnblock() {
    if (!unblockTarget) return
    setUnblockSaving(true)
    try {
      const r = await fetch('/api/admin/availability/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          court_id:      unblockTarget.court_id,
          date:          unblockTarget.date,
          period_number: unblockTarget.period_number,
        }),
      })
      if (r.ok) {
        showToast('ok', 'تم إلغاء الحجب')
        setUnblockTarget(null)
        fetchGrid(weekStart)
      } else {
        showToast('err', 'فشل إلغاء الحجب')
      }
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setUnblockSaving(false)
    }
  }

  /* ── بحث عن عميل برقم الجوال ── */
  async function searchCustomer() {
    if (!qbPhone.trim()) return
    setQbSearching(true)
    setQbCustomer(null)
    setQbName('')
    setQbNameEditable(false)
    try {
      const r = await fetch(`/api/admin/customers/search?phone=${encodeURIComponent(qbPhone.trim())}`)
      const data = await r.json()
      setQbCustomer(data)
      if (data.found) {
        setQbName(data.name ?? '')
        setQbNameEditable(false)
      } else {
        setQbName('')
        setQbNameEditable(true)
      }
    } catch {
      setQbNameEditable(true)
    } finally {
      setQbSearching(false)
    }
  }

  /* ── فتح مودال الحجز السريع ── */
  async function openQuickBook(target: SlotTarget) {
    setSlotChoiceTarget(null)
    setQuickBookTarget(target)
    setQbPhone('')
    setQbName('')
    setQbNameEditable(false)
    setQbCustomer(null)
    setQbStatus('confirmed')
    setQbCode('')
    setQbWater(0)
    setQbSaving(false)
    // جلب السعر الافتراضي
    try {
      const r = await fetch('/api/booking/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ court_id: target.court_id, code: '' }),
      })
      const d = await r.json()
      setQbPrice(d.price ?? null)
    } catch { setQbPrice(null) }
  }

  /* ── تأكيد الحجز السريع ── */
  async function handleQuickBook() {
    if (!quickBookTarget) return
    if (!qbPhone.trim() || !qbName.trim()) { showToast('err', 'أدخل رقم الجوال والاسم'); return }
    setQbSaving(true)
    try {
      const r = await fetch('/api/admin/manual-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date:    quickBookTarget.date,
          court_id:        quickBookTarget.court_id,
          period_number:   quickBookTarget.period_number,
          customer_name:   qbName.trim(),
          customer_phone:  qbPhone.trim(),
          code_used:       qbCode.trim() || null,
          water_quantity:  qbWater,
          status:          qbStatus,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        showToast('ok', 'تم إنشاء الحجز بنجاح ✓')
        setQuickBookTarget(null)
        setAvail(null)
        fetchGrid(weekStart)
      } else {
        showToast('err', d.error ?? 'فشل إنشاء الحجز')
      }
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setQbSaving(false)
    }
  }

  /* ── فتح مودال تفاصيل الحجز (خلية محجوزة) ── */
  async function openBookedSlot(court_id: string, date: string, period_number: number) {
    setBookingDetailLoading(true)
    setBookingDetail(null)
    setCancelMode(false)
    setCancelReason('')
    try {
      const r = await fetch(
        `/api/admin/bookings/by-slot?date=${date}&court_id=${court_id}&period=${period_number}`
      )
      const d = await r.json()
      if (d.found) setBookingDetail(d.booking)
      else showToast('err', 'تعذّر جلب بيانات الحجز')
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setBookingDetailLoading(false)
    }
  }

  /* ── إلغاء الحجز ── */
  async function handleCancelBooking() {
    if (!bookingDetail) return
    setCancelSaving(true)
    try {
      const r = await fetch('/api/admin/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingDetail.id, cancellation_reason: cancelReason }),
      })
      const d = await r.json()
      if (r.ok) {
        showToast('ok', 'تم إلغاء الحجز ✓')
        setBookingDetail(null)
        setCancelMode(false)
        // صفّر الحالة فوراً ثم أعد الجلب — يضمن عدم ظهور بيانات قديمة بين العمليتين
        setAvail(null)
        fetchGrid(weekStart)
      } else {
        showToast('err', d.error ?? 'فشل الإلغاء')
      }
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setCancelSaving(false)
    }
  }

  /* ── أيام الأسبوع الحالي ── */
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  /* ── مساعد: هل الفترة محجوبة من المدير؟ ── */
  function getBlocked(court_id: string, date: string, period: number): BlockedRow | undefined {
    return avail?.blocked.find(
      b => b.court_id === court_id && b.date === date && b.period_number === period
    )
  }

  /* ── مساعد: هل الفترة متاحة (من view)؟ ── */
  function isAvailable(court_id: string, date: string, period: number): boolean {
    const slot = avail?.slots.find(
      s => s.court_id === court_id && s.day_date === date && s.period_number === period
    )
    return slot?.is_available ?? true // إذا لم تُعاد بيانات، نعتبرها متاحة
  }

  /* ── مساعد: هل هناك حجز فعلي (ليس من مدير)؟ ── */
  function isBooked(court_id: string, date: string, period: number): boolean {
    const slot = avail?.slots.find(
      s => s.court_id === court_id && s.day_date === date && s.period_number === period
    )
    if (!slot) return false
    const blocked = !!getBlocked(court_id, date, period)
    return !slot.is_available && !blocked
  }

  return (
    <>
      <style>{`
        .av-page {
          font-family: 'Tajawal', sans-serif;
          color: var(--text-primary);
          max-width: 1100px;
          margin: 0 auto;
          animation: fadeIn .35s ease both;
        }

        /* ── العنوان ── */
        .av-page-title {
          font-size: var(--text-2xl);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin-bottom: .25rem;
        }
        .av-page-sub {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin-bottom: 2rem;
        }

        /* ── بطاقة ── */
        .av-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          margin-bottom: var(--space-5);
          box-shadow: var(--shadow-sm);
        }
        .av-card-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        /* ── Toggle ── */
        .av-toggle-row {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }
        .av-toggle-wrap {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }
        .av-toggle-wrap input { opacity: 0; width:0; height:0; }
        .av-toggle-slider {
          position: absolute;
          inset: 0;
          border-radius: 28px;
          background: var(--border-color);
          transition: background .25s;
          cursor: pointer;
        }
        .av-toggle-slider::before {
          content:'';
          position: absolute;
          left: 3px; top: 3px;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: var(--bg-surface);
          box-shadow: 0 2px 6px rgba(0,0,0,.25);
          transition: transform .25s;
        }
        .av-toggle-wrap input:checked + .av-toggle-slider {
          background: var(--color-lime);
        }
        .av-toggle-wrap input:checked + .av-toggle-slider::before {
          transform: translateX(24px);
        }
        .av-toggle-label {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .av-toggle-badge {
          display: inline-block;
          padding: .15rem .6rem;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
        }
        .av-toggle-badge.on  { background: var(--color-warning-bg); color: var(--color-warning); }
        .av-toggle-badge.off { background: var(--bg-elevated); color: var(--text-muted); }

        /* ── حقول ── */
        .av-field { margin-bottom: var(--space-4); }
        .av-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }
        .av-input, .av-select, .av-textarea {
          width: 100%;
          padding: .55rem .85rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-family: 'Tajawal', sans-serif;
          color: var(--text-primary);
          background: var(--bg-base);
          transition: border-color .18s, box-shadow .18s;
          text-align: right;
          outline: none;
        }
        .av-input:focus, .av-select:focus, .av-textarea:focus {
          border-color: var(--border-active);
          box-shadow: 0 0 0 3px var(--color-lime-glow);
        }
        .av-textarea { resize: vertical; min-height: 90px; }

        /* ── بانر المعاينة ── */
        .av-preview-banner {
          width: 100%;
          padding: var(--space-4) var(--space-5);
          background: var(--bg-sidebar);
          border: 1px solid var(--border-sidebar);
          border-radius: var(--radius-lg);
          color: var(--color-lime-dim);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          margin-top: var(--space-4);
          text-align: center;
          line-height: 1.6;
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: .3rem;
          transition: all .3s ease;
        }
        .av-preview-banner-sub {
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--text-muted);
        }
        .av-preview-label {
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--text-muted);
          margin-bottom: var(--space-1);
        }

        /* ── أزرار ── */
        .av-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: var(--space-1);
          padding: .65rem 1.5rem;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          font-family: 'Tajawal', sans-serif;
          cursor: pointer; border: none;
          transition: all .18s;
        }
        .av-btn:disabled { opacity:.55; cursor:not-allowed; }
        .av-btn-primary {
          background: var(--color-lime);
          color: var(--text-on-lime);
        }
        .av-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px var(--color-lime-glow);
        }
        .av-btn-danger {
          background: var(--color-danger);
          color: #fff;
        }
        .av-btn-danger:hover:not(:disabled) { transform: translateY(-1px); opacity: .9; }
        .av-btn-ghost {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .av-btn-ghost:hover:not(:disabled) { background: var(--bg-base); }
        .av-save-msg {
          display: inline-block;
          margin-right: .75rem;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          padding: .3rem .75rem;
          border-radius: var(--radius-full);
        }
        .av-save-msg.ok  { background: var(--color-success-bg); color: var(--color-success); }
        .av-save-msg.err { background: var(--color-danger-bg);  color: var(--color-danger); }

        /* ── تنقل الأسبوع ── */
        .av-week-nav {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }
        .av-week-label {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .av-nav-btn {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 1.1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .15s;
        }
        .av-nav-btn:hover { border-color: var(--color-lime-dim); color: var(--color-lime); background: var(--color-lime-muted); }

        /* ── الشبكة ── */
        .av-grid-wrap { overflow-x: auto; }
        .av-grid {
          min-width: 720px;
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
          font-size: .82rem;
        }
        .av-grid th {
          background: var(--bg-sidebar);
          color: var(--color-lime-dim);
          padding: .55rem .5rem;
          text-align: center;
          font-weight: var(--font-bold);
          white-space: nowrap;
        }
        .av-grid th.court-header {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          text-align: right;
          padding-right: .75rem;
          width: 130px;
        }
        .av-grid td {
          padding: .35rem .4rem;
          vertical-align: top;
          border-bottom: 1px solid var(--border-subtle);
        }
        .av-grid tr:last-child td { border-bottom: none; }
        .av-grid .court-cell {
          background: var(--bg-elevated);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          padding: .5rem .75rem;
          white-space: nowrap;
          font-size: .84rem;
        }

        .av-slot-cell { display: flex; flex-direction: column; gap: 3px; }

        /* زر الفترة */
        .av-period-btn {
          display: block; width: 100%;
          padding: .28rem .4rem;
          border-radius: 5px;
          font-size: .72rem;
          font-family: 'Tajawal', sans-serif;
          font-weight: var(--font-semibold);
          border: none; cursor: pointer;
          transition: all .15s;
          text-align: center; white-space: nowrap;
        }
        /* متاح */
        .av-period-btn.available {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border: 1px solid var(--color-lime-dim);
        }
        .av-period-btn.available:hover {
          background: var(--color-lime-glow);
          transform: translateY(-1px);
        }
        /* محجوز من عميل */
        .av-period-btn.booked {
          background: var(--bg-elevated);
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
          cursor: pointer;
        }
        .av-period-btn.booked:hover {
          background: var(--color-info-bg);
          color: var(--color-info);
          border-color: var(--color-info);
        }
        /* محجوب من مدير */
        .av-period-btn.admin-blocked {
          background: var(--color-danger-bg);
          color: var(--color-danger);
          border: 1px solid rgba(224,85,85,.35);
        }
        .av-period-btn.admin-blocked:hover {
          opacity: .85;
          transform: translateY(-1px);
        }

        /* مؤشر التحميل */
        .av-grid-overlay { position: relative; }
        .av-loading-overlay {
          position: absolute; inset: 0;
          background: var(--bg-overlay);
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-xl); z-index: 10;
        }
        .av-spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--border-color);
          border-top-color: var(--color-lime);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* مودال */
        .av-modal-overlay {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: fadeIn .2s ease;
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .av-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          width: 100%; max-width: 420px;
          box-shadow: var(--shadow-lg);
          animation: fadeIn .25s ease;
        }
        .av-modal-title {
          font-size: var(--text-lg);
          font-weight: var(--font-black);
          color: var(--text-primary);
          margin-bottom: var(--space-4);
        }
        .av-modal-btns {
          display: flex; gap: var(--space-2);
          margin-top: var(--space-5);
          justify-content: flex-end;
        }

        /* Toast */
        .av-toast {
          position: fixed; top: var(--space-5); left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: var(--space-2) var(--space-5);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm); font-weight: var(--font-bold);
          font-family: 'Tajawal', sans-serif;
          animation: fadeIn .3s ease;
          box-shadow: var(--shadow-lg);
          white-space: nowrap;
        }
        .av-toast.ok  { background: var(--color-success-bg); color: var(--color-lime); border: 1px solid var(--color-lime-dim); }
        .av-toast.err { background: var(--color-danger-bg);  color: var(--color-danger); border: 1px solid rgba(224,85,85,.35); }

        .av-fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media(max-width:640px) { .av-fields-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`av-toast ${toast.type}`}>{toast.text}</div>
      )}

      <div className="av-page">
        <h1 className="av-page-title">إدارة التوافر</h1>
        <p className="av-page-sub">تحكّم في الإغلاق الكامل وحجب الفترات الأسبوعية</p>

        {/* ══════════════════════════════════════
            القسم 1: الإغلاق الكامل
            ══════════════════════════════════════ */}
        <div className="av-card">
          <div className="av-card-title">الإغلاق الكامل للمنشأة</div>

          {/* Toggle */}
          <div className="av-toggle-row">
            <label className="av-toggle-wrap">
              <input
                type="checkbox"
                checked={closureActive}
                onChange={e => setClosureActive(e.target.checked)}
                id="toggle-closure"
              />
              <span className="av-toggle-slider" />
            </label>
            <span className="av-toggle-label">
              تفعيل الإغلاق الكامل
            </span>
            <span className={`av-toggle-badge ${closureActive ? 'on' : 'off'}`}>
              {closureActive ? 'مغلق' : 'مفتوح'}
            </span>
          </div>

          <div className="av-fields-grid">
            {/* سبب الإغلاق */}
            <div className="av-field">
              <label className="av-label" htmlFor="closure-reason">سبب الإغلاق</label>
              <select
                id="closure-reason"
                className="av-select"
                value={closureReason}
                onChange={e => setClosureReason(e.target.value)}
              >
                <option value="">-- اختر --</option>
                {CLOSURE_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* تاريخ العودة */}
            <div className="av-field">
              <label className="av-label" htmlFor="closure-return">تاريخ العودة المتوقع (اختياري)</label>
              <input
                id="closure-return"
                type="date"
                className="av-input"
                value={closureReturnDate}
                onChange={e => setClosureReturnDate(e.target.value)}
              />
            </div>
          </div>

          {/* رسالة العملاء */}
          <div className="av-field">
            <label className="av-label" htmlFor="closure-message">رسالة للعملاء</label>
            <textarea
              id="closure-message"
              className="av-textarea"
              value={closureMessage}
              onChange={e => setClosureMessage(e.target.value)}
              placeholder="مثال: المنشأة مغلقة حالياً بسبب الصيانة، سنعود قريباً..."
            />
          </div>

          {/* معاينة البانر */}
          <div className="av-preview-label">معاينة البانر كما سيراه العميل:</div>
          <div className="av-preview-banner">
            {closureMessage || closureReason ? (
              <>
                <span>{closureMessage || (closureReason ? `المنشأة مغلقة حالياً – ${closureReason}` : '')}</span>
                {closureReturnDate && (
                  <span className="av-preview-banner-sub">
                    📅 تاريخ العودة المتوقع: {new Date(closureReturnDate).toLocaleDateString('ar-SA')}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: 'rgba(201,169,110,.5)', fontWeight: 500 }}>
                أدخل رسالة لترى المعاينة هنا
              </span>
            )}
          </div>

          {/* زر الحفظ */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center' }}>
            <button
              id="btn-save-closure"
              className="av-btn av-btn-primary"
              onClick={saveClosureSettings}
              disabled={closureSaving}
            >
              {closureSaving ? 'جاري الحفظ...' : 'حفظ إعدادات الإغلاق'}
            </button>
            {closureMsg && (
              <span className={`av-save-msg ${closureMsg.type}`}>{closureMsg.text}</span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            القسم 2: شبكة التوافر الأسبوعية
            ══════════════════════════════════════ */}
        <div className="av-card">
          <div className="av-card-title">التوافر الأسبوعي</div>

          {/* تنقل الأسبوع */}
          <div className="av-week-nav">
            <button
              id="btn-prev-week"
              className="av-nav-btn"
              onClick={() => setWeekStart(d => addDays(d, -7))}
              aria-label="الأسبوع السابق"
            >›</button>
            <span className="av-week-label">
              {formatDateAr(weekStart)} – {formatDateAr(addDays(weekStart, 6))}
              &nbsp;
              <span style={{ color:'#7a8a99', fontWeight:500, fontSize:'.85rem' }}>
                {weekStart.getFullYear()}
              </span>
            </span>
            <button
              id="btn-next-week"
              className="av-nav-btn"
              onClick={() => setWeekStart(d => addDays(d, 7))}
              aria-label="الأسبوع التالي"
            >‹</button>
          </div>

          {/* مفتاح الألوان */}
          <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            {[
              { cls:'available',     label:'متاح' },
              { cls:'booked',        label:'محجوز (عميل)' },
              { cls:'admin-blocked', label:'محجوب (مدير)' },
            ].map(({ cls, label }) => (
              <div key={cls} style={{ display:'flex', alignItems:'center', gap:'.35rem', fontSize:'.8rem' }}>
                <span
                  className={`av-period-btn ${cls}`}
                  style={{ width:40, height:22, display:'inline-block', borderRadius:4 }}
                />
                <span style={{ color:'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* الشبكة */}
          <div className="av-grid-wrap av-grid-overlay" style={{ position:'relative' }}>
            {gridLoading && (
              <div className="av-loading-overlay">
                <div className="av-spinner" />
              </div>
            )}
            <table className="av-grid">
              <thead>
                <tr>
                  <th className="court-header">الملعب</th>
                  {weekDays.map((d, i) => (
                    <th key={i}>
                      <div>{AR_DAYS[d.getDay()]}</div>
                        <div style={{ fontSize:'.72rem', fontWeight:500, color:'var(--text-muted)' }}>
                        {formatDateAr(d)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COURTS.map(court => (
                  <tr key={court.id}>
                    <td className="court-cell">
                      <span style={{ fontSize:'1.1rem' }}>{court.icon}</span>{' '}
                      {court.label}
                    </td>
                    {weekDays.map((day, di) => {
                      const dateStr = toISO(day)
                      return (
                        <td key={di}>
                          <div className="av-slot-cell">
                            {PERIODS.map(period => {
                              const blocked = getBlocked(court.id, dateStr, period.num)
                              const booked  = isBooked(court.id, dateStr, period.num)

                              let cls = 'available'
                              if (blocked) cls = 'admin-blocked'
                              else if (booked) cls = 'booked'

                              return (
                                <button
                                  key={period.num}
                                  id={`slot-${court.id}-${dateStr}-${period.num}`}
                                  className={`av-period-btn ${cls}`}
                                  title={
                                    blocked ? `محجوب: ${blocked.reason ?? ''}` :
                                    booked  ? 'انقر لعرض تفاصيل الحجز' :
                                    'انقر لحجز سريع أو حجب'
                                  }
                                  onClick={() => {
                                    if (blocked) {
                                      setUnblockTarget(blocked)
                                    } else if (booked) {
                                      openBookedSlot(court.id, dateStr, period.num)
                                    } else {
                                      setSlotChoiceTarget({ court_id: court.id, date: dateStr, period_number: period.num })
                                    }
                                  }}
                                >
                                  {period.label}
                                  {blocked && <span style={{ fontSize:'.65rem', display:'block', color:'var(--color-danger)' }}>■</span>}
                                  {booked  && <span style={{ fontSize:'.65rem', display:'block', color:'var(--text-muted)', opacity:.7 }}>●</span>}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginTop:'.75rem' }}>
            انقر على خلية متاحة للحجز السريع أو الحجب، وعلى خلية محجوزة لعرض التفاصيل أو الإلغاء.
          </p>
        </div>
      </div>

      {/* ══════════ مودال الحجب ══════════ */}
      {blockTarget && (
        <div className="av-modal-overlay" onClick={() => setBlockTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-title">حجب الفترة</div>

            <div className="av-field">
              <label className="av-label">
                {COURTS.find(c => c.id === blockTarget.court_id)?.icon}{' '}
                {COURTS.find(c => c.id === blockTarget.court_id)?.label}
                {' — '}
                {PERIODS.find(p => p.num === blockTarget.period_number)?.label}
                {' — '}
                {AR_DAYS[new Date(blockTarget.date + 'T00:00:00').getDay()]}{' '}
                {formatDateAr(new Date(blockTarget.date + 'T00:00:00'))}
              </label>
            </div>

            <div className="av-field">
              <label className="av-label" htmlFor="block-reason-select">سبب الحجب</label>
              <select
                id="block-reason-select"
                className="av-select"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
              >
                {BLOCK_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="av-modal-btns">
              <button
                className="av-btn av-btn-ghost"
                onClick={() => setBlockTarget(null)}
                disabled={blockSaving}
              >
                إلغاء
              </button>
              <button
                id="btn-confirm-block"
                className="av-btn av-btn-danger"
                onClick={handleBlock}
                disabled={blockSaving}
              >
                {blockSaving ? 'جاري...' : 'تأكيد الحجب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ مودال فكّ الحجب ══════════ */}
      {unblockTarget && (
        <div className="av-modal-overlay" onClick={() => setUnblockTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-title">إلغاء حجب الفترة</div>
            <p style={{ color:'var(--text-secondary)', fontSize:'.9rem', margin:'0 0 .5rem' }}>
              هل تريد إلغاء حجب هذه الفترة؟
            </p>
            <div style={{
              background:'var(--color-warning-bg)', border:'1px solid rgba(245,166,35,.35)', borderRadius:8,
              padding:'.75rem', fontSize:'.88rem', color:'var(--color-warning)',
            }}>
              <strong>
                {COURTS.find(c => c.id === unblockTarget.court_id)?.icon}{' '}
                {COURTS.find(c => c.id === unblockTarget.court_id)?.label}
              </strong>
              {' — '}
              {PERIODS.find(p => p.num === unblockTarget.period_number)?.label}
              {' — '}
              {AR_DAYS[new Date(unblockTarget.date + 'T00:00:00').getDay()]}{' '}
              {formatDateAr(new Date(unblockTarget.date + 'T00:00:00'))}
              {unblockTarget.reason && (
                <div style={{ marginTop:'.35rem', color:'var(--color-warning)', fontSize:'.82rem', opacity: .8 }}>
                  السبب: {unblockTarget.reason}
                </div>
              )}
            </div>
            <div className="av-modal-btns">
              <button
                className="av-btn av-btn-ghost"
                onClick={() => setUnblockTarget(null)}
                disabled={unblockSaving}
              >
                إلغاء
              </button>
              <button
                id="btn-confirm-unblock"
                className="av-btn av-btn-primary"
                onClick={handleUnblock}
                disabled={unblockSaving}
              >
                {unblockSaving ? 'جاري...' : 'تأكيد إلغاء الحجب'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════ مودال اختيار الإجراء (خلية متاحة) ══════════ */}
      {slotChoiceTarget && (
        <div className="av-modal-overlay" onClick={() => setSlotChoiceTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="av-modal-title">اختر الإجراء</div>
            <div style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              {COURTS.find(c => c.id === slotChoiceTarget.court_id)?.icon}{' '}
              {COURTS.find(c => c.id === slotChoiceTarget.court_id)?.label}
              {' — '}
              {PERIODS.find(p => p.num === slotChoiceTarget.period_number)?.label}
              {' — '}
              {AR_DAYS[new Date(slotChoiceTarget.date + 'T00:00:00').getDay()]}{' '}
              {formatDateAr(new Date(slotChoiceTarget.date + 'T00:00:00'))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              <button
                id="btn-choice-quickbook"
                className="av-btn av-btn-primary"
                style={{ width:'100%', justifyContent:'center' }}
                onClick={() => openQuickBook(slotChoiceTarget)}
              >
                ⚡ حجز سريع
              </button>
              <button
                id="btn-choice-block"
                className="av-btn av-btn-danger"
                style={{ width:'100%', justifyContent:'center' }}
                onClick={() => {
                  setBlockTarget({ court_id: slotChoiceTarget.court_id, date: slotChoiceTarget.date, period_number: slotChoiceTarget.period_number })
                  setBlockReason('صيانة')
                  setSlotChoiceTarget(null)
                }}
              >
                🚫 حجب الفترة
              </button>
              <button className="av-btn av-btn-ghost" style={{ width:'100%' }} onClick={() => setSlotChoiceTarget(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ مودال الحجز السريع ══════════ */}
      {quickBookTarget && (
        <div className="av-modal-overlay" onClick={() => setQuickBookTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()} style={{
            maxWidth: 440, padding: 'var(--space-5)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div className="av-modal-title" style={{ marginBottom: '.6rem' }}>⚡ حجز سريع</div>

            {/* شريط الفترة */}
            <div style={{
              background:'var(--bg-elevated)', borderRadius:7, padding:'.45rem .8rem',
              fontSize:'.82rem', color:'var(--text-secondary)', marginBottom:'.75rem',
              display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap',
            }}>
              <span>{COURTS.find(c => c.id === quickBookTarget.court_id)?.icon}</span>
              <span style={{ fontWeight:600, color:'var(--text-primary)' }}>
                {COURTS.find(c => c.id === quickBookTarget.court_id)?.label}
              </span>
              <span style={{ opacity:.5 }}>•</span>
              <span>{PERIODS.find(p => p.num === quickBookTarget.period_number)?.label}</span>
              <span style={{ opacity:.5 }}>•</span>
              <span>{AR_DAYS[new Date(quickBookTarget.date + 'T00:00:00').getDay()]}</span>
              <span>{formatDateAr(new Date(quickBookTarget.date + 'T00:00:00'))}</span>
            </div>

            {/* رقم الجوال + بحث */}
            <div style={{ marginBottom:'.5rem' }}>
              <label className="av-label" htmlFor="qb-phone">رقم الجوال</label>
              <div style={{ display:'flex', gap:'.4rem' }}>
                <input
                  id="qb-phone"
                  className="av-input"
                  type="tel"
                  placeholder="05XXXXXXXX"
                  value={qbPhone}
                  onChange={e => { setQbPhone(e.target.value); setQbCustomer(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchCustomer()}
                  dir="ltr"
                  style={{ flex:1 }}
                />
                <button
                  id="btn-qb-search"
                  className="av-btn av-btn-ghost"
                  onClick={searchCustomer}
                  disabled={qbSearching || !qbPhone.trim()}
                  style={{ whiteSpace:'nowrap', padding:'.4rem .8rem', fontSize:'.82rem' }}
                >
                  {qbSearching ? '...' : '🔍 بحث'}
                </button>
              </div>
            </div>

            {/* نتيجة البحث */}
            {qbCustomer && (
              <div style={{
                padding:'.4rem .75rem', borderRadius:6, marginBottom:'.5rem', fontSize:'.83rem',
                ...(qbCustomer.is_suspended
                  ? { background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(224,85,85,.3)' }
                  : qbCustomer.found
                    ? { background:'var(--color-lime-muted)', color:'var(--color-lime)', border:'1px solid var(--color-lime-dim)' }
                    : { background:'var(--bg-elevated)', color:'var(--text-secondary)', border:'1px solid var(--border-color)' }
                ),
              }}>
                {qbCustomer.is_suspended
                  ? `⚠️ العميل موقوف — ${qbCustomer.suspension_reason ?? 'بدون سبب محدد'}`
                  : qbCustomer.found
                    ? `✓ مرحباً ${qbCustomer.name}`
                    : 'عميل جديد — أدخل الاسم'}
              </div>
            )}

            {/* الاسم */}
            <div style={{ marginBottom:'.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.2rem' }}>
                <label className="av-label" htmlFor="qb-name" style={{ marginBottom:0 }}>الاسم</label>
                {qbCustomer?.found && !qbNameEditable && (
                  <button
                    style={{ fontSize:'.75rem', color:'var(--color-lime)', background:'none', border:'none', cursor:'pointer' }}
                    onClick={() => setQbNameEditable(true)}
                  >تعديل</button>
                )}
              </div>
              <input
                id="qb-name"
                className="av-input"
                placeholder="اسم العميل"
                value={qbName}
                onChange={e => setQbName(e.target.value)}
                readOnly={!qbNameEditable && !!qbCustomer?.found}
              />
            </div>

            {/* حالة التأكيد */}
            <div style={{ marginBottom:'.6rem' }}>
              <label className="av-label">حالة التأكيد</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.4rem' }}>
                {([['confirmed','✅ مؤكد (مدفوع)'],['pending','⏳ بانتظار الإيصال']] as const).map(([val, lbl]) => (
                  <label key={val} style={{
                    display:'flex', alignItems:'center', gap:'.4rem',
                    padding:'.45rem .7rem', borderRadius:6, cursor:'pointer',
                    border: qbStatus === val ? '1px solid var(--color-lime-dim)' : '1px solid var(--border-color)',
                    background: qbStatus === val ? 'var(--color-lime-muted)' : 'var(--bg-elevated)',
                    fontSize:'.82rem', color: qbStatus === val ? 'var(--color-lime)' : 'var(--text-secondary)',
                  }}>
                    <input type="radio" name="qb-status" value={val} checked={qbStatus === val}
                      onChange={() => setQbStatus(val)} style={{ display:'none' }} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {/* كود الخصم + المياه في صف واحد */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem', marginBottom:'.6rem' }}>
              <div>
                <label className="av-label" htmlFor="qb-code">كود خصم (اختياري)</label>
                <input
                  id="qb-code"
                  className="av-input"
                  placeholder="SUMMER25"
                  value={qbCode}
                  onChange={e => setQbCode(e.target.value.toUpperCase())}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="av-label" htmlFor="qb-water">المياه (كراتين)</label>
                <input
                  id="qb-water"
                  className="av-input"
                  type="number"
                  min={0}
                  value={qbWater}
                  onChange={e => setQbWater(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            {/* السعر */}
            {qbPrice && (
              <div style={{
                background:'var(--bg-elevated)', border:'1px solid var(--border-color)',
                borderRadius:7, padding:'.5rem .8rem', fontSize:'.82rem',
                color:'var(--text-secondary)', marginBottom:'.6rem',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>السعر الأصلي</span><span>{qbPrice.base_price} ر.س</span>
                </div>
                {qbPrice.discount_amount > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', color:'var(--color-danger)' }}>
                    <span>الخصم</span><span>-{qbPrice.discount_amount} ر.س</span>
                  </div>
                )}
                <div style={{
                  display:'flex', justifyContent:'space-between',
                  fontWeight:700, color:'var(--text-primary)',
                  marginTop:'.3rem', borderTop:'1px solid var(--border-subtle)', paddingTop:'.3rem',
                }}>
                  <span>المبلغ النهائي</span><span>{qbPrice.final_price} ر.س</span>
                </div>
              </div>
            )}

            <div className="av-modal-btns" style={{ marginTop:'.6rem' }}>
              <button className="av-btn av-btn-ghost" onClick={() => setQuickBookTarget(null)} disabled={qbSaving}>إلغاء</button>
              <button
                id="btn-confirm-quickbook"
                className="av-btn av-btn-primary"
                onClick={handleQuickBook}
                disabled={qbSaving || !qbPhone.trim() || !qbName.trim()}
              >
                {qbSaving ? 'جاري...' : '✓ تأكيد الحجز'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ مودال تفاصيل الحجز (خلية محجوزة) ══════════ */}
      {(bookingDetail || bookingDetailLoading) && (
        <div className="av-modal-overlay" onClick={() => { setBookingDetail(null); setCancelMode(false) }}>
          <div className="av-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            {bookingDetailLoading ? (
              <div style={{ textAlign:'center', padding:'2rem' }}>
                <div className="av-spinner" style={{ margin:'0 auto' }} />
              </div>
            ) : bookingDetail ? (
              <>
                <div className="av-modal-title">تفاصيل الحجز</div>

                {/* تفاصيل الفترة */}
                <div style={{
                  background:'var(--bg-elevated)', borderRadius:8, padding:'.65rem .9rem',
                  fontSize:'.85rem', color:'var(--text-secondary)', marginBottom:'1rem',
                }}>
                  {COURTS.find(c => c.id === bookingDetail.court_id)?.icon}{' '}
                  {COURTS.find(c => c.id === bookingDetail.court_id)?.label}
                  {' — '}
                  {PERIODS.find(p => p.num === bookingDetail.period_number)?.label}
                  {' — '}
                  {AR_DAYS[new Date(bookingDetail.booking_date + 'T00:00:00').getDay()]}{' '}
                  {formatDateAr(new Date(bookingDetail.booking_date + 'T00:00:00'))}
                </div>

                {/* بيانات العميل */}
                <div style={{
                  background:'var(--bg-elevated)', border:'1px solid var(--border-color)',
                  borderRadius:8, padding:'.7rem .9rem', marginBottom:'.75rem',
                }}>
                  <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'.9rem', marginBottom:'.25rem' }}>
                    👤 {bookingDetail.customer_name}
                  </div>
                  <div style={{ color:'var(--text-secondary)', fontSize:'.83rem' }} dir="ltr">
                    📱 {bookingDetail.customer_phone}
                  </div>
                  {bookingDetail.is_manual && (
                    <div style={{ color:'var(--color-info)', fontSize:'.78rem', marginTop:'.25rem' }}>حجز يدوي</div>
                  )}
                </div>

                {/* الفاتورة */}
                <div style={{
                  border:'1px solid var(--border-color)', borderRadius:8,
                  overflow:'hidden', marginBottom:'.75rem', fontSize:'.85rem',
                }}>
                  {[
                    ['السعر الأصلي', `${bookingDetail.base_price} ر.س`],
                    ...(bookingDetail.discount_amount > 0 ? [[`الخصم${bookingDetail.code_used ? ` (${bookingDetail.code_used})` : ''}`, `-${bookingDetail.discount_amount} ر.س`]] : []),
                    ...(bookingDetail.water_quantity > 0 ? [[`مياه (${bookingDetail.water_quantity} كرتون)`, `${bookingDetail.water_quantity * 10} ر.س`]] : []),
                  ].map(([k, v], i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .9rem', borderBottom:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
                      <span>{k}</span><span>{v}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'.6rem .9rem', fontWeight:700, color:'var(--text-primary)', background:'var(--bg-elevated)' }}>
                    <span>المبلغ النهائي</span><span>{bookingDetail.final_price} ر.س</span>
                  </div>
                </div>

                {/* الحالة */}
                <div style={{ marginBottom:'1rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
                  <span style={{ fontSize:'.83rem', color:'var(--text-secondary)' }}>الحالة:</span>
                  <span style={{
                    padding:'.2rem .7rem', borderRadius:20, fontSize:'.8rem', fontWeight:700,
                    ...(bookingDetail.status === 'confirmed'
                      ? { background:'var(--color-lime-muted)', color:'var(--color-lime)', border:'1px solid var(--color-lime-dim)' }
                      : { background:'var(--color-warning-bg)', color:'var(--color-warning)', border:'1px solid rgba(245,166,35,.35)' }
                    ),
                  }}>
                    {bookingDetail.status === 'confirmed' ? '🟢 مؤكد' : '🟡 بانتظار الإيصال'}
                  </span>
                </div>

                {/* وضع الإلغاء */}
                {cancelMode ? (
                  <>
                    <div className="av-field">
                      <label className="av-label" htmlFor="cancel-reason">سبب الإلغاء (اختياري)</label>
                      <input
                        id="cancel-reason"
                        className="av-input"
                        placeholder="أدخل سبب الإلغاء..."
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                      />
                    </div>
                    <div className="av-modal-btns">
                      <button className="av-btn av-btn-ghost" onClick={() => setCancelMode(false)} disabled={cancelSaving}>تراجع</button>
                      <button
                        id="btn-confirm-cancel"
                        className="av-btn av-btn-danger"
                        onClick={handleCancelBooking}
                        disabled={cancelSaving}
                      >
                        {cancelSaving ? 'جاري...' : 'تأكيد الإلغاء'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="av-modal-btns">
                    <button className="av-btn av-btn-ghost" onClick={() => setBookingDetail(null)}>إغلاق</button>
                    <button
                      id="btn-open-booking-detail"
                      className="av-btn av-btn-ghost"
                      onClick={() => window.open(`/admin/bookings/${bookingDetail.id}`, '_blank')}
                    >
                      ✏️ تعديل كامل
                    </button>
                    <button
                      id="btn-start-cancel"
                      className="av-btn av-btn-danger"
                      onClick={() => setCancelMode(true)}
                    >
                      🗑 إلغاء
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════
         قسم إيقافات الملاعب
         ═══════════════════════════════════════════════════════ */}
      <div style={{
        marginTop:'2.5rem', padding:'var(--space-5)',
        background:'var(--bg-surface)',
        border:'1px solid var(--border-color)', borderRadius:'var(--radius-xl)',
      }}>
        <h2 style={{ fontSize:'var(--text-lg)', marginBottom:'var(--space-4)', color:'var(--text-primary)', fontWeight:'var(--font-black)' }}>
          إيقافات الملاعب
        </h2>
        <p style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginBottom:'var(--space-4)' }}>
          أوقف ملعب لفترة زمنية (صيانة/فعالية). الإيقافات المنتهية تبقى كسجل تاريخي.
        </p>

        {/* نموذج إضافة إيقاف */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:'var(--space-3)',
          alignItems:'end', marginBottom:'var(--space-4)', padding:'var(--space-4)',
          background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-color)',
        }}>
          <div>
            <label style={{ display:'block', fontSize:'var(--text-xs)', fontWeight:'var(--font-bold)', marginBottom:'0.3rem', color:'var(--text-secondary)' }}>الملعب</label>
            <select className="input" value={vcForm.court_id}
              onChange={e => setVcForm(f => ({ ...f, court_id: e.target.value }))}>
              {COURTS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'var(--text-xs)', fontWeight:'var(--font-bold)', marginBottom:'0.3rem', color:'var(--text-secondary)' }}>من تاريخ</label>
            <input type="date" className="input" value={vcForm.start_date}
              onChange={e => setVcForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'var(--text-xs)', fontWeight:'var(--font-bold)', marginBottom:'0.3rem', color:'var(--text-secondary)' }}>إلى تاريخ</label>
            <input type="date" className="input" value={vcForm.end_date}
              onChange={e => setVcForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'var(--text-xs)', fontWeight:'var(--font-bold)', marginBottom:'0.3rem', color:'var(--text-secondary)' }}>السبب</label>
            <select className="input" value={vcForm.reason}
              onChange={e => setVcForm(f => ({ ...f, reason: e.target.value }))}>
              {CLOSURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="av-btn av-btn-primary" onClick={addClosure} disabled={vcSaving}
            style={{ height:'2.5rem', whiteSpace:'nowrap' }}>
            {vcSaving ? 'جاري...' : '+ إضافة'}
          </button>
        </div>

        {/* جدول الإيقافات */}
        {venueClosures.length === 0 ? (
          <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'1.5rem', fontSize:'var(--text-sm)' }}>
            لا توجد إيقافات حالياً
          </p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
              <thead>
                <tr style={{ background:'var(--bg-elevated)', textAlign:'right' }}>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>الملعب</th>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>من</th>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>إلى</th>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>السبب</th>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>الحالة</th>
                  <th style={{ padding:'0.6rem 0.75rem', fontWeight:700 }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {venueClosures.map(vc => {
                  const today = toISO(new Date())
                  const isActive = vc.start_date <= today && vc.end_date >= today
                  const isExpired = vc.end_date < today
                  const court = COURTS.find(c => c.id === vc.court_id)
                  return (
                    <tr key={vc.id} style={{
                      borderBottom:'1px solid var(--border-subtle)',
                      opacity: isExpired ? 0.5 : 1,
                      background: isActive ? 'var(--color-danger-bg)' : 'transparent',
                    }}>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {court?.icon} {court?.label ?? vc.court_id}
                      </td>
                      <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.82rem' }}>{vc.start_date}</td>
                      <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.82rem' }}>{vc.end_date}</td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>{vc.reason ?? '—'}</td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {isActive ? (
                          <span className="badge badge-rejected">نشط</span>
                        ) : isExpired ? (
                          <span className="badge badge-cancelled">منتهي</span>
                        ) : (
                          <span className="badge badge-pending">قادم</span>
                        )}
                      </td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {!isExpired && (
                          <button className="av-btn av-btn-ghost" style={{ fontSize:'var(--text-xs)', color:'var(--color-danger)' }}
                            onClick={() => deleteClosure(vc.id)}>
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </>
  )
}
