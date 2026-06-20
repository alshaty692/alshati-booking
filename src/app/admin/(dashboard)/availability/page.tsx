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
  return date.toISOString().slice(0, 10)
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
        /* ── متغيرات اللون ── */
        :root {
          --av-navy:  #1B2A3B;
          --av-green: #2D5C4E;
          --av-gold:  #C9A96E;
          --av-beige: #F5F2EC;
          --av-card-border: 0.5px solid #E2DDD4;
          --av-card-radius: 14px;
        }

        .av-page {
          font-family: 'Tajawal', sans-serif;
          color: #1B2A3B;
          max-width: 1100px;
          margin: 0 auto;
          animation: fadeIn .35s ease both;
        }

        /* ── العنوان ── */
        .av-page-title {
          font-size: 1.65rem;
          font-weight: 800;
          color: #1B2A3B;
          margin-bottom: .25rem;
        }
        .av-page-sub {
          color: #7a8a99;
          font-size: .88rem;
          margin-bottom: 2rem;
        }

        /* ── بطاقة ── */
        .av-card {
          background: #fff;
          border: var(--av-card-border);
          border-radius: var(--av-card-radius);
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 4px rgba(27,42,59,.06);
        }
        .av-card-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #1B2A3B;
          margin-bottom: 1.1rem;
          display: flex;
          align-items: center;
          gap: .5rem;
        }

        /* ── Toggle ── */
        .av-toggle-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.2rem;
        }
        .av-toggle-wrap {
          position: relative;
          display: inline-block;
          width: 56px;
          height: 30px;
        }
        .av-toggle-wrap input { opacity: 0; width:0; height:0; }
        .av-toggle-slider {
          position: absolute;
          inset: 0;
          border-radius: 30px;
          background: #d1d5db;
          transition: background .25s;
          cursor: pointer;
        }
        .av-toggle-slider::before {
          content:'';
          position: absolute;
          left: 4px; top: 4px;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,.18);
          transition: transform .25s;
        }
        .av-toggle-wrap input:checked + .av-toggle-slider {
          background: #C9A96E;
        }
        .av-toggle-wrap input:checked + .av-toggle-slider::before {
          transform: translateX(26px);
        }
        .av-toggle-label {
          font-size: 1rem;
          font-weight: 700;
          color: #1B2A3B;
        }
        .av-toggle-badge {
          display: inline-block;
          padding: .15rem .6rem;
          border-radius: 99px;
          font-size: .78rem;
          font-weight: 700;
        }
        .av-toggle-badge.on  { background:#fef3c7; color:#92400e; }
        .av-toggle-badge.off { background:#f1f5f9; color:#64748b; }

        /* ── حقول الإدخال ── */
        .av-field {
          margin-bottom: 1rem;
        }
        .av-label {
          display: block;
          font-size: .85rem;
          font-weight: 600;
          color: #3d5466;
          margin-bottom: .35rem;
        }
        .av-input, .av-select, .av-textarea {
          width: 100%;
          padding: .55rem .85rem;
          border: 1.5px solid #e0dbd2;
          border-radius: 8px;
          font-size: .95rem;
          font-family: 'Tajawal', sans-serif;
          color: #1B2A3B;
          background: #fff;
          transition: border-color .18s;
          text-align: right;
        }
        .av-input:focus, .av-select:focus, .av-textarea:focus {
          outline: none;
          border-color: #2D5C4E;
          box-shadow: 0 0 0 3px rgba(45,92,78,.1);
        }
        .av-textarea { resize: vertical; min-height: 90px; }

        /* ── بانر المعاينة ── */
        .av-preview-banner {
          width: 100%;
          padding: 1rem 1.5rem;
          background: #2D5C4E;
          border-radius: 10px;
          color: #C9A96E;
          font-size: 1rem;
          font-weight: 700;
          margin-top: 1.25rem;
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
          font-size: .82rem;
          font-weight: 500;
          color: rgba(201,169,110,.75);
        }
        .av-preview-label {
          font-size: .78rem;
          font-weight: 600;
          color: #7a8a99;
          margin-bottom: .4rem;
        }

        /* ── زر الحفظ ── */
        .av-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .45rem;
          padding: .65rem 1.5rem;
          border-radius: 9px;
          font-size: .92rem;
          font-weight: 700;
          font-family: 'Tajawal', sans-serif;
          cursor: pointer;
          border: none;
          transition: all .18s;
        }
        .av-btn:disabled { opacity: .55; cursor: not-allowed; }
        .av-btn-primary {
          background: linear-gradient(135deg, #2D5C4E, #1f4035);
          color: #fff;
        }
        .av-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(45,92,78,.35);
        }
        .av-btn-danger {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
        }
        .av-btn-danger:hover:not(:disabled) { transform: translateY(-1px); }
        .av-btn-ghost {
          background: #f5f2ec;
          color: #3d5466;
          border: 1px solid #e2ddd4;
        }
        .av-btn-ghost:hover:not(:disabled) { background: #ece8e1; }
        .av-save-msg {
          display: inline-block;
          margin-right: .75rem;
          font-size: .85rem;
          font-weight: 600;
          padding: .3rem .75rem;
          border-radius: 99px;
        }
        .av-save-msg.ok  { background:#d1fae5; color:#065f46; }
        .av-save-msg.err { background:#fee2e2; color:#991b1b; }

        /* ── تنقل الأسبوع ── */
        .av-week-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }
        .av-week-label {
          font-size: 1rem;
          font-weight: 700;
          color: #1B2A3B;
        }
        .av-nav-btn {
          width: 36px; height: 36px;
          border-radius: 8px;
          border: 1px solid #e2ddd4;
          background: #fff;
          color: #1B2A3B;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .15s;
        }
        .av-nav-btn:hover { background: #f0ece5; border-color: #C9A96E; color: #C9A96E; }

        /* ── الشبكة ── */
        .av-grid-wrap {
          overflow-x: auto;
        }
        .av-grid {
          min-width: 720px;
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
          font-size: .82rem;
        }
        .av-grid th {
          background: #1B2A3B;
          color: #C9A96E;
          padding: .55rem .5rem;
          text-align: center;
          font-weight: 700;
          white-space: nowrap;
        }
        .av-grid th.court-header {
          background: #1f3347;
          color: #F5F2EC;
          text-align: right;
          padding-right: .75rem;
          width: 130px;
        }
        .av-grid td {
          padding: .35rem .4rem;
          vertical-align: top;
          border-bottom: 1px solid #f0ece5;
        }
        .av-grid tr:last-child td { border-bottom: none; }
        .av-grid .court-cell {
          background: #f8f5ef;
          font-weight: 700;
          color: #1B2A3B;
          padding: .5rem .75rem;
          white-space: nowrap;
          font-size: .84rem;
        }

        /* ── خلية الفترة ── */
        .av-slot-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        /* ── زر الفترة ── */
        .av-period-btn {
          display: block;
          width: 100%;
          padding: .28rem .4rem;
          border-radius: 5px;
          font-size: .72rem;
          font-family: 'Tajawal', sans-serif;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all .15s;
          text-align: center;
          white-space: nowrap;
        }
        /* متاح = أخضر */
        .av-period-btn.available {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }
        .av-period-btn.available:hover {
          background: #bbf7d0;
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(22,101,52,.2);
        }
        /* محجوز من عميل = رمادي غير قابل للضغط */
        .av-period-btn.booked {
          background: #f1f5f9;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
          cursor: not-allowed;
        }
        /* محجوب من مدير = أحمر/برتقالي */
        .av-period-btn.admin-blocked {
          background: #fff1f0;
          color: #c0392b;
          border: 1px solid #f5a8a0;
        }
        .av-period-btn.admin-blocked:hover {
          background: #ffe4e1;
          transform: translateY(-1px);
        }

        /* ── مؤشر التحميل ── */
        .av-grid-overlay {
          position: relative;
        }
        .av-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(245,242,236,.7);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--av-card-radius);
          z-index: 10;
        }
        .av-spinner {
          width: 32px; height: 32px;
          border: 3px solid #e2ddd4;
          border-top-color: #2D5C4E;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── مودال ── */
        .av-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn .2s ease;
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .av-modal {
          background: #fff;
          border-radius: 16px;
          padding: 1.75rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(27,42,59,.25);
          animation: fadeIn .25s ease;
        }
        .av-modal-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #1B2A3B;
          margin-bottom: 1.1rem;
        }
        .av-modal-btns {
          display: flex;
          gap: .65rem;
          margin-top: 1.3rem;
          justify-content: flex-end;
        }

        /* ── Toast ── */
        .av-toast {
          position: fixed;
          top: 1.25rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: .7rem 1.5rem;
          border-radius: 10px;
          font-size: .9rem;
          font-weight: 700;
          font-family: 'Tajawal', sans-serif;
          animation: fadeIn .3s ease;
          box-shadow: 0 8px 24px rgba(0,0,0,.2);
          white-space: nowrap;
        }
        .av-toast.ok  { background: #065f46; color:#d1fae5; border-right: 4px solid #10b981; }
        .av-toast.err { background: #7f1d1d; color:#fee2e2; border-right: 4px solid #ef4444; }

        /* ── شبكة الحقول ── */
        .av-fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media(max-width:640px) { .av-fields-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`av-toast ${toast.type}`}>{toast.text}</div>
      )}

      <div className="av-page">
        <h1 className="av-page-title">🔒 إدارة التوافر</h1>
        <p className="av-page-sub">تحكّم في الإغلاق الكامل وحجب الفترات الأسبوعية</p>

        {/* ══════════════════════════════════════
            القسم 1: الإغلاق الكامل
            ══════════════════════════════════════ */}
        <div className="av-card">
          <div className="av-card-title">🚫 الإغلاق الكامل للمنشأة</div>

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
              {closureActive ? '🔴 مغلق' : '🟢 مفتوح'}
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
          <div className="av-preview-label">📺 معاينة البانر كما سيراه العميل:</div>
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
              {closureSaving ? '⏳ جاري الحفظ...' : '💾 حفظ إعدادات الإغلاق'}
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
          <div className="av-card-title">📅 التوافر الأسبوعي</div>

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
                <span style={{ color:'#3d5466' }}>{label}</span>
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
                      <div style={{ fontSize:'.72rem', fontWeight:500, color:'rgba(201,169,110,.75)' }}>
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
                              const avail   = !blocked && !booked && isAvailable(court.id, dateStr, period.num)

                              let cls = 'available'
                              if (blocked) cls = 'admin-blocked'
                              else if (booked) cls = 'booked'

                              return (
                                <button
                                  key={period.num}
                                  id={`slot-${court.id}-${dateStr}-${period.num}`}
                                  className={`av-period-btn ${cls}`}
                                  disabled={booked}
                                  title={
                                    blocked ? `محجوب: ${blocked.reason ?? ''}` :
                                    booked  ? 'محجوز من عميل' :
                                    'انقر للحجب'
                                  }
                                  onClick={() => {
                                    if (blocked) {
                                      setUnblockTarget(blocked)
                                    } else if (!booked) {
                                      setBlockTarget({ court_id: court.id, date: dateStr, period_number: period.num })
                                      setBlockReason('صيانة')
                                    }
                                  }}
                                >
                                  {period.label}
                                  {blocked && <span style={{ fontSize:'.65rem', display:'block' }}>🔒</span>}
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

          <p style={{ fontSize:'.78rem', color:'#7a8a99', marginTop:'.75rem' }}>
            💡 انقر على خلية متاحة لحجبها، وعلى خلية محجوبة (حمراء) لفكّ حجبها.
          </p>
        </div>
      </div>

      {/* ══════════ مودال الحجب ══════════ */}
      {blockTarget && (
        <div className="av-modal-overlay" onClick={() => setBlockTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-title">🔒 حجب الفترة</div>

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
                {blockSaving ? '⏳...' : '🔒 تأكيد الحجب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ مودال فكّ الحجب ══════════ */}
      {unblockTarget && (
        <div className="av-modal-overlay" onClick={() => setUnblockTarget(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-title">🔓 إلغاء حجب الفترة</div>
            <p style={{ color:'#3d5466', fontSize:'.9rem', margin:'0 0 .5rem' }}>
              هل تريد إلغاء حجب هذه الفترة؟
            </p>
            <div style={{
              background:'#fff8f0', border:'1px solid #fde68a', borderRadius:8,
              padding:'.75rem', fontSize:'.88rem', color:'#92400e',
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
                <div style={{ marginTop:'.35rem', color:'#78350f', fontSize:'.82rem' }}>
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
                {unblockSaving ? '⏳...' : '🔓 تأكيد إلغاء الحجب'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════
         قسم إيقافات الملاعب
         ═══════════════════════════════════════════════════════ */}
      <div style={{
        marginTop:'2.5rem', padding:'1.5rem', background:'#fff',
        border:'1px solid #e5e7eb', borderRadius:12,
      }}>
        <h2 style={{ fontSize:'1.15rem', marginBottom:'1rem', color:'#1B2A3B', fontWeight:800 }}>
          🔒 إيقافات الملاعب
        </h2>
        <p style={{ fontSize:'0.8rem', color:'#999', marginBottom:'1.25rem' }}>
          أوقف ملعب لفترة زمنية (صيانة/فعالية). الإيقافات المنتهية تبقى كسجل تاريخي.
        </p>

        {/* نموذج إضافة إيقاف */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:'0.75rem',
          alignItems:'end', marginBottom:'1.25rem', padding:'1rem',
          background:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb',
        }}>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', fontWeight:700, marginBottom:'0.3rem' }}>الملعب</label>
            <select className="input" value={vcForm.court_id}
              onChange={e => setVcForm(f => ({ ...f, court_id: e.target.value }))}>
              {COURTS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', fontWeight:700, marginBottom:'0.3rem' }}>من تاريخ</label>
            <input type="date" className="input" value={vcForm.start_date}
              onChange={e => setVcForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', fontWeight:700, marginBottom:'0.3rem' }}>إلى تاريخ</label>
            <input type="date" className="input" value={vcForm.end_date}
              onChange={e => setVcForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', fontWeight:700, marginBottom:'0.3rem' }}>السبب</label>
            <select className="input" value={vcForm.reason}
              onChange={e => setVcForm(f => ({ ...f, reason: e.target.value }))}>
              {CLOSURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="av-btn av-btn-primary" onClick={addClosure} disabled={vcSaving}
            style={{ height:'2.5rem', whiteSpace:'nowrap' }}>
            {vcSaving ? '⏳...' : '➕ إضافة'}
          </button>
        </div>

        {/* جدول الإيقافات */}
        {venueClosures.length === 0 ? (
          <p style={{ textAlign:'center', color:'#999', padding:'1.5rem', fontSize:'0.9rem' }}>
            لا توجد إيقافات حالياً
          </p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
              <thead>
                <tr style={{ background:'#f3f4f6', textAlign:'right' }}>
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
                  const today = new Date().toISOString().slice(0,10)
                  const isActive = vc.start_date <= today && vc.end_date >= today
                  const isExpired = vc.end_date < today
                  const court = COURTS.find(c => c.id === vc.court_id)
                  return (
                    <tr key={vc.id} style={{
                      borderBottom:'1px solid #e5e7eb',
                      opacity: isExpired ? 0.5 : 1,
                      background: isActive ? 'rgba(220,38,38,.04)' : 'transparent',
                    }}>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {court?.icon} {court?.label ?? vc.court_id}
                      </td>
                      <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.82rem' }}>{vc.start_date}</td>
                      <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.82rem' }}>{vc.end_date}</td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>{vc.reason ?? '—'}</td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {isActive ? (
                          <span style={{ background:'#dc2626', color:'#fff', padding:'0.15rem 0.5rem', borderRadius:99, fontSize:'0.75rem', fontWeight:700 }}>نشط</span>
                        ) : isExpired ? (
                          <span style={{ background:'#9ca3af', color:'#fff', padding:'0.15rem 0.5rem', borderRadius:99, fontSize:'0.75rem' }}>منتهي</span>
                        ) : (
                          <span style={{ background:'#f59e0b', color:'#fff', padding:'0.15rem 0.5rem', borderRadius:99, fontSize:'0.75rem', fontWeight:700 }}>قادم</span>
                        )}
                      </td>
                      <td style={{ padding:'0.6rem 0.75rem' }}>
                        {!isExpired && (
                          <button className="av-btn av-btn-ghost" style={{ fontSize:'0.8rem', color:'#dc2626' }}
                            onClick={() => deleteClosure(vc.id)}>
                            🗑️ حذف
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
