'use client'
// ============================================================
// صفحة الحجز المتعدد — /admin/batch-booking
// الأدمن يختار عدة فترات من شبكة شهرية ثم يُنشئ الحجوزات دفعة واحدة
// كل فترة لها كود خصم وكمية مياه مستقلة
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Search, Check, X, ChevronLeft, ChevronRight,
  Loader2, Plus, Minus, AlertCircle, CheckCircle2, Package,
  CalendarDays, Users, BadgeCheck, Trash2
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
  { num: 1, label: '5-7م'   },
  { num: 2, label: '7-9م'   },
  { num: 3, label: '9-11م'  },
]
const AR_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const AR_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
]

/* ================================================================
   مساعدات التاريخ — تستخدم التوقيت المحلي دائماً
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
function getDayOfWeek(d: Date): number { return d.getDay() } // 0=Sun

/* ================================================================
   أنواع
   ================================================================ */
interface SlotRow {
  day_date:      string
  court_id:      string
  period_number: number
  is_available:  boolean
}
interface BlockedRow {
  id: string; court_id: string; date: string; period_number: number; reason: string | null
}
interface AvailData {
  slots: SlotRow[]; blocked: BlockedRow[]; settings: Record<string, string>
}
interface SelectedSlot {
  date: string; court_id: string; period_number: number
  code_used:      string
  water_quantity: number
  // حقول مرئية محسوبة
  base_price?:    number
  final_price?:   number
  court_label?:   string
  period_label?:  string
  day_label?:     string
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

  /* ── الخطوة الحالية ── */
  const [step, setStep] = useState<'grid' | 'details' | 'result'>('grid')

  /* ── حالة الشبكة ── */
  const [monthDate, setMonthDate]   = useState<Date>(() => new Date())
  const [avail, setAvail]           = useState<AvailData | null>(null)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [gridError, setGridError]   = useState('')

  /* ── الفترات المختارة ── */
  const [selected, setSelected] = useState<SelectedSlot[]>([])

  /* ── بيانات العميل ── */
  const [phone, setPhone]               = useState('')
  const [name, setName]                 = useState('')
  const [nameEditable, setNameEditable] = useState(false)
  const [status, setStatus]             = useState<'confirmed'|'pending'>('confirmed')
  const [note, setNote]                 = useState('')
  const [customer, setCustomer]         = useState<CustomerInfo | null>(null)
  const [searching, setSearching]       = useState(false)

  /* ── إرسال + نتيجة ── */
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{
    success: boolean; batch_id: string; created: number; failed: number
    results: { booking_date:string; court_id:string; period_number:number; ok:boolean; error?:string }[]
  } | null>(null)

  /* ── toast ── */
  const [toast, setToast] = useState<{ type:'ok'|'err'; text:string } | null>(null)
  function showToast(type: 'ok'|'err', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── جلب بيانات التوافر للشهر ── */
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

  /* ── مساعدات فحص الخلية ── */
  function isBooked(date: string, court_id: string, period: number): boolean {
    const slot = avail?.slots.find(s => s.court_id === court_id && s.day_date === date && s.period_number === period)
    const blocked = avail?.blocked.find(b => b.court_id === court_id && b.date === date && b.period_number === period)
    return !!blocked || (slot ? !slot.is_available : false)
  }

  function isSelected(date: string, court_id: string, period: number): boolean {
    return selected.some(s => s.date === date && s.court_id === court_id && s.period_number === period)
  }

  /* ── تبديل اختيار خلية ── */
  function toggleSlot(date: string, court_id: string, period_number: number) {
    if (isBooked(date, court_id, period_number)) return
    const court = COURTS.find(c => c.id === court_id)
    const periodObj = PERIODS.find(p => p.num === period_number)
    const dayDate = new Date(date + 'T00:00:00')

    if (isSelected(date, court_id, period_number)) {
      setSelected(prev => prev.filter(
        s => !(s.date === date && s.court_id === court_id && s.period_number === period_number)
      ))
    } else {
      setSelected(prev => [...prev, {
        date, court_id, period_number,
        code_used: '', water_quantity: 0,
        court_label: `${court?.icon ?? ''} ${court?.label ?? court_id}`,
        period_label: periodObj?.label ?? String(period_number),
        day_label: `${AR_DAYS[getDayOfWeek(dayDate)]} ${dayDate.getDate()} ${AR_MONTHS[dayDate.getMonth()]}`,
      }])
    }
  }

  /* ── بحث عميل ── */
  async function searchCustomer() {
    if (!phone.trim()) return
    setSearching(true)
    setCustomer(null)
    setName('')
    setNameEditable(false)
    try {
      const r = await fetch(`/api/admin/customers/search?phone=${encodeURIComponent(phone.trim())}`)
      const d = await r.json()
      setCustomer(d)
      if (d.found) { setName(d.name ?? ''); setNameEditable(false) }
      else { setName(''); setNameEditable(true) }
    } catch {
      setNameEditable(true)
    } finally {
      setSearching(false)
    }
  }

  /* ── تحديث حقول الفترة ── */
  function updateSlot(idx: number, field: 'code_used'|'water_quantity', value: string|number) {
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
            booking_date:  s.date,
            court_id:      s.court_id,
            period_number: s.period_number,
            code_used:     s.code_used.trim() || null,
            water_quantity: Number(s.water_quantity) || 0,
          })),
          customer_name:  name.trim(),
          customer_phone: phone.trim(),
          status,
          internal_note: note.trim() || null,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setResult(d)
        setStep('result')
      } else {
        showToast('err', d.error ?? 'فشل إنشاء الباقة')
      }
    } catch {
      showToast('err', 'تعذّر الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  /* ── بناء الشهر — أيام الشبكة ── */
  function buildMonthGrid(): { date: Date; isCurrentMonth: boolean }[][] {
    const start = getMonthStart(monthDate)
    const days = getDaysInMonth(monthDate)
    // نبدأ من الاثنين = اليوم الأول في الجدول
    let startDay = getDayOfWeek(start) // 0=Sun
    // نحوّل لـ Mon-based: Mon=0, ..., Sun=6
    const offset = startDay === 0 ? 6 : startDay - 1
    const cells: Date[] = []
    for (let i = -offset; i < days; i++) {
      cells.push(addDays(start, i))
    }
    // نكمّل لإتمام الصف الأخير
    while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1))
    // نقسّم لصفوف
    const rows: { date: Date; isCurrentMonth: boolean }[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7).map(d => ({
        date: d,
        isCurrentMonth: d.getMonth() === monthDate.getMonth(),
      })))
    }
    return rows
  }

  const monthGrid = buildMonthGrid()
  const today = toISO(new Date())

  /* ── الحساب الكلي للسعر ── */
  // يُعرض بشكل تقريبي — السعر الحقيقي يُحسب بالـ API
  const totalSlots = selected.length

  /* ================================================================
     STEP 1 — شبكة الاختيار الشهرية
     ================================================================ */
  function renderGrid() {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        {/* رأس الصفحة */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <button
            onClick={() => router.push('/admin/bookings')}
            style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.5rem', padding:'0.5rem', cursor:'pointer', color:'var(--text-main)',
              display:'flex', alignItems:'center',
            }}
          ><ArrowRight size={18}/></button>
          <div>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
              <Package size={22} style={{ verticalAlign:'middle', marginLeft:'0.5rem' }} />
              الحجز المتعدد
            </h1>
            <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', margin:0 }}>
              اختر الفترات المطلوبة ثم أدخل بيانات العميل
            </p>
          </div>
        </div>

        {/* شريط التقدم */}
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {['اختيار الفترات','بيانات الباقة','النتيجة'].map((lbl, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', flex: i < 2 ? '1' : undefined }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background: i === 0 ? 'var(--accent)' : 'var(--bg-card)',
                border: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color: i === 0 ? '#000' : 'var(--text-muted)',
                fontSize:'0.75rem', fontWeight:700,
              }}>{i+1}</div>
              <span style={{ fontSize:'0.8rem', color: i === 0 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: i === 0 ? 700 : 400 }}>{lbl}</span>
              {i < 2 && <div style={{ flex:1, height:2, background:'var(--border-subtle)', borderRadius:1 }} />}
            </div>
          ))}
        </div>

        {/* تنقل بين الأشهر */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
          borderRadius:'0.75rem', padding:'0.75rem 1rem',
        }}>
          <button
            onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-main)', padding:'0.25rem', display:'flex' }}
          ><ChevronRight size={20}/></button>
          <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-main)' }}>
            {AR_MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
          </span>
          <button
            onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-main)', padding:'0.25rem', display:'flex' }}
          ><ChevronLeft size={20}/></button>
        </div>

        {/* الشبكة الشهرية */}
        {loadingGrid ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <Loader2 size={28} style={{ animation:'spin 1s linear infinite' }}/>
            <p style={{ marginTop:'0.5rem' }}>جاري تحميل التوافر...</p>
          </div>
        ) : gridError ? (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--danger)' }}>
            <AlertCircle size={24} style={{ marginBottom:'0.5rem' }}/>
            <p>{gridError}</p>
          </div>
        ) : (
          <div style={{
            background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
            borderRadius:'0.75rem', overflow:'hidden',
          }}>
            {/* ملاعب × أيام */}
            {COURTS.map(court => (
              <div key={court.id} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                {/* اسم الملعب */}
                <div style={{
                  background:'var(--bg-elevated)', padding:'0.5rem 1rem',
                  fontWeight:700, fontSize:'0.9rem', color:'var(--text-main)',
                  borderBottom:'1px solid var(--border-subtle)',
                }}>
                  {court.icon} {court.label}
                </div>

                {/* الصفوف الشهرية */}
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                    <thead>
                      <tr>
                        <th style={{ padding:'0.4rem 0.5rem', fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center', width:48 }}>الفترة</th>
                        {['اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت','أحد'].map(d => (
                          <th key={d} style={{ padding:'0.4rem 0.25rem', fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center' }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthGrid.map((week, wi) => (
                        PERIODS.map(period => (
                          <tr key={`${wi}-${period.num}`}>
                            {/* عنوان الفترة — فقط في الصف الأول للأسبوع */}
                            {period.num === 1 ? (
                              <td rowSpan={3} style={{
                                textAlign:'center', fontSize:'0.65rem', color:'var(--text-muted)',
                                borderRight:'1px solid var(--border-subtle)',
                                verticalAlign:'middle',
                                padding:'0.2rem',
                              }}>
                                {wi === 0 ? week[0]?.date.getDate() : ''}
                              </td>
                            ) : null}
                            {period.num !== 1 && <td style={{ display:'none' }} />}
                            {week.map((cell, di) => {
                              const dateStr = toISO(cell.date)
                              const booked  = isBooked(dateStr, court.id, period.num)
                              const selec   = isSelected(dateStr, court.id, period.num)
                              const past    = dateStr < today
                              const otherMonth = !cell.isCurrentMonth

                              let bg = 'transparent'
                              let color = 'var(--text-main)'
                              let cursor = 'pointer'
                              if (past || otherMonth) { bg = 'transparent'; color = 'var(--text-muted)'; cursor = 'default' }
                              else if (booked) { bg = 'rgba(255,80,80,0.1)'; color = 'var(--danger)'; cursor = 'not-allowed' }
                              else if (selec)  { bg = 'rgba(163,230,53,0.25)'; color = 'var(--accent)' }

                              return (
                                <td
                                  key={di}
                                  style={{
                                    padding:'0.15rem 0.1rem',
                                    borderLeft: di > 0 ? '1px solid var(--border-subtle)' : 'none',
                                    borderBottom:'1px solid var(--border-subtle)',
                                  }}
                                >
                                  <button
                                    title={booked ? 'محجوزة' : selec ? 'انقر لإلغاء الاختيار' : period.label}
                                    disabled={past || otherMonth || booked}
                                    onClick={() => toggleSlot(dateStr, court.id, period.num)}
                                    style={{
                                      width:'100%', padding:'0.25rem 0.1rem',
                                      background: bg, color,
                                      border:'none', borderRadius:'0.25rem',
                                      cursor, fontSize:'0.65rem', fontWeight: selec ? 700 : 400,
                                      transition:'background 0.15s',
                                      display:'flex', alignItems:'center', justifyContent:'center', gap:2,
                                    }}
                                  >
                                    {selec ? <Check size={10}/> : booked ? '✗' : period.label}
                                  </button>
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
          </div>
        )}

        {/* شريط الفترات المختارة */}
        {selected.length > 0 && (
          <div style={{
            background:'var(--bg-card)', border:'1px solid var(--accent)',
            borderRadius:'0.75rem', padding:'1rem',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <span style={{ fontWeight:700, color:'var(--text-main)' }}>
                الفترات المختارة ({selected.length})
              </span>
              <button
                onClick={() => setSelected([])}
                style={{
                  background:'none', border:'1px solid var(--border-subtle)',
                  borderRadius:'0.4rem', padding:'0.2rem 0.5rem',
                  cursor:'pointer', color:'var(--danger)', fontSize:'0.75rem',
                  display:'flex', alignItems:'center', gap:'0.25rem',
                }}
              ><Trash2 size={12}/> مسح الكل</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
              {selected.map((s, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:'0.4rem',
                  background:'rgba(163,230,53,0.1)', border:'1px solid rgba(163,230,53,0.3)',
                  borderRadius:'0.4rem', padding:'0.25rem 0.5rem', fontSize:'0.78rem',
                  color:'var(--text-main)',
                }}>
                  <span>{s.day_label} · {s.court_label} · {s.period_label}</span>
                  <button
                    onClick={() => toggleSlot(s.date, s.court_id, s.period_number)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:0, display:'flex' }}
                  ><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* زر المتابعة */}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button
            onClick={() => { if (selected.length === 0) { showToast('err', 'اختر فترة واحدة على الأقل'); return } setStep('details') }}
            disabled={selected.length === 0}
            style={{
              background: selected.length > 0 ? 'var(--accent)' : 'var(--border-subtle)',
              color: selected.length > 0 ? '#000' : 'var(--text-muted)',
              border:'none', borderRadius:'0.6rem', padding:'0.75rem 2rem',
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
              fontWeight:700, fontSize:'0.95rem',
              display:'flex', alignItems:'center', gap:'0.5rem',
            }}
          >
            متابعة ({totalSlots} فترة)
            <ChevronLeft size={18}/>
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================
     STEP 2 — بيانات العميل + تفاصيل كل فترة
     ================================================================ */
  function renderDetails() {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        {/* رأس + شريط التقدم */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <button
            onClick={() => setStep('grid')}
            style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.5rem', padding:'0.5rem', cursor:'pointer', color:'var(--text-main)', display:'flex',
            }}
          ><ArrowRight size={18}/></button>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
            بيانات الباقة
          </h1>
        </div>

        {/* شريط التقدم */}
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {['اختيار الفترات','بيانات الباقة','النتيجة'].map((lbl, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', flex: i < 2 ? '1' : undefined }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background: i <= 1 ? 'var(--accent)' : 'var(--bg-card)',
                border: i <= 1 ? 'none' : '1px solid var(--border-subtle)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color: i <= 1 ? '#000' : 'var(--text-muted)', fontSize:'0.75rem', fontWeight:700,
              }}>{i <= 0 ? <Check size={12}/> : i+1}</div>
              <span style={{ fontSize:'0.8rem', color: i === 1 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: i === 1 ? 700 : 400 }}>{lbl}</span>
              {i < 2 && <div style={{ flex:1, height:2, background: i === 0 ? 'var(--accent)' : 'var(--border-subtle)', borderRadius:1 }} />}
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>

          {/* ── القسم الأيمن: بيانات العميل ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.75rem', padding:'1.25rem',
            }}>
              <h3 style={{ margin:'0 0 1rem 0', color:'var(--text-main)', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Users size={16}/> بيانات العميل
              </h3>

              {/* جوال */}
              <div style={{ marginBottom:'0.75rem' }}>
                <label style={{ fontSize:'0.8rem', color:'var(--text-muted)', display:'block', marginBottom:'0.3rem' }}>رقم الجوال</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    onKeyDown={e => e.key === 'Enter' && searchCustomer()}
                    style={{
                      flex:1, padding:'0.6rem 0.75rem',
                      background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)',
                      borderRadius:'0.5rem', color:'var(--text-main)', fontSize:'0.9rem', direction:'ltr',
                    }}
                  />
                  <button
                    onClick={searchCustomer} disabled={searching}
                    style={{
                      background:'var(--accent)', color:'#000', border:'none',
                      borderRadius:'0.5rem', padding:'0 0.75rem', cursor:'pointer',
                      display:'flex', alignItems:'center',
                    }}
                  >
                    {searching ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> : <Search size={16}/>}
                  </button>
                </div>
              </div>

              {/* حالة العميل */}
              {customer && (
                <div style={{
                  padding:'0.5rem 0.75rem', borderRadius:'0.4rem', marginBottom:'0.75rem',
                  background: customer.is_suspended ? 'rgba(255,80,80,0.1)' : customer.found ? 'rgba(163,230,53,0.1)' : 'rgba(255,180,0,0.1)',
                  border: `1px solid ${customer.is_suspended ? 'rgba(255,80,80,0.3)' : customer.found ? 'rgba(163,230,53,0.3)' : 'rgba(255,180,0,0.3)'}`,
                  fontSize:'0.82rem',
                  color: customer.is_suspended ? 'var(--danger)' : customer.found ? '#7bba00' : 'var(--warning)',
                }}>
                  {customer.is_suspended
                    ? `⚠ موقوف: ${customer.suspension_reason ?? 'تواصل مع الإدارة'}`
                    : customer.found ? '✓ عميل مسجّل' : '＋ عميل جديد — سيُسجَّل تلقائياً'}
                </div>
              )}

              {/* الاسم */}
              <div style={{ marginBottom:'0.75rem' }}>
                <label style={{ fontSize:'0.8rem', color:'var(--text-muted)', display:'block', marginBottom:'0.3rem' }}>الاسم</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  disabled={!nameEditable && customer?.found}
                  placeholder="اسم العميل"
                  style={{
                    width:'100%', padding:'0.6rem 0.75rem',
                    background: (!nameEditable && customer?.found) ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
                    border:'1px solid var(--border-subtle)',
                    borderRadius:'0.5rem', color:'var(--text-main)', fontSize:'0.9rem',
                    opacity: (!nameEditable && customer?.found) ? 0.7 : 1,
                  }}
                />
              </div>

              {/* الحالة */}
              <div style={{ marginBottom:'0.75rem' }}>
                <label style={{ fontSize:'0.8rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>حالة الدفع</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {([['confirmed','مؤكد (مدفوع)'],['pending','بانتظار الإيصال']] as const).map(([val, lbl]) => (
                    <button
                      key={val} onClick={() => setStatus(val)}
                      style={{
                        flex:1, padding:'0.5rem',
                        background: status === val ? 'var(--accent)' : 'var(--bg-elevated)',
                        color: status === val ? '#000' : 'var(--text-muted)',
                        border: `1px solid ${status === val ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        borderRadius:'0.5rem', cursor:'pointer', fontSize:'0.8rem', fontWeight: status === val ? 700 : 400,
                      }}
                    >{lbl}</button>
                  ))}
                </div>
              </div>

              {/* ملاحظة */}
              <div>
                <label style={{ fontSize:'0.8rem', color:'var(--text-muted)', display:'block', marginBottom:'0.3rem' }}>ملاحظة داخلية (اختياري)</label>
                <textarea
                  value={note} onChange={e => setNote(e.target.value)}
                  rows={2} placeholder="ملاحظة للإدارة..."
                  style={{
                    width:'100%', padding:'0.6rem 0.75rem',
                    background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)',
                    borderRadius:'0.5rem', color:'var(--text-main)', fontSize:'0.85rem',
                    resize:'vertical',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── القسم الأيسر: تفاصيل كل فترة ── */}
          <div>
            <div style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.75rem', padding:'1.25rem',
            }}>
              <h3 style={{ margin:'0 0 1rem 0', color:'var(--text-main)', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <CalendarDays size={16}/> الفترات ({selected.length})
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', maxHeight:'55vh', overflowY:'auto' }}>
                {selected.map((s, idx) => (
                  <div key={idx} style={{
                    background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)',
                    borderRadius:'0.6rem', padding:'0.75rem',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                      <span style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-main)' }}>
                        {s.day_label} · {s.court_label} · {s.period_label}
                      </span>
                      <button
                        onClick={() => toggleSlot(s.date, s.court_id, s.period_number)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', display:'flex' }}
                      ><X size={14}/></button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                      {/* كود الخصم */}
                      <div>
                        <label style={{ fontSize:'0.7rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>كود الخصم</label>
                        <input
                          type="text" value={s.code_used}
                          onChange={e => updateSlot(idx, 'code_used', e.target.value.toUpperCase())}
                          placeholder="اختياري"
                          style={{
                            width:'100%', padding:'0.4rem 0.5rem',
                            background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
                            borderRadius:'0.4rem', color:'var(--text-main)', fontSize:'0.82rem',
                          }}
                        />
                      </div>
                      {/* كمية المياه */}
                      <div>
                        <label style={{ fontSize:'0.7rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>المياه (كرتون)</label>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                          <button
                            onClick={() => updateSlot(idx, 'water_quantity', Math.max(0, Number(s.water_quantity) - 1))}
                            style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'0.3rem', padding:'0.25rem', cursor:'pointer', color:'var(--text-main)', display:'flex' }}
                          ><Minus size={12}/></button>
                          <span style={{ minWidth:24, textAlign:'center', fontSize:'0.9rem', fontWeight:700, color:'var(--text-main)' }}>
                            {s.water_quantity}
                          </span>
                          <button
                            onClick={() => updateSlot(idx, 'water_quantity', Number(s.water_quantity) + 1)}
                            style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'0.3rem', padding:'0.25rem', cursor:'pointer', color:'var(--text-main)', display:'flex' }}
                          ><Plus size={12}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* زر التأكيد */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
          <button
            onClick={() => setStep('grid')}
            style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.6rem', padding:'0.75rem 1.5rem', cursor:'pointer',
              color:'var(--text-main)', fontWeight:600,
            }}
          >
            ← تعديل الفترات
          </button>
          <button
            onClick={handleSubmit} disabled={saving}
            style={{
              background:'var(--accent)', color:'#000', border:'none',
              borderRadius:'0.6rem', padding:'0.75rem 2rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight:700, fontSize:'0.95rem',
              display:'flex', alignItems:'center', gap:'0.5rem',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> : <BadgeCheck size={16}/>}
            {saving ? 'جارٍ الإنشاء...' : `تأكيد الباقة (${selected.length} فترة)`}
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
      <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:640, margin:'0 auto' }}>
        {/* الحالة الكلية */}
        <div style={{
          textAlign:'center', padding:'2rem',
          background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'1rem',
        }}>
          <div style={{ fontSize:3.5+'rem', marginBottom:'0.5rem' }}>
            {result.failed === 0 ? '🎉' : result.created > 0 ? '⚠️' : '❌'}
          </div>
          <h2 style={{ color:'var(--text-main)', margin:'0 0 0.5rem 0', fontSize:'1.3rem' }}>
            {result.failed === 0 ? 'تمت إنشاء الباقة بنجاح' : result.created > 0 ? 'أُنشئت الباقة جزئياً' : 'فشل إنشاء الباقة'}
          </h2>
          <p style={{ color:'var(--text-muted)', margin:0, fontSize:'0.9rem' }}>
            رقم الباقة: <span style={{ color:'var(--accent)', fontWeight:700, fontFamily:'monospace' }}>{result.batch_id}</span>
          </p>
          <div style={{ display:'flex', justifyContent:'center', gap:'2rem', marginTop:'1rem' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:800, color:'#7bba00' }}>{result.created}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>نجحت</div>
            </div>
            {result.failed > 0 && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'1.8rem', fontWeight:800, color:'var(--danger)' }}>{result.failed}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>فشلت</div>
              </div>
            )}
          </div>
        </div>

        {/* تفاصيل النتائج */}
        <div style={{
          background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'0.75rem', padding:'1.25rem',
        }}>
          <h3 style={{ margin:'0 0 1rem 0', color:'var(--text-main)', fontSize:'0.95rem' }}>تفاصيل الفترات</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {result.results.map((r, i) => {
              const slot = selected[i]
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:'0.75rem',
                  padding:'0.5rem 0.75rem', borderRadius:'0.4rem',
                  background: r.ok ? 'rgba(163,230,53,0.08)' : 'rgba(255,80,80,0.08)',
                }}>
                  {r.ok
                    ? <CheckCircle2 size={16} style={{ color:'#7bba00', flexShrink:0 }}/>
                    : <AlertCircle  size={16} style={{ color:'var(--danger)', flexShrink:0 }}/>
                  }
                  <span style={{ fontSize:'0.85rem', color:'var(--text-main)', flex:1 }}>
                    {slot?.day_label ?? r.booking_date} · {slot?.court_label ?? r.court_id} · {slot?.period_label ?? r.period_number}
                  </span>
                  {!r.ok && <span style={{ fontSize:'0.75rem', color:'var(--danger)' }}>{r.error}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* أزرار */}
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
          <button
            onClick={() => router.push('/admin/bookings')}
            style={{
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.6rem', padding:'0.75rem 1.5rem', cursor:'pointer',
              color:'var(--text-main)', fontWeight:600,
            }}
          >عرض الحجوزات</button>
          <button
            onClick={() => { setStep('grid'); setSelected([]); setResult(null); setPhone(''); setName(''); setCustomer(null); setNote('') }}
            style={{
              background:'var(--accent)', color:'#000', border:'none',
              borderRadius:'0.6rem', padding:'0.75rem 1.5rem', cursor:'pointer', fontWeight:700,
            }}
          >إنشاء باقة جديدة</button>
        </div>
      </div>
    )
  }

  /* ================================================================
     الـ Render الرئيسي
     ================================================================ */
  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--bg-main)',
      padding:'1.5rem',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:'1rem', right:'1rem', zIndex:9999,
          background: toast.type === 'ok' ? 'var(--accent)' : 'var(--danger)',
          color: toast.type === 'ok' ? '#000' : '#fff',
          padding:'0.75rem 1.25rem', borderRadius:'0.6rem',
          fontWeight:600, fontSize:'0.9rem', boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
          animation:'slideIn 0.2s ease',
        }}>
          {toast.type === 'ok' ? '✓ ' : '✗ '}{toast.text}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes slideIn { from { opacity:0; transform:translateX(1rem) } to { opacity:1; transform:translateX(0) } }
      `}</style>

      {step === 'grid'    && renderGrid()}
      {step === 'details' && renderDetails()}
      {step === 'result'  && renderResult()}
    </div>
  )
}
