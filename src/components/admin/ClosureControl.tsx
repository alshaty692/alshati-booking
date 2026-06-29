'use client'
// ============================================================
// ClosureControl — لوحة تحكم الإغلاق الكامل (Client Component)
// تُستخدم في /admin/settings
// ============================================================
import { useState, useTransition } from 'react'
import { Lock, LockOpen, Calendar, AlertTriangle, Loader2, CheckCircle2, Info } from 'lucide-react'

interface UpcomingBooking {
  id: string
  booking_date: string
  court_id: string
  period_number: number
  customer_name: string
  customer_phone: string
}

interface Props {
  initialActive: boolean
  initialStart: string
  initialTitle: string
  initialMessage: string
  saveAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}

export default function ClosureControl({
  initialActive,
  initialStart,
  initialTitle,
  initialMessage,
  saveAction,
}: Props) {
  const [active,  setActive]  = useState(initialActive)
  const [start,   setStart]   = useState(initialStart)
  const [title,   setTitle]   = useState(initialTitle)
  const [message, setMessage] = useState(initialMessage)

  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[] | null>(null)
  const [loadingBookings,  setLoadingBookings]  = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // احسب نوع الإغلاق
  const today = new Date().toISOString().slice(0, 10)
  const isScheduled = active && start && start > today
  const isImmediate = active && (!start || start <= today)

  // عند تفعيل الإغلاق → اجلب الحجوزات القادمة لتحذير الأدمن
  async function handleActivate() {
    if (!active) {
      // تفعيل → اجلب الحجوزات أولاً
      setLoadingBookings(true)
      try {
        const fromDate = start && start > today ? start : today
        const r = await fetch(`/api/admin/bookings?status=confirmed&date_from=${fromDate}&limit=50`)
        const d = await r.json()
        setUpcomingBookings(d.bookings ?? [])
      } catch {
        setUpcomingBookings([])
      } finally {
        setLoadingBookings(false)
      }
    }
    setActive(v => !v)
    setResult(null)
  }

  async function handleSave() {
    setResult(null)
    const fd = new FormData()
    fd.append('closure_full_active',  active  ? 'true' : 'false')
    fd.append('closure_full_start',   start)
    fd.append('closure_full_title',   title)
    fd.append('closure_full_message', message)

    startTransition(async () => {
      const res = await saveAction(fd)
      setResult(res.success
        ? { ok: true,  msg: active ? 'تم تفعيل الإغلاق بنجاح ✓' : 'تم فتح المنشأة بنجاح ✓' }
        : { ok: false, msg: res.error ?? 'حدث خطأ' }
      )
      if (res.success && !active) setUpcomingBookings(null)
    })
  }

  function handleReopen() {
    setActive(false)
    setStart('')
    setUpcomingBookings(null)
    setResult(null)
  }

  const s = {
    section: {
      background: 'var(--bg-card)',
      border: active
        ? '1px solid rgba(255,80,80,0.4)'
        : '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      marginBottom: 'var(--space-5)',
      transition: 'border-color 0.2s',
    } as React.CSSProperties,
    head: {
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      marginBottom: 'var(--space-4)',
    } as React.CSSProperties,
    headTitle: {
      fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)',
      color: 'var(--text-primary)', margin: 0,
    } as React.CSSProperties,
    badge: (color: string, bg: string): React.CSSProperties => ({
      marginRight: 'auto', padding: '0.2em 0.7em',
      borderRadius: 'var(--radius-full)',
      background: bg, color, fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-semibold)',
      border: `1px solid ${color}30`,
    }),
    toggle: {
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      background: active ? 'rgba(255,80,80,0.06)' : 'var(--bg-elevated)',
      border: active ? '1px solid rgba(255,80,80,0.25)' : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-4)', cursor: 'pointer',
      transition: 'all 0.2s',
    } as React.CSSProperties,
    toggleIcon: {
      color: active ? '#ff5050' : 'var(--color-lime)',
      flexShrink: 0,
    } as React.CSSProperties,
    toggleLabel: {
      flex: 1,
      fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
      color: 'var(--text-primary)',
    } as React.CSSProperties,
    pill: {
      width: '42px', height: '24px', borderRadius: '999px',
      background: active ? '#ff5050' : 'var(--border-color)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    } as React.CSSProperties,
    dot: {
      position: 'absolute' as const, top: '3px',
      right: active ? '3px' : 'calc(100% - 21px)',
      width: '18px', height: '18px', borderRadius: '50%',
      background: '#fff', transition: 'right 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    } as React.CSSProperties,
    field: {
      display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-1)',
      marginBottom: 'var(--space-3)',
    },
    label: {
      fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
      color: 'var(--text-secondary)',
    } as React.CSSProperties,
    hint: {
      fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
      marginTop: 'var(--space-1)',
    } as React.CSSProperties,
    warn: {
      background: 'rgba(255,170,0,0.08)',
      border: '1px solid rgba(255,170,0,0.25)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
      marginBottom: 'var(--space-3)',
    } as React.CSSProperties,
  }

  return (
    <div style={s.section}>
      {/* رأس القسم */}
      <div style={s.head}>
        <Lock size={18} strokeWidth={1.75} style={{ color: active ? '#ff5050' : 'var(--color-lime-dim)', flexShrink: 0 }} />
        <h2 style={s.headTitle}>إغلاق المنشأة الكامل</h2>
        {active && isScheduled && (
          <span style={s.badge('var(--color-warning)', 'rgba(255,170,0,0.1)')}>مجدول</span>
        )}
        {active && isImmediate && (
          <span style={s.badge('#ff5050', 'rgba(255,80,80,0.1)')}>مفعّل الآن</span>
        )}
        {!active && (
          <span style={s.badge('var(--color-lime)', 'var(--color-lime-muted)')}>مفتوح</span>
        )}
      </div>

      {/* زر التبديل */}
      <div style={s.toggle} onClick={handleDisabled => active ? (setActive(false), setUpcomingBookings(null), setResult(null)) : handleActivate()}>
        <div style={s.toggleIcon}>
          {loadingBookings
            ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            : active ? <Lock size={20} /> : <LockOpen size={20} />
          }
        </div>
        <span style={s.toggleLabel}>
          {active ? 'المنشأة مغلقة — اضغط لإعادة الفتح' : 'المنشأة مفتوحة — اضغط لتفعيل الإغلاق'}
        </span>
        <div style={s.pill}><div style={s.dot} /></div>
      </div>

      {/* تحذير الحجوزات القادمة */}
      {active && upcomingBookings && upcomingBookings.length > 0 && (
        <div style={s.warn}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', color:'var(--color-warning)', fontWeight:700, fontSize:'0.85rem' }}>
            <AlertTriangle size={14} />
            {upcomingBookings.length} حجز مؤكد سيتأثر بالإغلاق — لن يُلغى تلقائياً
          </div>
          <div style={{ maxHeight:'140px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            {upcomingBookings.map(b => (
              <div key={b.id} style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                <span>📅 {b.booking_date}</span>
                <span>👤 {b.customer_name}</span>
                <span>📞 {b.customer_phone}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', margin:'0.5rem 0 0', display:'flex', alignItems:'center', gap:'0.3rem' }}>
            <Info size={11} /> راجع هذه الحجوزات وألغِها يدوياً إذا لزم
          </p>
        </div>
      )}
      {active && upcomingBookings && upcomingBookings.length === 0 && (
        <div style={{ ...s.warn, background:'rgba(163,230,53,0.06)', borderColor:'rgba(163,230,53,0.2)' }}>
          <span style={{ fontSize:'0.82rem', color:'var(--color-lime)', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <CheckCircle2 size={13} /> لا توجد حجوزات مؤكدة في فترة الإغلاق
          </span>
        </div>
      )}

      {/* حقول الرسالة */}
      {active && (
        <>
          {/* تاريخ البداية */}
          <div style={s.field}>
            <label style={s.label}>
              <Calendar size={12} style={{ display:'inline', marginLeft:'0.3rem' }} />
              تاريخ بداية الإغلاق (اختياري)
            </label>
            <input
              type="date"
              className="input"
              value={start}
              min={today}
              onChange={e => { setStart(e.target.value); setResult(null) }}
            />
            <p style={s.hint}>
              {!start || start <= today
                ? '⚡ فاضي أو اليوم = إغلاق فوري الآن'
                : `📅 إغلاق مجدول — الموقع يشتغل حتى ${start} ثم يُغلق`
              }
            </p>
          </div>

          {/* عنوان الرسالة */}
          <div style={s.field}>
            <label style={s.label}>عنوان رسالة الإغلاق</label>
            <input
              type="text"
              className="input"
              value={title}
              placeholder="المنشأة مغلقة مؤقتاً"
              onChange={e => { setTitle(e.target.value); setResult(null) }}
            />
          </div>

          {/* نص الرسالة */}
          <div style={s.field}>
            <label style={s.label}>رسالة الإغلاق للعميل</label>
            <textarea
              className="input"
              rows={3}
              value={message}
              placeholder="نعتذر عن الإغلاق المؤقت، سنعود قريباً بإذن الله."
              onChange={e => { setMessage(e.target.value); setResult(null) }}
              style={{ resize: 'vertical' }}
            />
            <p style={s.hint}>تظهر في صفحة الإغلاق للعملاء وكـ tooltip للتواريخ الرمادية</p>
          </div>
        </>
      )}

      {/* نتيجة الحفظ */}
      {result && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: result.ok ? 'rgba(163,230,53,0.08)' : 'rgba(255,80,80,0.08)',
          color: result.ok ? 'var(--color-lime)' : '#ff5050',
          fontSize: 'var(--text-sm)', fontWeight: 600,
          marginBottom: 'var(--space-3)',
          border: result.ok ? '1px solid rgba(163,230,53,0.2)' : '1px solid rgba(255,80,80,0.2)',
        }}>
          {result.msg}
        </div>
      )}

      {/* زر الحفظ */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="btn btn-primary"
        style={{
          width: '100%', gap: 'var(--space-2)',
          background: active ? 'rgba(255,80,80,0.15)' : undefined,
          borderColor: active ? 'rgba(255,80,80,0.4)' : undefined,
          color: active ? '#ff5050' : undefined,
        }}
      >
        {isPending
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الحفظ...</>
          : active
            ? <><Lock size={14} /> حفظ إعدادات الإغلاق</>
            : <><LockOpen size={14} /> حفظ (فتح المنشأة)</>
        }
      </button>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
