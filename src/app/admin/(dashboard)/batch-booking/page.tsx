'use client'
// ============================================================
// صفحة الحجز المتعدد — /admin/batch-booking
// تصميم "أسبوع ككتلة" — Lime Neon × Dark/Light
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Search, Check, X, ChevronLeft, ChevronRight,
  Loader2, Plus, Minus, AlertCircle, CheckCircle2, Package,
  CalendarDays, Users, BadgeCheck, Trash2,
} from 'lucide-react'

/* ════════════════════════════════════════════════ ثوابت */
const COURTS = [
  { id: 'football',   label: 'كرة القدم',    abbr: 'قدم',   icon: '⚽', color: '#3b82f6' },
  { id: 'volleyball', label: 'الكرة الطائرة', abbr: 'طائرة', icon: '🏐', color: '#a855f7' },
  { id: 'multi',      label: 'الملعب المتعدد', abbr: 'متعدد', icon: '🏅', color: '#f59e0b' },
]
const PERIODS = [
  { num: 1, label: '5-7م',  chip: '5م'  },
  { num: 2, label: '7-9م',  chip: '7م'  },
  { num: 3, label: '9-11م', chip: '9م'  },
]
// ترتيب اثنين→أحد (المصفوفة تبدأ من 0=أحد)
const DAY_SHORT = ['أحد','اثن','ثلث','أرب','خمس','جمع','سبت']
const AR_DAYS   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
// ترتيب رأس الأعمدة (الشبكة تبدأ اثنين→أحد)
const WEEK_HEADERS = ['اثن','ثلث','أرب','خمس','جمع','سبت','أحد']

/* ════════════════════════════════════════════════ مساعدات التاريخ */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function getMonthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function getDaysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate() }

function buildWeeks(base: Date): { date: Date; inMonth: boolean }[][] {
  const start  = getMonthStart(base)
  const total  = getDaysInMonth(base)
  const dow    = start.getDay()               // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1     // Mon offset
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = -offset; i < total; i++) cells.push({ date: addDays(start, i), inMonth: i >= 0 })
  while (cells.length % 7 !== 0) cells.push({ date: addDays(cells[cells.length-1].date,1), inMonth: false })
  const weeks: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7))
  return weeks
}

/* ════════════════════════════════════════════════ أنواع */
interface SlotRow { day_date:string; court_id:string; period_number:number; is_available:boolean }
interface BlockedRow { id:string; court_id:string; date:string; period_number:number; reason:string|null }
interface AvailData { slots:SlotRow[]; blocked:BlockedRow[]; settings:Record<string,string> }
type SlotState = 'available'|'booked'|'blocked'
interface SelectedSlot {
  date:string; court_id:string; period_number:number
  code_used:string; water_quantity:number
  court_label?:string; period_label?:string; day_label?:string
}
interface CustomerInfo { found:boolean; name?:string; is_suspended?:boolean; suspension_reason?:string|null }

/* ════════════════════════════════════════════════ الصفحة */
export default function BatchBookingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'grid'|'details'|'result'>('grid')

  const [monthDate,   setMonthDate]   = useState<Date>(() => new Date())
  const [avail,       setAvail]       = useState<AvailData|null>(null)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [gridError,   setGridError]   = useState('')
  const [selected,    setSelected]    = useState<SelectedSlot[]>([])

  const [phone,        setPhone]        = useState('')
  const [name,         setName]         = useState('')
  const [nameEditable, setNameEditable] = useState(false)
  const [status,       setStatus]       = useState<'confirmed'|'pending'>('confirmed')
  const [note,         setNote]         = useState('')
  const [customer,     setCustomer]     = useState<CustomerInfo|null>(null)
  const [searching,    setSearching]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [result,       setResult]       = useState<{
    success:boolean; batch_id:string; created:number; failed:number
    results:{booking_date:string;court_id:string;period_number:number;ok:boolean;error?:string}[]
  }|null>(null)

  const [toast, setToast] = useState<{type:'ok'|'err';text:string}|null>(null)
  function showToast(type:'ok'|'err', text:string) { setToast({type,text}); setTimeout(()=>setToast(null),3200) }

  /* جلب التوافر */
  const fetchMonth = useCallback(async (base: Date) => {
    setLoadingGrid(true); setGridError('')
    const start = getMonthStart(base)
    const end   = new Date(base.getFullYear(), base.getMonth()+1, 0)
    try {
      const r = await fetch(`/api/admin/availability?from=${toISO(start)}&to=${toISO(end)}`)
      if (!r.ok) throw new Error()
      setAvail(await r.json())
    } catch { setGridError('فشل تحميل بيانات التوافر') }
    finally  { setLoadingGrid(false) }
  }, [])

  useEffect(() => { fetchMonth(monthDate) }, [monthDate, fetchMonth])

  /* حالة الخلية */
  function slotState(date:string, cid:string, p:number): SlotState {
    if (avail?.blocked.some(b => b.court_id===cid && b.date===date && b.period_number===p)) return 'blocked'
    const s = avail?.slots.find(s => s.court_id===cid && s.day_date===date && s.period_number===p)
    return (s && !s.is_available) ? 'booked' : 'available'
  }
  function isSel(date:string, cid:string, p:number): boolean {
    return selected.some(s=>s.date===date&&s.court_id===cid&&s.period_number===p)
  }
  function toggle(date:string, cid:string, p:number) {
    if (slotState(date,cid,p) !== 'available') return
    const c  = COURTS.find(c=>c.id===cid)
    const pr = PERIODS.find(r=>r.num===p)
    const d  = new Date(date+'T00:00:00')
    if (isSel(date,cid,p))
      setSelected(prev=>prev.filter(s=>!(s.date===date&&s.court_id===cid&&s.period_number===p)))
    else
      setSelected(prev=>[...prev,{
        date, court_id:cid, period_number:p, code_used:'', water_quantity:0,
        court_label:`${c?.icon??''} ${c?.label??cid}`,
        period_label: pr?.label??String(p),
        day_label:`${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]}`,
      }])
  }

  async function searchCustomer() {
    if (!phone.trim()) return
    setSearching(true); setCustomer(null); setName(''); setNameEditable(false)
    try {
      const r = await fetch(`/api/admin/customers/search?phone=${encodeURIComponent(phone.trim())}`)
      const d = await r.json()
      setCustomer(d)
      if (d.found) { setName(d.name??''); setNameEditable(false) }
      else         { setName('');          setNameEditable(true)  }
    } catch { setNameEditable(true) }
    finally { setSearching(false) }
  }

  function updSlot(idx:number, f:'code_used'|'water_quantity', v:string|number) {
    setSelected(prev=>prev.map((s,i)=>i===idx?{...s,[f]:v}:s))
  }

  async function handleSubmit() {
    if (!selected.length) { showToast('err','اختر فترة على الأقل'); return }
    if (!phone.trim()||!name.trim()) { showToast('err','أدخل الجوال والاسم'); return }
    if (customer?.is_suspended) { showToast('err','العميل موقوف'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/batch-booking',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          slots: selected.map(s=>({
            booking_date:s.date, court_id:s.court_id, period_number:s.period_number,
            code_used:s.code_used.trim()||null, water_quantity:Number(s.water_quantity)||0,
          })),
          customer_name:name.trim(), customer_phone:phone.trim(),
          status, internal_note:note.trim()||null,
        }),
      })
      const d = await r.json()
      if (r.ok) { setResult(d); setStep('result') }
      else showToast('err', d.error??'فشل إنشاء الباقة')
    } catch { showToast('err','تعذّر الاتصال بالخادم') }
    finally { setSaving(false) }
  }

  const weeks = buildWeeks(monthDate)
  const today = toISO(new Date())

  /* ════════════════════════════════════ STEP 1 — الشبكة الجديدة */
  function renderGrid() {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
        <style>{`
          @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          .period-chip { transition: background 0.12s, border-color 0.12s, transform 0.1s; }
          .period-chip:hover:not(:disabled) { transform: scale(1.08); }
          .week-block { animation: fadeUp 0.18s ease both; }
        `}</style>

        {/* ── رأس الصفحة ── */}
        <div style={{display:'flex',alignItems:'center',gap:'0.7rem'}}>
          <button onClick={()=>router.push('/admin/bookings')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.5rem',padding:'0.4rem 0.55rem',cursor:'pointer',
            color:'var(--text-primary)',display:'flex',alignItems:'center',flexShrink:0,
          }}><ArrowRight size={16}/></button>
          <div>
            <h1 style={{margin:0,fontSize:'1.15rem',fontWeight:800,color:'var(--text-primary)',
              display:'flex',alignItems:'center',gap:'0.4rem',lineHeight:1.2}}>
              <Package size={18} style={{color:'var(--color-lime)'}}/> الحجز المتعدد
            </h1>
            <p style={{margin:0,fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>
              اختر الفترات من الشبكة — يمكنك التنقل بين الأشهر
            </p>
          </div>
          {selected.length > 0 && (
            <div style={{
              marginRight:'auto',
              background:'var(--color-lime-muted)',
              border:'1px solid var(--color-lime-dim)',
              borderRadius:'999px', padding:'0.25rem 0.7rem',
              fontSize:'0.78rem', fontWeight:700,
              color:'var(--color-lime)',
              display:'flex',alignItems:'center',gap:'0.3rem',
            }}>
              <Check size={11}/> {selected.length} فترة مختارة
            </div>
          )}
        </div>

        {/* ── شريط التقدم ── */}
        <StepBar step={0}/>

        {/* ── تنقل الشهر ── */}
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'var(--bg-card)',border:'1px solid var(--border-color)',
          borderRadius:'0.75rem',padding:'0.6rem 1rem',
        }}>
          <button onClick={()=>setMonthDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{
            background:'var(--bg-elevated)',border:'1px solid var(--border-color)',
            borderRadius:'0.4rem',padding:'0.3rem 0.5rem',cursor:'pointer',
            color:'var(--text-primary)',display:'flex',alignItems:'center',
            transition:'background 0.12s',
          }}><ChevronRight size={16}/></button>

          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:800,fontSize:'1rem',color:'var(--text-primary)',lineHeight:1.1}}>
              {AR_MONTHS[monthDate.getMonth()]}
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginTop:'0.05rem'}}>
              {monthDate.getFullYear()}
            </div>
          </div>

          <button onClick={()=>setMonthDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{
            background:'var(--bg-elevated)',border:'1px solid var(--border-color)',
            borderRadius:'0.4rem',padding:'0.3rem 0.5rem',cursor:'pointer',
            color:'var(--text-primary)',display:'flex',alignItems:'center',
            transition:'background 0.12s',
          }}><ChevronLeft size={16}/></button>
        </div>

        {/* ── الشبكة ── */}
        {loadingGrid ? (
          <div style={{
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            padding:'3.5rem',gap:'0.75rem',
            background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'0.875rem',
          }}>
            <Loader2 size={28} style={{color:'var(--color-lime)',animation:'spin 1s linear infinite'}}/>
            <span style={{fontSize:'0.83rem',color:'var(--text-muted)'}}>جاري تحميل التوافر...</span>
          </div>
        ) : gridError ? (
          <div style={{
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            padding:'2.5rem',gap:'0.5rem',
            background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'0.875rem',
          }}>
            <AlertCircle size={24} style={{color:'var(--color-danger)'}}/>
            <span style={{fontSize:'0.84rem',color:'var(--color-danger)'}}>{gridError}</span>
            <button onClick={()=>fetchMonth(monthDate)} style={{
              marginTop:'0.25rem',background:'var(--bg-elevated)',border:'1px solid var(--border-color)',
              borderRadius:'0.4rem',padding:'0.35rem 0.8rem',cursor:'pointer',
              color:'var(--text-primary)',fontSize:'0.8rem',
            }}>إعادة المحاولة</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>

            {/* ════ كتل الأسابيع ════ */}
            {weeks.map((week, wi) => {
              // هل الأسبوع كله خارج الشهر؟ نخفيه
              const hasInMonth = week.some(c => c.inMonth)
              if (!hasInMonth) return null
              return (
                <div key={wi} className="week-block" style={{
                  background:'var(--bg-card)',
                  border:'1px solid var(--border-color)',
                  borderRadius:'0.875rem',
                  overflow:'hidden',
                  animationDelay:`${wi*0.04}s`,
                }}>

                  {/* ─── رأس الأيام ─── */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'44px repeat(7,1fr)',
                    background:'var(--bg-elevated)',
                    borderBottom:'1px solid var(--border-color)',
                  }}>
                    {/* زاوية فارغة */}
                    <div style={{
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:'0.55rem',color:'var(--text-muted)',fontWeight:600,
                      padding:'0.25rem',borderLeft:'1px solid var(--border-subtle)',
                    }}>
                      ملعب
                    </div>
                    {week.map((cell, di) => {
                      const ds       = toISO(cell.date)
                      const isToday  = ds === today
                      const out      = !cell.inMonth
                      return (
                        <div key={di} style={{
                          display:'flex',flexDirection:'column',alignItems:'center',
                          padding:'0.3rem 0.1rem 0.35rem',
                          borderRight: di < 6 ? '1px solid var(--border-subtle)' : 'none',
                          opacity: out ? 0.35 : 1,
                        }}>
                          {/* اسم اليوم */}
                          <span style={{
                            fontSize:'0.58rem',fontWeight:600,
                            color: isToday ? 'var(--color-lime)' : 'var(--text-muted)',
                            marginBottom:'0.2rem',letterSpacing:'0.02em',
                          }}>
                            {WEEK_HEADERS[di]}
                          </span>
                          {/* دائرة رقم اليوم */}
                          <div style={{
                            width:24,height:24,borderRadius:'50%',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:'0.68rem',fontWeight:700,
                            background: isToday ? 'var(--color-lime)' : 'transparent',
                            color: isToday
                              ? 'var(--text-on-lime)'
                              : cell.inMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                            border: isToday ? 'none' : cell.inMonth
                              ? '1.5px solid var(--border-color)'
                              : 'none',
                            boxShadow: isToday ? '0 0 8px rgba(200,255,62,0.4)' : 'none',
                          }}>
                            {cell.date.getDate()}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ─── صفوف الملاعب ─── */}
                  {COURTS.map((court, ci) => {
                    const courtSelected = selected.filter(s =>
                      s.court_id === court.id &&
                      week.some(c => toISO(c.date) === s.date)
                    ).length
                    return (
                      <div key={court.id} style={{
                        display:'grid',
                        gridTemplateColumns:'44px repeat(7,1fr)',
                        borderTop: ci > 0 ? '1px solid var(--border-color)' : 'none',
                      }}>

                        {/* ── أيقونة الملعب ── */}
                        <div style={{
                          display:'flex',flexDirection:'column',
                          alignItems:'center',justifyContent:'center',
                          padding:'0.45rem 0.15rem',
                          background:`color-mix(in srgb, ${court.color} 7%, var(--bg-elevated))`,
                          borderLeft:`2.5px solid ${court.color}`,
                          gap:'0.2rem',
                          position:'relative',
                        }}>
                          <span style={{fontSize:'1.05rem',lineHeight:1}}>{court.icon}</span>
                          <span style={{
                            fontSize:'0.48rem',fontWeight:700,
                            color:court.color,textAlign:'center',lineHeight:1.1,
                            maxWidth:36,wordBreak:'break-all',
                          }}>{court.abbr}</span>
                          {/* عداد الاختيار لهذا الملعب في هذا الأسبوع */}
                          {courtSelected > 0 && (
                            <div style={{
                              position:'absolute',top:3,right:3,
                              width:14,height:14,borderRadius:'50%',
                              background:court.color,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:'0.45rem',fontWeight:800,color:'#fff',
                            }}>{courtSelected}</div>
                          )}
                        </div>

                        {/* ── خلايا الأيام ── */}
                        {week.map((cell, di) => {
                          const ds   = toISO(cell.date)
                          const past = ds < today
                          const out  = !cell.inMonth
                          return (
                            <div key={di} style={{
                              display:'flex',flexDirection:'column',
                              alignItems:'stretch',
                              padding:'0.3rem 0.18rem',
                              gap:'0.2rem',
                              borderRight: di < 6 ? '1px solid var(--border-subtle)' : 'none',
                              background: out ? 'var(--bg-elevated)'
                                : past ? 'rgba(0,0,0,0.018)'
                                : 'transparent',
                              opacity: out ? 0.25 : 1,
                            }}>
                              {PERIODS.map(period => {
                                const state = slotState(ds, court.id, period.num)
                                const sel   = isSel(ds, court.id, period.num)
                                const active= !out && !past && state === 'available'

                                /* ── ألوان الـ chip ── */
                                let bg     = 'var(--bg-elevated)'
                                let clr    = 'var(--text-muted)'
                                let border = '1px solid var(--border-subtle)'
                                let content: React.ReactNode = period.chip
                                let fw     = 400

                                if (out || past) {
                                  bg = 'transparent'; clr = 'transparent'
                                  border = '1px solid transparent'; content = null
                                } else if (sel) {
                                  bg     = `color-mix(in srgb, ${court.color} 18%, var(--bg-elevated))`
                                  clr    = court.color
                                  border = `1.5px solid ${court.color}`
                                  content= <Check size={8} strokeWidth={3}/>
                                  fw     = 700
                                } else if (state === 'booked') {
                                  bg     = 'transparent'
                                  clr    = 'var(--text-muted)'
                                  border = '1px solid var(--border-subtle)'
                                  content= <span style={{opacity:0.45,fontSize:'0.5rem'}}>✕</span>
                                } else if (state === 'blocked') {
                                  bg     = 'transparent'
                                  clr    = 'var(--text-muted)'
                                  border = '1px dashed var(--border-color)'
                                  content= <span style={{opacity:0.4,fontSize:'0.55rem'}}>—</span>
                                }

                                return (
                                  <button
                                    key={period.num}
                                    className="period-chip"
                                    disabled={!active}
                                    onClick={() => toggle(ds, court.id, period.num)}
                                    title={
                                      !active ? undefined
                                      : sel ? `إلغاء: ${period.label} · ${court.label}`
                                      : `حجز: ${period.label} · ${court.label}`
                                    }
                                    style={{
                                      width:'100%', height:21, flexShrink:0,
                                      borderRadius:'0.22rem',
                                      border, background:bg, color:clr,
                                      cursor: active ? 'pointer' : 'default',
                                      fontSize:'0.55rem', fontWeight:fw,
                                      display:'flex',alignItems:'center',
                                      justifyContent:'center', padding:0,
                                      boxShadow: sel
                                        ? `0 0 0 1px ${court.color}33, 0 1px 4px ${court.color}22`
                                        : 'none',
                                    }}
                                  >
                                    {content}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* ── مفتاح الألوان ── */}
            <div style={{
              display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap',
              padding:'0.45rem 0.75rem',
              background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
              borderRadius:'0.5rem',
            }}>
              {[
                {bg:`color-mix(in srgb, #3b82f6 18%, var(--bg-elevated))`,
                 border:'#3b82f6', label:'مختار (لون الملعب)'},
                {bg:'transparent', border:'var(--border-subtle)', label:'متاح', extra:'5م'},
                {bg:'transparent', border:'var(--border-subtle)', label:'محجوز', extra:'✕'},
                {bg:'transparent', border:'var(--border-color)',  label:'محجوب', extra:'—', dashed:true},
              ].map(({bg,border,label,extra,dashed})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                  <div style={{
                    width:22,height:16,borderRadius:3,
                    background:bg,
                    border:`${dashed?'1px dashed':'1px solid'} ${border}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'0.48rem',color:'var(--text-muted)',
                  }}>{extra}</div>
                  <span style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── الفترات المختارة ── */}
        {selected.length > 0 && (
          <div style={{
            background:'var(--bg-card)',
            border:'1px solid var(--border-color)',
            borderRadius:'0.75rem',padding:'0.8rem',
          }}>
            <div style={{
              display:'flex',justifyContent:'space-between',
              alignItems:'center',marginBottom:'0.55rem',
            }}>
              <span style={{fontWeight:700,fontSize:'0.85rem',color:'var(--text-primary)'}}>
                الفترات المختارة ({selected.length})
              </span>
              <button onClick={()=>setSelected([])} style={{
                background:'none',border:'1px solid var(--color-danger-bg)',
                borderRadius:'0.35rem',padding:'0.18rem 0.5rem',
                cursor:'pointer',color:'var(--color-danger)',fontSize:'0.7rem',
                display:'flex',alignItems:'center',gap:'0.2rem',
              }}><Trash2 size={10}/> مسح الكل</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
              {selected.map((s,i)=>{
                const court = COURTS.find(c=>c.id===s.court_id)
                return (
                  <div key={i} style={{
                    display:'flex',alignItems:'center',gap:'0.28rem',
                    background:'var(--bg-elevated)',
                    border:`1px solid ${court?.color??'var(--border-color)'}44`,
                    borderRadius:'999px',
                    padding:'0.18rem 0.45rem 0.18rem 0.35rem',
                    fontSize:'0.73rem',color:'var(--text-primary)',
                  }}>
                    <span style={{
                      width:7,height:7,borderRadius:'50%',
                      background:court?.color??'var(--color-lime)',flexShrink:0,
                    }}/>
                    <span style={{lineHeight:1.2}}>
                      {s.day_label} · {s.period_label}
                    </span>
                    <button onClick={()=>toggle(s.date,s.court_id,s.period_number)} style={{
                      background:'none',border:'none',cursor:'pointer',
                      color:'var(--text-muted)',padding:0,display:'flex',
                      marginRight:'0.05rem',opacity:0.7,
                    }}><X size={10}/></button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── زر المتابعة ── */}
        <div style={{display:'flex',justifyContent:'flex-end',paddingBottom:'0.25rem'}}>
          <button
            onClick={()=>{ if(!selected.length){showToast('err','اختر فترة على الأقل');return} setStep('details') }}
            style={{
              background: selected.length ? 'var(--color-lime)' : 'transparent',
              color: selected.length ? 'var(--text-on-lime)' : 'var(--text-muted)',
              border: selected.length
                ? '2px solid var(--color-lime)'
                : '2px solid var(--border-color)',
              borderRadius:'0.65rem', padding:'0.65rem 1.75rem',
              cursor: selected.length ? 'pointer' : 'not-allowed',
              fontWeight:700, fontSize:'0.9rem',
              display:'flex', alignItems:'center', gap:'0.4rem',
              transition:'all 0.15s',
              boxShadow: selected.length
                ? '0 0 0 3px rgba(200,255,62,0.15), 0 2px 8px rgba(200,255,62,0.12)'
                : 'none',
            }}
          >
            متابعة ({selected.length} فترة) <ChevronLeft size={16}/>
          </button>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════ STEP 2 — بيانات العميل */
  function renderDetails() {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.7rem'}}>
          <button onClick={()=>setStep('grid')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.5rem',padding:'0.4rem 0.55rem',cursor:'pointer',
            color:'var(--text-primary)',display:'flex',
          }}><ArrowRight size={16}/></button>
          <h1 style={{margin:0,fontSize:'1.15rem',fontWeight:800,color:'var(--text-primary)'}}>
            بيانات الباقة
          </h1>
        </div>

        <StepBar step={1}/>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr',gap:'1rem'}}>

          {/* عمود بيانات العميل */}
          <div style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.75rem',padding:'1rem',
            display:'flex',flexDirection:'column',gap:'0.75rem',
          }}>
            <h3 style={{margin:0,fontSize:'0.85rem',fontWeight:700,color:'var(--text-primary)',
              display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <Users size={14} style={{color:'var(--color-lime)'}}/> بيانات العميل
            </h3>

            <div>
              <label style={{fontSize:'0.72rem',color:'var(--text-muted)',display:'block',marginBottom:'0.2rem'}}>
                رقم الجوال
              </label>
              <div style={{display:'flex',gap:'0.4rem'}}>
                <input type="tel" value={phone}
                  onChange={e=>setPhone(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchCustomer()}
                  placeholder="05XXXXXXXX"
                  style={{flex:1,padding:'0.48rem 0.6rem',
                    background:'var(--bg-elevated)',
                    border:'1px solid var(--border-color)',
                    borderRadius:'0.45rem',color:'var(--text-primary)',
                    fontSize:'0.85rem',direction:'ltr'}}/>
                <button onClick={searchCustomer} disabled={searching} style={{
                  background:'var(--color-lime)',color:'var(--text-on-lime)',border:'none',
                  borderRadius:'0.45rem',padding:'0 0.65rem',cursor:'pointer',
                  display:'flex',alignItems:'center',flexShrink:0,
                }}>
                  {searching
                    ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>
                    : <Search size={14}/>}
                </button>
              </div>
            </div>

            {customer && (
              <div style={{
                padding:'0.35rem 0.55rem',borderRadius:'0.4rem',
                fontSize:'0.75rem',fontWeight:600,
                background: customer.is_suspended
                  ? 'var(--color-danger-bg)'
                  : customer.found
                  ? 'var(--color-success-bg)'
                  : 'var(--color-warning-bg)',
                color: customer.is_suspended
                  ? 'var(--color-danger)'
                  : customer.found
                  ? 'var(--color-success)'
                  : 'var(--color-warning)',
                border:`1px solid ${customer.is_suspended
                  ? 'rgba(224,85,85,0.2)'
                  : customer.found
                  ? 'rgba(200,255,62,0.2)'
                  : 'rgba(245,166,35,0.2)'}`,
              }}>
                {customer.is_suspended
                  ? `⚠ موقوف: ${customer.suspension_reason??'—'}`
                  : customer.found
                  ? '✓ عميل مسجّل'
                  : '＋ عميل جديد — يُسجَّل تلقائياً'}
              </div>
            )}

            <div>
              <label style={{fontSize:'0.72rem',color:'var(--text-muted)',display:'block',marginBottom:'0.2rem'}}>
                الاسم
              </label>
              <input type="text" value={name}
                onChange={e=>setName(e.target.value)}
                disabled={!nameEditable&&!!customer?.found}
                placeholder="اسم العميل"
                style={{width:'100%',padding:'0.48rem 0.6rem',
                  background:'var(--bg-elevated)',
                  border:'1px solid var(--border-color)',
                  borderRadius:'0.45rem',color:'var(--text-primary)',
                  fontSize:'0.85rem',
                  opacity:(!nameEditable&&customer?.found)?0.65:1}}/>
            </div>

            <div>
              <label style={{fontSize:'0.72rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>
                حالة الدفع
              </label>
              <div style={{display:'flex',gap:'0.4rem'}}>
                {(['confirmed','pending'] as const).map(v=>(
                  <button key={v} onClick={()=>setStatus(v)} style={{
                    flex:1,padding:'0.42rem',
                    background: status===v ? 'var(--color-lime)' : 'var(--bg-elevated)',
                    color: status===v ? 'var(--text-on-lime)' : 'var(--text-muted)',
                    border:`1px solid ${status===v?'var(--color-lime)':'var(--border-color)'}`,
                    borderRadius:'0.4rem',cursor:'pointer',
                    fontSize:'0.75rem',fontWeight:status===v?700:400,
                    transition:'all 0.12s',
                  }}>
                    {v==='confirmed'?'مؤكد (مدفوع)':'بانتظار الإيصال'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{fontSize:'0.72rem',color:'var(--text-muted)',display:'block',marginBottom:'0.2rem'}}>
                ملاحظة داخلية (اختياري)
              </label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
                placeholder="ملاحظة للإدارة..."
                style={{width:'100%',padding:'0.48rem 0.6rem',
                  background:'var(--bg-elevated)',
                  border:'1px solid var(--border-color)',
                  borderRadius:'0.45rem',color:'var(--text-primary)',
                  fontSize:'0.8rem',resize:'vertical'}}/>
            </div>
          </div>

          {/* عمود الفترات */}
          <div style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.75rem',padding:'1rem',
            display:'flex',flexDirection:'column',gap:'0.75rem',
          }}>
            <h3 style={{margin:0,fontSize:'0.85rem',fontWeight:700,color:'var(--text-primary)',
              display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <CalendarDays size={14} style={{color:'var(--color-lime)'}}/> الفترات ({selected.length})
            </h3>
            <div style={{
              display:'flex',flexDirection:'column',gap:'0.5rem',
              maxHeight:'54vh',overflowY:'auto',paddingLeft:'0.15rem',
            }}>
              {selected.map((s,idx)=>{
                const court = COURTS.find(c=>c.id===s.court_id)
                return (
                  <div key={idx} style={{
                    background:'var(--bg-elevated)',
                    border:'1px solid var(--border-color)',
                    borderRadius:'0.5rem',padding:'0.55rem 0.65rem',
                    borderRight:`3px solid ${court?.color??'var(--color-lime)'}`,
                  }}>
                    <div style={{
                      display:'flex',justifyContent:'space-between',
                      alignItems:'center',marginBottom:'0.35rem',
                    }}>
                      <span style={{fontSize:'0.77rem',fontWeight:600,color:'var(--text-primary)',lineHeight:1.3}}>
                        {s.day_label}<br/>
                        <span style={{fontSize:'0.68rem',color:'var(--text-secondary)',fontWeight:400}}>
                          {s.court_label} · {s.period_label}
                        </span>
                      </span>
                      <button onClick={()=>toggle(s.date,s.court_id,s.period_number)} style={{
                        background:'none',border:'none',cursor:'pointer',
                        color:'var(--text-muted)',display:'flex',padding:0,flexShrink:0,
                      }}><X size={13}/></button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.35rem'}}>
                      <div>
                        <label style={{fontSize:'0.65rem',color:'var(--text-muted)',display:'block',marginBottom:'0.12rem'}}>
                          كود الخصم
                        </label>
                        <input type="text" value={s.code_used}
                          onChange={e=>updSlot(idx,'code_used',e.target.value.toUpperCase())}
                          placeholder="اختياري"
                          style={{width:'100%',padding:'0.3rem 0.4rem',
                            background:'var(--bg-card)',
                            border:'1px solid var(--border-color)',
                            borderRadius:'0.3rem',color:'var(--text-primary)',fontSize:'0.75rem'}}/>
                      </div>
                      <div>
                        <label style={{fontSize:'0.65rem',color:'var(--text-muted)',display:'block',marginBottom:'0.12rem'}}>
                          المياه (كرتون)
                        </label>
                        <div style={{display:'flex',alignItems:'center',gap:'0.2rem'}}>
                          <button onClick={()=>updSlot(idx,'water_quantity',Math.max(0,Number(s.water_quantity)-1))}
                            style={{
                              background:'var(--bg-card)',border:'1px solid var(--border-color)',
                              borderRadius:'0.22rem',padding:'0.18rem 0.28rem',cursor:'pointer',
                              color:'var(--text-primary)',display:'flex',
                            }}><Minus size={9}/></button>
                          <span style={{
                            minWidth:18,textAlign:'center',fontSize:'0.82rem',
                            fontWeight:700,color:'var(--text-primary)',
                          }}>{s.water_quantity}</span>
                          <button onClick={()=>updSlot(idx,'water_quantity',Number(s.water_quantity)+1)}
                            style={{
                              background:'var(--bg-card)',border:'1px solid var(--border-color)',
                              borderRadius:'0.22rem',padding:'0.18rem 0.28rem',cursor:'pointer',
                              color:'var(--text-primary)',display:'flex',
                            }}><Plus size={9}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* أزرار التأكيد */}
        <div style={{display:'flex',justifyContent:'flex-end',gap:'0.6rem',paddingBottom:'0.25rem'}}>
          <button onClick={()=>setStep('grid')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.55rem',padding:'0.6rem 1.15rem',cursor:'pointer',
            color:'var(--text-primary)',fontWeight:600,fontSize:'0.85rem',
          }}>← تعديل الفترات</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            background:'var(--color-lime)',color:'var(--text-on-lime)',
            border:'2px solid var(--color-lime)',
            borderRadius:'0.55rem',padding:'0.6rem 1.5rem',
            cursor:saving?'not-allowed':'pointer',fontWeight:700,fontSize:'0.88rem',
            display:'flex',alignItems:'center',gap:'0.4rem',opacity:saving?0.7:1,
            boxShadow:saving?'none':'0 0 0 3px rgba(200,255,62,0.15)',
            transition:'all 0.15s',
          }}>
            {saving
              ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>
              : <BadgeCheck size={15}/>}
            {saving ? 'جارٍ الإنشاء...' : `تأكيد الباقة (${selected.length})`}
          </button>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════ STEP 3 — النتيجة */
  function renderResult() {
    if (!result) return null
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1rem',maxWidth:560,margin:'0 auto'}}>
        <div style={{
          textAlign:'center',padding:'1.75rem 1.25rem',
          background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'1rem',
        }}>
          <div style={{fontSize:'2.8rem',marginBottom:'0.3rem',lineHeight:1}}>
            {result.failed===0?'🎉':result.created>0?'⚠️':'❌'}
          </div>
          <h2 style={{margin:'0.3rem 0 0.35rem',color:'var(--text-primary)',fontSize:'1.12rem'}}>
            {result.failed===0
              ? 'تمت إنشاء الباقة بنجاح'
              : result.created>0
              ? 'أُنشئت الباقة جزئياً'
              : 'فشل إنشاء الباقة'}
          </h2>
          <p style={{margin:0,color:'var(--text-muted)',fontSize:'0.8rem'}}>
            رقم الباقة:{' '}
            <span style={{color:'var(--color-lime)',fontWeight:700,fontFamily:'monospace'}}>
              {result.batch_id}
            </span>
          </p>
          <div style={{display:'flex',justifyContent:'center',gap:'2rem',marginTop:'1rem'}}>
            <div>
              <div style={{fontSize:'1.6rem',fontWeight:800,color:'var(--color-success)'}}>
                {result.created}
              </div>
              <div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>نجحت</div>
            </div>
            {result.failed > 0 && (
              <div>
                <div style={{fontSize:'1.6rem',fontWeight:800,color:'var(--color-danger)'}}>
                  {result.failed}
                </div>
                <div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>فشلت</div>
              </div>
            )}
          </div>
        </div>

        <div style={{
          background:'var(--bg-card)',border:'1px solid var(--border-color)',
          borderRadius:'0.75rem',padding:'1rem',
        }}>
          <h3 style={{margin:'0 0 0.6rem',fontSize:'0.85rem',color:'var(--text-primary)'}}>
            تفاصيل الفترات
          </h3>
          <div style={{display:'flex',flexDirection:'column',gap:'0.35rem'}}>
            {result.results.map((r,i)=>{
              const slot = selected[i]
              return (
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:'0.55rem',
                  padding:'0.38rem 0.55rem',borderRadius:'0.35rem',
                  background:r.ok?'var(--color-success-bg)':'var(--color-danger-bg)',
                }}>
                  {r.ok
                    ? <CheckCircle2 size={13} style={{color:'var(--color-success)',flexShrink:0}}/>
                    : <AlertCircle  size={13} style={{color:'var(--color-danger)',flexShrink:0}}/>}
                  <span style={{flex:1,fontSize:'0.79rem',color:'var(--text-primary)'}}>
                    {slot?.day_label??r.booking_date} · {slot?.court_label??r.court_id} · {slot?.period_label??r.period_number}
                  </span>
                  {!r.ok&&<span style={{fontSize:'0.68rem',color:'var(--color-danger)'}}>{r.error}</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{display:'flex',gap:'0.6rem',justifyContent:'center'}}>
          <button onClick={()=>router.push('/admin/bookings')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-color)',
            borderRadius:'0.55rem',padding:'0.6rem 1.15rem',cursor:'pointer',
            color:'var(--text-primary)',fontWeight:600,fontSize:'0.85rem',
          }}>عرض الحجوزات</button>
          <button onClick={()=>{
            setStep('grid');setSelected([]);setResult(null)
            setPhone('');setName('');setCustomer(null);setNote('')
          }} style={{
            background:'var(--color-lime)',color:'var(--text-on-lime)',
            border:'2px solid var(--color-lime)',
            borderRadius:'0.55rem',padding:'0.6rem 1.15rem',
            cursor:'pointer',fontWeight:700,fontSize:'0.85rem',
          }}>إنشاء باقة جديدة</button>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════ Render */
  return (
    <div style={{minHeight:'100vh',background:'var(--bg-main)',padding:'1.1rem 1.35rem 2rem'}}>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:'1rem',right:'1rem',zIndex:9999,
          background:toast.type==='ok'?'var(--color-lime)':'var(--color-danger)',
          color:toast.type==='ok'?'var(--text-on-lime)':'#fff',
          padding:'0.55rem 0.9rem',borderRadius:'0.5rem',
          fontWeight:600,fontSize:'0.85rem',
          boxShadow:'0 4px 20px rgba(0,0,0,0.25)',
          animation:'fadeUp 0.2s ease',
          display:'flex',alignItems:'center',gap:'0.35rem',
        }}>
          {toast.type==='ok'?<Check size={13}/>:<X size={13}/>} {toast.text}
        </div>
      )}
      {step==='grid'    && renderGrid()}
      {step==='details' && renderDetails()}
      {step==='result'  && renderResult()}
    </div>
  )
}

/* ════════════════════════════════════════════════ شريط التقدم */
function StepBar({step}:{step:number}) {
  const steps = ['اختيار الفترات','بيانات الباقة','النتيجة']
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.35rem'}}>
      {steps.map((lbl,i)=>(
        <div key={i} style={{
          display:'flex',alignItems:'center',gap:'0.35rem',
          flex: i < 2 ? 1 : undefined,
        }}>
          {/* دائرة */}
          <div style={{
            width:22,height:22,borderRadius:'50%',flexShrink:0,
            background: i < step
              ? 'var(--color-lime-muted)'
              : i === step
              ? 'var(--color-lime)'
              : 'var(--bg-card)',
            border: i < step
              ? '1px solid var(--color-lime-dim)'
              : i === step
              ? 'none'
              : '1px solid var(--border-color)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color: i < step
              ? 'var(--color-lime-dim)'
              : i === step
              ? 'var(--text-on-lime)'
              : 'var(--text-muted)',
            fontSize:'0.68rem',fontWeight:700,
            boxShadow: i === step
              ? '0 0 0 3px rgba(200,255,62,0.18)'
              : 'none',
            transition:'all 0.2s',
          }}>
            {i < step ? <Check size={10} strokeWidth={3}/> : i+1}
          </div>
          {/* نص */}
          <span style={{
            fontSize:'0.73rem',whiteSpace:'nowrap',
            color: i === step ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: i === step ? 700 : 400,
          }}>{lbl}</span>
          {/* خط */}
          {i < 2 && (
            <div style={{
              flex:1,height:2,
              background: i < step
                ? 'var(--color-lime-dim)'
                : 'var(--border-color)',
              borderRadius:1,minWidth:12,
              transition:'background 0.3s',
            }}/>
          )}
        </div>
      ))}
    </div>
  )
}
