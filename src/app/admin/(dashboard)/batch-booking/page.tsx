'use client'
// ============================================================
// صفحة الحجز المتعدد — /admin/batch-booking
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Search, Check, X, ChevronLeft, ChevronRight,
  Loader2, Plus, Minus, AlertCircle, CheckCircle2, Package,
  CalendarDays, Users, BadgeCheck, Trash2,
} from 'lucide-react'

/* ================================================================
   ثوابت
   ================================================================ */
const COURTS = [
  { id: 'football',   label: 'كرة القدم',    icon: '⚽' },
  { id: 'volleyball', label: 'الكرة الطائرة', icon: '🏐' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏅' },
]
const PERIODS = [
  { num: 1, label: '5-7م'  },
  { num: 2, label: '7-9م'  },
  { num: 3, label: '9-11م' },
]
const AR_DAYS_SHORT = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']
const AR_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
]
// ترتيب أيام الأسبوع: الاثنين → الأحد (Mon=0)
const WEEK_ORDER = [1,2,3,4,5,6,0] // Mon,Tue,Wed,Thu,Fri,Sat,Sun
const WEEK_LABELS = ['اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت','أحد']

/* ================================================================
   مساعدات التاريخ — توقيت محلي دائماً
   ================================================================ */
function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/* ================================================================
   بناء مصفوفة أيام الشهر مرتّبة Mon→Sun
   ================================================================ */
function buildMonthDays(base: Date): { date: Date; inMonth: boolean }[][] {
  const start  = getMonthStart(base)
  const total  = getDaysInMonth(base)
  const startDow = start.getDay() // 0=Sun
  // كم يوم قبل اليوم الأول لإكمال الصف (Mon-based)
  const offset = startDow === 0 ? 6 : startDow - 1

  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = -offset; i < total; i++) {
    const d = addDays(start, i)
    cells.push({ date: d, inMonth: i >= 0 })
  }
  // إكمال الصف الأخير
  while (cells.length % 7 !== 0) {
    cells.push({ date: addDays(cells[cells.length - 1].date, 1), inMonth: false })
  }
  // تقسيم لصفوف
  const rows: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/* ================================================================
   أنواع
   ================================================================ */
interface SlotRow {
  day_date: string; court_id: string; period_number: number; is_available: boolean
}
interface BlockedRow {
  id: string; court_id: string; date: string; period_number: number; reason: string | null
}
interface AvailData {
  slots: SlotRow[]; blocked: BlockedRow[]; settings: Record<string, string>
}
interface SelectedSlot {
  date: string; court_id: string; period_number: number
  code_used: string; water_quantity: number
  court_label?: string; period_label?: string; day_label?: string
}
interface CustomerInfo {
  found: boolean; name?: string; id?: string
  is_suspended?: boolean; suspension_reason?: string | null
}

/* ================================================================
   الصفحة الرئيسية
   ================================================================ */
export default function BatchBookingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'grid' | 'details' | 'result'>('grid')

  // شبكة التوافر
  const [monthDate, setMonthDate]     = useState<Date>(() => new Date())
  const [avail, setAvail]             = useState<AvailData | null>(null)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [gridError, setGridError]     = useState('')

  // الفترات المختارة
  const [selected, setSelected] = useState<SelectedSlot[]>([])

  // بيانات العميل
  const [phone, setPhone]               = useState('')
  const [name, setName]                 = useState('')
  const [nameEditable, setNameEditable] = useState(false)
  const [status, setStatus]             = useState<'confirmed' | 'pending'>('confirmed')
  const [note, setNote]                 = useState('')
  const [customer, setCustomer]         = useState<CustomerInfo | null>(null)
  const [searching, setSearching]       = useState(false)

  // إرسال
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{
    success: boolean; batch_id: string; created: number; failed: number
    results: { booking_date: string; court_id: string; period_number: number; ok: boolean; error?: string }[]
  } | null>(null)

  // Toast
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  function showToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── جلب التوافر ── */
  const fetchMonth = useCallback(async (base: Date) => {
    setLoadingGrid(true)
    setGridError('')
    const start = getMonthStart(base)
    const end   = new Date(base.getFullYear(), base.getMonth() + 1, 0)
    try {
      const r = await fetch(`/api/admin/availability?from=${toISO(start)}&to=${toISO(end)}`)
      if (!r.ok) throw new Error(await r.text())
      const d: AvailData = await r.json()
      setAvail(d)
    } catch {
      setGridError('فشل تحميل بيانات التوافر')
    } finally {
      setLoadingGrid(false)
    }
  }, [])

  useEffect(() => { fetchMonth(monthDate) }, [monthDate, fetchMonth])

  /* ── منطق الخلية ── */
  // الإصلاح: الخلية "محجوزة" فقط إذا:
  // 1) موجودة في blocked_slots
  // 2) أو موجودة في available_slots مع is_available = false
  // إذا لم تُعثر في available_slots → متاحة (لم يُحجز فيها شيء بعد)
  function getSlotState(date: string, court_id: string, period: number): 'available' | 'booked' | 'blocked' {
    const isBlocked = avail?.blocked.some(
      b => b.court_id === court_id && b.date === date && b.period_number === period
    )
    if (isBlocked) return 'blocked'

    const slot = avail?.slots.find(
      s => s.court_id === court_id && s.day_date === date && s.period_number === period
    )
    // إذا وُجدت في الـ view وكانت غير متاحة → محجوزة
    if (slot && !slot.is_available) return 'booked'
    // إذا وُجدت ومتاحة، أو لم تُوجد أصلاً → متاحة
    return 'available'
  }

  function isSelected(date: string, court_id: string, period: number): boolean {
    return selected.some(s => s.date === date && s.court_id === court_id && s.period_number === period)
  }

  function toggleSlot(date: string, court_id: string, period_number: number) {
    const state = getSlotState(date, court_id, period_number)
    if (state !== 'available') return

    const court     = COURTS.find(c => c.id === court_id)
    const periodObj = PERIODS.find(p => p.num === period_number)
    const dayDate   = new Date(date + 'T00:00:00')

    if (isSelected(date, court_id, period_number)) {
      setSelected(prev => prev.filter(
        s => !(s.date === date && s.court_id === court_id && s.period_number === period_number)
      ))
    } else {
      setSelected(prev => [...prev, {
        date, court_id, period_number,
        code_used: '', water_quantity: 0,
        court_label:  `${court?.icon ?? ''} ${court?.label ?? court_id}`,
        period_label: periodObj?.label ?? String(period_number),
        day_label: `${AR_DAYS_SHORT[dayDate.getDay()]} ${dayDate.getDate()} ${AR_MONTHS[dayDate.getMonth()]}`,
      }])
    }
  }

  /* ── بحث عميل ── */
  async function searchCustomer() {
    if (!phone.trim()) return
    setSearching(true); setCustomer(null); setName(''); setNameEditable(false)
    try {
      const r = await fetch(`/api/admin/customers/search?phone=${encodeURIComponent(phone.trim())}`)
      const d = await r.json()
      setCustomer(d)
      if (d.found) { setName(d.name ?? ''); setNameEditable(false) }
      else { setName(''); setNameEditable(true) }
    } catch { setNameEditable(true) }
    finally { setSearching(false) }
  }

  function updateSlot(idx: number, field: 'code_used' | 'water_quantity', value: string | number) {
    setSelected(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  /* ── إرسال الباقة ── */
  async function handleSubmit() {
    if (selected.length === 0) { showToast('err', 'اختر فترة واحدة على الأقل'); return }
    if (!phone.trim() || !name.trim()) { showToast('err', 'أدخل رقم الجوال والاسم'); return }
    if (customer?.is_suspended) { showToast('err', 'العميل موقوف'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/batch-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slots: selected.map(s => ({
            booking_date: s.date, court_id: s.court_id, period_number: s.period_number,
            code_used: s.code_used.trim() || null, water_quantity: Number(s.water_quantity) || 0,
          })),
          customer_name: name.trim(), customer_phone: phone.trim(),
          status, internal_note: note.trim() || null,
        }),
      })
      const d = await r.json()
      if (r.ok) { setResult(d); setStep('result') }
      else showToast('err', d.error ?? 'فشل إنشاء الباقة')
    } catch { showToast('err', 'تعذّر الاتصال بالخادم') }
    finally { setSaving(false) }
  }

  const monthRows = buildMonthDays(monthDate)
  const today     = toISO(new Date())

  /* ================================================================
     مكوّن خلية واحدة
     ================================================================ */
  function Cell({ date, court_id, period }: { date: string; court_id: string; period: number }) {
    const state    = getSlotState(date, court_id, period)
    const sel      = isSelected(date, court_id, period)
    const periodLbl = PERIODS.find(p => p.num === period)?.label ?? ''

    let bg = 'transparent', color = 'var(--text-secondary)', border = 'transparent'
    let clickable = true

    if (state === 'booked') {
      bg = 'rgba(239,68,68,0.12)'; color = 'rgba(239,68,68,0.7)'
      border = 'rgba(239,68,68,0.2)'; clickable = false
    } else if (state === 'blocked') {
      bg = 'rgba(107,114,128,0.1)'; color = 'rgba(107,114,128,0.5)'
      border = 'rgba(107,114,128,0.15)'; clickable = false
    } else if (sel) {
      bg = 'rgba(163,230,53,0.18)'; color = 'var(--accent)'
      border = 'rgba(163,230,53,0.4)'
    }

    return (
      <button
        disabled={!clickable}
        onClick={() => toggleSlot(date, court_id, period)}
        title={state === 'booked' ? 'محجوزة' : state === 'blocked' ? 'محجوبة' : sel ? 'انقر لإلغاء' : periodLbl}
        style={{
          width: '100%', height: 28,
          background: bg, color, border: `1px solid ${border}`,
          borderRadius: '0.3rem',
          cursor: clickable ? 'pointer' : 'default',
          fontSize: '0.62rem', fontWeight: sel ? 700 : 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.12s',
          padding: 0,
        }}
      >
        {state === 'booked'   ? <span style={{ fontSize: '0.7rem' }}>✕</span>
         : state === 'blocked' ? <span style={{ fontSize: '0.7rem' }}>—</span>
         : sel                 ? <Check size={10} />
         : <span>{periodLbl}</span>}
      </button>
    )
  }

  /* ================================================================
     STEP 1 — الشبكة
     ================================================================ */
  function renderGrid() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* رأس */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.push('/admin/bookings')}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: '0.5rem', padding: '0.45rem 0.6rem',
              cursor: 'pointer', color: 'var(--text-main)', display: 'flex',
            }}
          ><ArrowRight size={16} /></button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Package size={20} /> الحجز المتعدد
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              اختر الفترات من الشبكة — يمكنك التنقل بين الأشهر
            </p>
          </div>
        </div>

        {/* شريط التقدم */}
        <StepBar step={0} />

        {/* تنقل الشهر */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: '0.65rem', padding: '0.6rem 1rem',
        }}>
          <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '0.2rem', display: 'flex' }}>
            <ChevronRight size={18} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            {AR_MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
          </span>
          <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '0.2rem', display: 'flex' }}>
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* الشبكة */}
        {loadingGrid ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 size={26} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>جاري تحميل التوافر...</p>
          </div>
        ) : gridError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
            <AlertCircle size={22} />
            <p style={{ marginTop: '0.4rem' }}>{gridError}</p>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            {/* ── لكل ملعب ── */}
            {COURTS.map((court, ci) => (
              <div key={court.id} style={{ borderBottom: ci < 2 ? '2px solid var(--border-subtle)' : 'none' }}>

                {/* رأس الملعب */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.55rem 0.85rem',
                  background: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)',
                }}>
                  <span>{court.icon}</span>
                  <span>{court.label}</span>
                </div>

                {/* جدول الشهر */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 46 }} />  {/* عمود الفترة */}
                      {monthRows[0]?.map((_, i) => <col key={i} />)}
                    </colgroup>
                    <thead>
                      {/* صف أسماء أيام الأسبوع */}
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        <th style={{
                          padding: '0.35rem 0.3rem', fontSize: '0.67rem',
                          color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)',
                          textAlign: 'center', fontWeight: 600,
                        }}>الفترة</th>
                        {WEEK_LABELS.map(d => (
                          <th key={d} style={{
                            padding: '0.35rem 0.2rem', fontSize: '0.67rem',
                            color: 'var(--text-muted)', textAlign: 'center',
                            borderLeft: '1px solid var(--border-subtle)', fontWeight: 600,
                          }}>{d}</th>
                        ))}
                      </tr>
                      {/* صف تواريخ كل يوم — نعرض الأسبوع الأول فقط كمرجع */}
                      {monthRows[0] && (
                        <tr>
                          <td style={{ borderLeft: '1px solid var(--border-subtle)' }} />
                          {monthRows[0].map((cell, di) => (
                            <td key={di} style={{
                              padding: '0.25rem 0.1rem', textAlign: 'center',
                              fontSize: '0.62rem', color: cell.inMonth ? 'var(--text-muted)' : 'transparent',
                              borderLeft: '1px solid var(--border-subtle)',
                            }}>
                              {cell.date.getDate()}
                            </td>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {monthRows.map((week, wi) => (
                        PERIODS.map((period, pi) => (
                          <tr key={`${wi}-${pi}`}>
                            {/* عمود label الفترة — فقط في أول period للأسبوع */}
                            {pi === 0 ? (
                              <td rowSpan={3} style={{
                                textAlign: 'center', verticalAlign: 'middle',
                                borderLeft: '1px solid var(--border-subtle)',
                                borderBottom: '1px solid var(--border-subtle)',
                                fontSize: '0.6rem', color: 'var(--text-muted)',
                                padding: '0.15rem',
                              }}>
                                {/* تاريخ اليوم الأول في الأسبوع */}
                                <span style={{ fontWeight: 600, display: 'block' }}>
                                  {week[0]?.inMonth ? week[0].date.getDate() : ''}
                                </span>
                                <span style={{ color: 'var(--text-muted)', opacity: 0.7, fontSize: '0.55rem' }}>
                                  {week[0]?.inMonth ? AR_MONTHS[week[0].date.getMonth()].slice(0, 3) : ''}
                                </span>
                              </td>
                            ) : null}

                            {week.map((cell, di) => {
                              const dateStr = toISO(cell.date)
                              const isPast  = dateStr < today
                              const outOfMonth = !cell.inMonth

                              return (
                                <td key={di} style={{
                                  padding: '0.12rem 0.15rem',
                                  borderLeft: '1px solid var(--border-subtle)',
                                  borderBottom: '1px solid var(--border-subtle)',
                                  background: outOfMonth ? 'var(--bg-elevated)' : isPast ? 'rgba(0,0,0,0.02)' : 'transparent',
                                }}>
                                  {outOfMonth || isPast ? (
                                    <div style={{
                                      height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.35,
                                    }}>
                                      {period.label}
                                    </div>
                                  ) : (
                                    <Cell
                                      date={dateStr}
                                      court_id={court.id}
                                      period={period.num}
                                    />
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* مفتاح الألوان */}
            <div style={{
              display: 'flex', gap: '1rem', padding: '0.6rem 0.85rem',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)', flexWrap: 'wrap',
            }}>
              {[
                { color: 'rgba(163,230,53,0.25)', border: 'rgba(163,230,53,0.4)', label: 'مختار' },
                { color: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.2)',  label: 'محجوز' },
                { color: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.15)', label: 'محجوب' },
              ].map(({ color, border, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: `1px solid ${border}` }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                الخلفية الفاتحة = ماضٍ أو خارج الشهر
              </span>
            </div>
          </div>
        )}

        {/* الفترات المختارة */}
        {selected.length > 0 && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(163,230,53,0.35)',
            borderRadius: '0.7rem', padding: '0.85rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                الفترات المختارة ({selected.length})
              </span>
              <button
                onClick={() => setSelected([])}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  borderRadius: '0.35rem', padding: '0.18rem 0.5rem',
                  cursor: 'pointer', color: 'var(--danger)', fontSize: '0.72rem',
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                }}
              ><Trash2 size={11} /> مسح الكل</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {selected.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.28)',
                  borderRadius: '0.35rem', padding: '0.22rem 0.5rem',
                  fontSize: '0.77rem', color: 'var(--text-main)',
                }}>
                  <span>{s.day_label} · {s.court_label} · {s.period_label}</span>
                  <button
                    onClick={() => toggleSlot(s.date, s.court_id, s.period_number)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'flex' }}
                  ><X size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* زر المتابعة */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { if (!selected.length) { showToast('err', 'اختر فترة على الأقل'); return } setStep('details') }}
            disabled={!selected.length}
            style={{
              background: selected.length ? 'var(--accent)' : 'var(--border-subtle)',
              color: selected.length ? '#000' : 'var(--text-muted)',
              border: 'none', borderRadius: '0.6rem', padding: '0.65rem 1.75rem',
              cursor: selected.length ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            متابعة ({selected.length} فترة) <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================
     STEP 2 — بيانات العميل + تفاصيل الفترات
     ================================================================ */
  function renderDetails() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* رأس */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setStep('grid')} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.5rem', padding: '0.45rem 0.6rem', cursor: 'pointer',
            color: 'var(--text-main)', display: 'flex',
          }}><ArrowRight size={16} /></button>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>بيانات الباقة</h1>
        </div>

        <StepBar step={1} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.25rem' }}>

          {/* ── عمود اليسار: بيانات العميل ── */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.75rem', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={15} /> بيانات العميل
            </h3>

            {/* جوال */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>رقم الجوال</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchCustomer()}
                  placeholder="05XXXXXXXX"
                  style={{
                    flex: 1, padding: '0.55rem 0.7rem',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    borderRadius: '0.5rem', color: 'var(--text-main)', fontSize: '0.88rem', direction: 'ltr',
                  }}
                />
                <button onClick={searchCustomer} disabled={searching} style={{
                  background: 'var(--accent)', color: '#000', border: 'none',
                  borderRadius: '0.5rem', padding: '0 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}>
                  {searching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                </button>
              </div>
            </div>

            {/* حالة العميل */}
            {customer && (
              <div style={{
                padding: '0.4rem 0.65rem', borderRadius: '0.4rem', fontSize: '0.78rem', fontWeight: 600,
                background: customer.is_suspended ? 'rgba(239,68,68,0.1)' : customer.found ? 'rgba(163,230,53,0.1)' : 'rgba(251,191,36,0.1)',
                color: customer.is_suspended ? 'var(--danger)' : customer.found ? '#7bba00' : '#d97706',
                border: `1px solid ${customer.is_suspended ? 'rgba(239,68,68,0.2)' : customer.found ? 'rgba(163,230,53,0.25)' : 'rgba(251,191,36,0.2)'}`,
              }}>
                {customer.is_suspended
                  ? `⚠ موقوف: ${customer.suspension_reason ?? '—'}`
                  : customer.found ? '✓ عميل مسجّل' : '＋ عميل جديد — يُسجَّل تلقائياً'}
              </div>
            )}

            {/* الاسم */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>الاسم</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                disabled={!nameEditable && !!customer?.found}
                placeholder="اسم العميل"
                style={{
                  width: '100%', padding: '0.55rem 0.7rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '0.5rem', color: 'var(--text-main)', fontSize: '0.88rem',
                  opacity: (!nameEditable && customer?.found) ? 0.65 : 1,
                }}
              />
            </div>

            {/* حالة الدفع */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>حالة الدفع</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['confirmed', 'pending'] as const).map(v => (
                  <button key={v} onClick={() => setStatus(v)} style={{
                    flex: 1, padding: '0.45rem',
                    background: status === v ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: status === v ? '#000' : 'var(--text-muted)',
                    border: `1px solid ${status === v ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    borderRadius: '0.45rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: status === v ? 700 : 400,
                  }}>
                    {v === 'confirmed' ? 'مؤكد (مدفوع)' : 'بانتظار الإيصال'}
                  </button>
                ))}
              </div>
            </div>

            {/* ملاحظة */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>ملاحظة داخلية (اختياري)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="ملاحظة للإدارة..." style={{
                  width: '100%', padding: '0.55rem 0.7rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '0.5rem', color: 'var(--text-main)', fontSize: '0.82rem', resize: 'vertical',
                }} />
            </div>
          </div>

          {/* ── عمود اليمين: الفترات ── */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.75rem', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarDays size={15} /> الفترات ({selected.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '52vh', overflowY: 'auto' }}>
              {selected.map((s, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '0.55rem', padding: '0.65rem 0.75rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {s.day_label} · {s.court_label} · {s.period_label}
                    </span>
                    <button onClick={() => toggleSlot(s.date, s.court_id, s.period_number)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 0,
                    }}><X size={13} /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.18rem' }}>كود الخصم</label>
                      <input
                        type="text" value={s.code_used}
                        onChange={e => updateSlot(idx, 'code_used', e.target.value.toUpperCase())}
                        placeholder="اختياري"
                        style={{
                          width: '100%', padding: '0.35rem 0.5rem',
                          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                          borderRadius: '0.35rem', color: 'var(--text-main)', fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.18rem' }}>المياه (كرتون)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button onClick={() => updateSlot(idx, 'water_quantity', Math.max(0, Number(s.water_quantity) - 1))}
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '0.3rem', padding: '0.22rem 0.35rem', cursor: 'pointer', color: 'var(--text-main)', display: 'flex' }}>
                          <Minus size={11} />
                        </button>
                        <span style={{ minWidth: 22, textAlign: 'center', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {s.water_quantity}
                        </span>
                        <button onClick={() => updateSlot(idx, 'water_quantity', Number(s.water_quantity) + 1)}
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '0.3rem', padding: '0.22rem 0.35rem', cursor: 'pointer', color: 'var(--text-main)', display: 'flex' }}>
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* أزرار */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button onClick={() => setStep('grid')} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.55rem', padding: '0.65rem 1.25rem', cursor: 'pointer',
            color: 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem',
          }}>← تعديل الفترات</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            background: 'var(--accent)', color: '#000', border: 'none',
            borderRadius: '0.55rem', padding: '0.65rem 1.75rem',
            cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <BadgeCheck size={15} />}
            {saving ? 'جارٍ الإنشاء...' : `تأكيد الباقة (${selected.length})`}
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================
     STEP 3 — النتيجة
     ================================================================ */
  function renderResult() {
    if (!result) return null
    const okItems   = result.results.filter(r => r.ok)
    const failItems = result.results.filter(r => !r.ok)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 600, margin: '0 auto' }}>
        {/* ملخص */}
        <div style={{
          textAlign: 'center', padding: '2rem 1.5rem',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '1rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>
            {result.failed === 0 ? '🎉' : result.created > 0 ? '⚠️' : '❌'}
          </div>
          <h2 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>
            {result.failed === 0 ? 'تمت إنشاء الباقة بنجاح' : result.created > 0 ? 'أُنشئت الباقة جزئياً' : 'فشل إنشاء الباقة'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            رقم الباقة: <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}>{result.batch_id}</span>
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
            <div><div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7bba00' }}>{result.created}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>نجحت</div></div>
            {result.failed > 0 && <div><div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger)' }}>{result.failed}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>فشلت</div></div>}
          </div>
        </div>

        {/* تفاصيل */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: '0.75rem', padding: '1.1rem',
        }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: 'var(--text-main)' }}>تفاصيل الفترات</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {result.results.map((r, i) => {
              const slot = selected[i]
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.45rem 0.65rem', borderRadius: '0.4rem',
                  background: r.ok ? 'rgba(163,230,53,0.07)' : 'rgba(239,68,68,0.07)',
                }}>
                  {r.ok ? <CheckCircle2 size={14} style={{ color: '#7bba00', flexShrink: 0 }} /> : <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                  <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                    {slot?.day_label ?? r.booking_date} · {slot?.court_label ?? r.court_id} · {slot?.period_label ?? r.period_number}
                  </span>
                  {!r.ok && <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{r.error}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* أزرار */}
        <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
          <button onClick={() => router.push('/admin/bookings')} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '0.55rem', padding: '0.65rem 1.25rem', cursor: 'pointer',
            color: 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem',
          }}>عرض الحجوزات</button>
          <button onClick={() => { setStep('grid'); setSelected([]); setResult(null); setPhone(''); setName(''); setCustomer(null); setNote('') }} style={{
            background: 'var(--accent)', color: '#000', border: 'none',
            borderRadius: '0.55rem', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
          }}>إنشاء باقة جديدة</button>
        </div>
      </div>
    )
  }

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '1.25rem 1.5rem' }}>

      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
          background: toast.type === 'ok' ? 'var(--accent)' : 'var(--danger)',
          color: toast.type === 'ok' ? '#000' : '#fff',
          padding: '0.65rem 1.1rem', borderRadius: '0.55rem',
          fontWeight: 600, fontSize: '0.88rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.type === 'ok' ? '✓ ' : '✗ '}{toast.text}
        </div>
      )}

      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(1rem)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {step === 'grid'    && renderGrid()}
      {step === 'details' && renderDetails()}
      {step === 'result'  && renderResult()}
    </div>
  )
}

/* ================================================================
   مكوّن شريط التقدم
   ================================================================ */
function StepBar({ step }: { step: number }) {
  const steps = ['اختيار الفترات', 'بيانات الباقة', 'النتيجة']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {steps.map((lbl, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: i < 2 ? 1 : undefined }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            background: i < step ? 'rgba(163,230,53,0.3)' : i === step ? 'var(--accent)' : 'var(--bg-card)',
            border: i < step ? '1px solid rgba(163,230,53,0.5)' : i === step ? 'none' : '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: i < step ? '#7bba00' : i === step ? '#000' : 'var(--text-muted)',
            fontSize: '0.72rem', fontWeight: 700,
          }}>
            {i < step ? <Check size={12} /> : i + 1}
          </div>
          <span style={{
            fontSize: '0.78rem', whiteSpace: 'nowrap',
            color: i === step ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: i === step ? 700 : 400,
          }}>{lbl}</span>
          {i < 2 && <div style={{ flex: 1, height: 2, background: i < step ? 'rgba(163,230,53,0.4)' : 'var(--border-subtle)', borderRadius: 1, minWidth: 20 }} />}
        </div>
      ))}
    </div>
  )
}
