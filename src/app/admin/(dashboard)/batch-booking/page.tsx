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

/* ================================================================ ثوابت */
const COURTS = [
  { id: 'football',   label: 'كرة القدم',    icon: '⚽', color: '#3b82f6' },
  { id: 'volleyball', label: 'الكرة الطائرة', icon: '🏐', color: '#a855f7' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏅', color: '#f59e0b' },
]
const PERIODS = [
  { num: 1, label: '5-7م'   },
  { num: 2, label: '7-9م'   },
  { num: 3, label: '9-11م'  },
]
const AR_DAYS  = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

/* ================================================================ مساعدات التاريخ */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function getMonthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function getDaysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate() }

/* بناء أيام الشهر مرتبة Mon→Sun */
function buildWeeks(base: Date): { date: Date; inMonth: boolean }[][] {
  const start  = getMonthStart(base)
  const total  = getDaysInMonth(base)
  const dow    = start.getDay()
  const offset = dow === 0 ? 6 : dow - 1
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = -offset; i < total; i++) cells.push({ date: addDays(start, i), inMonth: i >= 0 })
  while (cells.length % 7 !== 0) cells.push({ date: addDays(cells[cells.length-1].date,1), inMonth: false })
  const weeks: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7))
  return weeks
}

/* ================================================================ أنواع */
interface SlotRow { day_date:string; court_id:string; period_number:number; is_available:boolean }
interface BlockedRow { id:string; court_id:string; date:string; period_number:number; reason:string|null }
interface AvailData { slots:SlotRow[]; blocked:BlockedRow[]; settings:Record<string,string> }
type SlotState = 'available' | 'booked' | 'blocked'
interface SelectedSlot {
  date:string; court_id:string; period_number:number
  code_used:string; water_quantity:number
  court_label?:string; period_label?:string; day_label?:string
}
interface CustomerInfo { found:boolean; name?:string; is_suspended?:boolean; suspension_reason?:string|null }

/* ================================================================ الصفحة */
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
    const c = COURTS.find(c=>c.id===cid)
    const pr = PERIODS.find(r=>r.num===p)
    const d  = new Date(date+'T00:00:00')
    if (isSel(date,cid,p)) setSelected(prev=>prev.filter(s=>!(s.date===date&&s.court_id===cid&&s.period_number===p)))
    else setSelected(prev=>[...prev,{
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
      else { setName(''); setNameEditable(true) }
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
          slots: selected.map(s=>({booking_date:s.date,court_id:s.court_id,period_number:s.period_number,code_used:s.code_used.trim()||null,water_quantity:Number(s.water_quantity)||0})),
          customer_name:name.trim(), customer_phone:phone.trim(), status, internal_note:note.trim()||null,
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

  /* ================================================================ STEP 1 — الشبكة */
  function renderGrid() {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1.1rem'}}>

        {/* رأس */}
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <button onClick={()=>router.push('/admin/bookings')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.5rem',padding:'0.45rem 0.6rem',cursor:'pointer',
            color:'var(--text-main)',display:'flex',alignItems:'center',
          }}><ArrowRight size={16}/></button>
          <div>
            <h1 style={{margin:0,fontSize:'1.2rem',fontWeight:800,color:'var(--text-main)',display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <Package size={19}/> الحجز المتعدد
            </h1>
            <p style={{margin:0,fontSize:'0.8rem',color:'var(--text-muted)'}}>اختر الفترات · يمكنك التنقل بين الأشهر</p>
          </div>
        </div>

        {/* شريط التقدم */}
        <StepBar step={0}/>

        {/* تنقل الشهر */}
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
          borderRadius:'0.65rem',padding:'0.55rem 0.9rem',
        }}>
          <button onClick={()=>setMonthDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{
            background:'none',border:'none',cursor:'pointer',color:'var(--text-main)',padding:'0.2rem',display:'flex',
          }}><ChevronRight size={18}/></button>
          <span style={{fontWeight:700,fontSize:'0.95rem',color:'var(--text-main)'}}>
            {AR_MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
          </span>
          <button onClick={()=>setMonthDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{
            background:'none',border:'none',cursor:'pointer',color:'var(--text-main)',padding:'0.2rem',display:'flex',
          }}><ChevronLeft size={18}/></button>
        </div>

        {/* الشبكة */}
        {loadingGrid ? (
          <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)'}}>
            <Loader2 size={26} style={{animation:'spin 1s linear infinite'}}/>
            <p style={{marginTop:'0.5rem',fontSize:'0.85rem'}}>جاري تحميل التوافر...</p>
          </div>
        ) : gridError ? (
          <div style={{textAlign:'center',padding:'2rem',color:'var(--danger)'}}>
            <AlertCircle size={22}/><p style={{marginTop:'0.4rem'}}>{gridError}</p>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>

            {/* ── لكل ملعب ── */}
            {COURTS.map(court => (
              <div key={court.id} style={{
                background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
                borderRadius:'0.85rem',overflow:'hidden',
              }}>
                {/* رأس الملعب */}
                <div style={{
                  display:'flex',alignItems:'center',gap:'0.5rem',
                  padding:'0.55rem 0.9rem',
                  borderBottom:'1px solid var(--border-subtle)',
                  background:`color-mix(in srgb, ${court.color} 8%, var(--bg-elevated))`,
                }}>
                  <span style={{fontSize:'1.1rem'}}>{court.icon}</span>
                  <span style={{fontWeight:700,fontSize:'0.88rem',color:'var(--text-main)'}}>{court.label}</span>
                  {/* عدد الفترات المختارة لهذا الملعب */}
                  {selected.filter(s=>s.court_id===court.id).length > 0 && (
                    <span style={{
                      marginRight:'auto',
                      background:court.color,color:'#fff',
                      borderRadius:'999px',padding:'0.1rem 0.5rem',
                      fontSize:'0.7rem',fontWeight:700,
                    }}>
                      {selected.filter(s=>s.court_id===court.id).length} مختارة
                    </span>
                  )}
                </div>

                {/* رأس الأيام */}
                <div style={{
                  display:'grid',gridTemplateColumns:'44px repeat(7,1fr)',
                  background:'var(--bg-elevated)',
                  borderBottom:'1px solid var(--border-subtle)',
                }}>
                  <div style={{padding:'0.3rem',fontSize:'0.6rem',color:'var(--text-muted)',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    الأسبوع
                  </div>
                  {['اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت','أحد'].map(d=>(
                    <div key={d} style={{
                      padding:'0.3rem 0.1rem',fontSize:'0.68rem',fontWeight:600,
                      color:'var(--text-muted)',textAlign:'center',
                      borderRight:'1px solid var(--border-subtle)',
                    }}>{d}</div>
                  ))}
                </div>

                {/* صفوف الأسابيع */}
                {weeks.map((week, wi) => (
                  <div key={wi} style={{
                    display:'grid',gridTemplateColumns:'44px repeat(7,1fr)',
                    borderBottom: wi<weeks.length-1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    {/* عمود الأسبوع — رقم اليوم الأول */}
                    <div style={{
                      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      padding:'0.3rem 0.15rem',gap:'0.05rem',
                      borderRight:'1px solid var(--border-subtle)',
                      background:'var(--bg-elevated)',
                    }}>
                      {week[0]?.inMonth && <>
                        <span style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-main)',lineHeight:1}}>{week[0].date.getDate()}</span>
                        <span style={{fontSize:'0.55rem',color:'var(--text-muted)',lineHeight:1}}>{AR_MONTHS[week[0].date.getMonth()].slice(0,3)}</span>
                      </>}
                    </div>

                    {/* خلايا الأيام */}
                    {week.map((cell,di) => {
                      const ds = toISO(cell.date)
                      const past = ds < today
                      const out  = !cell.inMonth
                      return (
                        <div key={di} style={{
                          borderRight: di<6 ? '1px solid var(--border-subtle)' : 'none',
                          padding:'0.2rem 0.15rem',
                          display:'flex',flexDirection:'column',gap:'0.15rem',
                          background: out ? 'var(--bg-elevated)' : past ? 'rgba(0,0,0,0.018)' : 'transparent',
                          opacity: out ? 0.4 : 1,
                        }}>
                          {/* رقم اليوم */}
                          <div style={{
                            fontSize:'0.58rem',fontWeight:600,
                            color: (()=>{
                              const today_ = new Date(); const cellD = cell.date
                              return cellD.toDateString()===today_.toDateString()
                                ? court.color : 'var(--text-muted)'
                            })(),
                            textAlign:'center',lineHeight:1,paddingBottom:'0.05rem',
                          }}>
                            {cell.inMonth && !out ? cell.date.getDate() : ''}
                          </div>
                          {/* الفترات الثلاث */}
                          {PERIODS.map(period => {
                            const state  = slotState(ds, court.id, period.num)
                            const sel    = isSel(ds, court.id, period.num)
                            const active = !out && !past && state === 'available'
                            return (
                              <button
                                key={period.num}
                                disabled={!active}
                                onClick={() => toggle(ds, court.id, period.num)}
                                title={state==='booked'?'محجوزة':state==='blocked'?'محجوبة':sel?'انقر لإلغاء الاختيار':period.label}
                                style={{
                                  width:'100%', height:22,
                                  borderRadius:'0.25rem',
                                  border: sel
                                    ? `1.5px solid ${court.color}`
                                    : '1px solid transparent',
                                  background: (() => {
                                    if (out||past)   return 'transparent'
                                    if (sel)         return `color-mix(in srgb, ${court.color} 20%, transparent)`
                                    if (state==='booked')  return 'rgba(239,68,68,0.1)'
                                    if (state==='blocked') return 'rgba(100,100,100,0.08)'
                                    return 'var(--bg-elevated)'
                                  })(),
                                  color: (() => {
                                    if (out||past)   return 'transparent'
                                    if (sel)         return court.color
                                    if (state==='booked')  return 'rgba(239,68,68,0.6)'
                                    if (state==='blocked') return 'rgba(100,100,100,0.4)'
                                    return 'var(--text-secondary)'
                                  })(),
                                  cursor: active ? 'pointer' : 'default',
                                  fontSize:'0.58rem', fontWeight: sel ? 700 : 400,
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  transition:'all 0.12s',padding:0,
                                }}
                              >
                                {out||past    ? null
                                 : sel        ? <Check size={9}/>
                                 : state==='booked'  ? '✕'
                                 : state==='blocked' ? '—'
                                 : period.label}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}

            {/* مفتاح الألوان */}
            <div style={{
              display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap',
              padding:'0.5rem 0.75rem',
              background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
              borderRadius:'0.5rem',
            }}>
              {[
                {bg:`color-mix(in srgb, #3b82f6 20%, transparent)`,border:'#3b82f6',label:'مختار (لون الملعب)'},
                {bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.35)',   label:'محجوز'},
                {bg:'rgba(100,100,100,0.08)',border:'rgba(100,100,100,0.2)', label:'محجوب'},
              ].map(({bg,border,label})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                  <div style={{width:13,height:13,borderRadius:3,background:bg,border:`1px solid ${border}`}}/>
                  <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الفترات المختارة */}
        {selected.length > 0 && (
          <div style={{
            background:'var(--bg-card)',
            border:'1px solid var(--border-subtle)',
            borderRadius:'0.7rem',padding:'0.85rem',
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
              <span style={{fontWeight:700,fontSize:'0.88rem',color:'var(--text-main)'}}>
                الفترات المختارة ({selected.length})
              </span>
              <button onClick={()=>setSelected([])} style={{
                background:'none',border:'1px solid var(--border-subtle)',
                borderRadius:'0.35rem',padding:'0.18rem 0.5rem',
                cursor:'pointer',color:'var(--danger)',fontSize:'0.72rem',
                display:'flex',alignItems:'center',gap:'0.2rem',
              }}><Trash2 size={11}/> مسح الكل</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
              {selected.map((s,i)=>(
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:'0.3rem',
                  background:'var(--bg-elevated)',
                  border:'1px solid var(--border-subtle)',
                  borderRadius:'999px',padding:'0.22rem 0.55rem 0.22rem 0.4rem',
                  fontSize:'0.75rem',color:'var(--text-main)',
                }}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:COURTS.find(c=>c.id===s.court_id)?.color??'#888',flexShrink:0}}/>
                  <span>{s.day_label} · {s.period_label}</span>
                  <button onClick={()=>toggle(s.date,s.court_id,s.period_number)} style={{
                    background:'none',border:'none',cursor:'pointer',
                    color:'var(--text-muted)',padding:0,display:'flex',
                    marginRight:'0.1rem',
                  }}><X size={11}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── زر المتابعة ── */}
        <div style={{display:'flex',justifyContent:'flex-end',paddingBottom:'0.5rem'}}>
          <button
            onClick={()=>{ if(!selected.length){showToast('err','اختر فترة على الأقل');return} setStep('details') }}
            style={{
              background: selected.length ? 'var(--accent)' : 'transparent',
              color: selected.length ? '#000' : 'var(--text-muted)',
              border: selected.length
                ? '2px solid var(--accent)'
                : '2px solid var(--border-subtle)',
              borderRadius:'0.65rem', padding:'0.7rem 1.75rem',
              cursor: selected.length ? 'pointer' : 'not-allowed',
              fontWeight:700, fontSize:'0.9rem',
              display:'flex', alignItems:'center', gap:'0.4rem',
              transition:'all 0.15s',
            }}
          >
            متابعة ({selected.length} فترة) <ChevronLeft size={16}/>
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================ STEP 2 — بيانات العميل */
  function renderDetails() {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1.1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <button onClick={()=>setStep('grid')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.5rem',padding:'0.45rem 0.6rem',cursor:'pointer',
            color:'var(--text-main)',display:'flex',
          }}><ArrowRight size={16}/></button>
          <h1 style={{margin:0,fontSize:'1.2rem',fontWeight:800,color:'var(--text-main)'}}>بيانات الباقة</h1>
        </div>

        <StepBar step={1}/>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr',gap:'1.1rem'}}>

          {/* عمود بيانات العميل */}
          <div style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.75rem',padding:'1rem',
            display:'flex',flexDirection:'column',gap:'0.8rem',
          }}>
            <h3 style={{margin:0,fontSize:'0.88rem',fontWeight:700,color:'var(--text-main)',display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <Users size={15}/> بيانات العميل
            </h3>

            <div>
              <label style={{fontSize:'0.74rem',color:'var(--text-muted)',display:'block',marginBottom:'0.22rem'}}>رقم الجوال</label>
              <div style={{display:'flex',gap:'0.4rem'}}>
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchCustomer()} placeholder="05XXXXXXXX"
                  style={{flex:1,padding:'0.5rem 0.65rem',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:'0.45rem',color:'var(--text-main)',fontSize:'0.87rem',direction:'ltr'}}/>
                <button onClick={searchCustomer} disabled={searching} style={{
                  background:'var(--accent)',color:'#000',border:'none',
                  borderRadius:'0.45rem',padding:'0 0.65rem',cursor:'pointer',display:'flex',alignItems:'center',
                }}>
                  {searching ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Search size={14}/>}
                </button>
              </div>
            </div>

            {customer && (
              <div style={{
                padding:'0.38rem 0.6rem',borderRadius:'0.4rem',fontSize:'0.77rem',fontWeight:600,
                background: customer.is_suspended ? 'rgba(239,68,68,0.1)' : customer.found ? 'rgba(163,230,53,0.1)' : 'rgba(251,191,36,0.1)',
                color: customer.is_suspended ? 'var(--danger)' : customer.found ? '#7bba00' : '#d97706',
                border:`1px solid ${customer.is_suspended?'rgba(239,68,68,0.2)':customer.found?'rgba(163,230,53,0.25)':'rgba(251,191,36,0.2)'}`,
              }}>
                {customer.is_suspended ? `⚠ موقوف: ${customer.suspension_reason??'—'}` : customer.found ? '✓ عميل مسجّل' : '＋ عميل جديد — يُسجَّل تلقائياً'}
              </div>
            )}

            <div>
              <label style={{fontSize:'0.74rem',color:'var(--text-muted)',display:'block',marginBottom:'0.22rem'}}>الاسم</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)}
                disabled={!nameEditable&&!!customer?.found} placeholder="اسم العميل"
                style={{width:'100%',padding:'0.5rem 0.65rem',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:'0.45rem',color:'var(--text-main)',fontSize:'0.87rem',opacity:(!nameEditable&&customer?.found)?0.65:1}}/>
            </div>

            <div>
              <label style={{fontSize:'0.74rem',color:'var(--text-muted)',display:'block',marginBottom:'0.3rem'}}>حالة الدفع</label>
              <div style={{display:'flex',gap:'0.4rem'}}>
                {(['confirmed','pending'] as const).map(v=>(
                  <button key={v} onClick={()=>setStatus(v)} style={{
                    flex:1,padding:'0.45rem',
                    background:status===v?'var(--accent)':'var(--bg-elevated)',
                    color:status===v?'#000':'var(--text-muted)',
                    border:`1px solid ${status===v?'var(--accent)':'var(--border-subtle)'}`,
                    borderRadius:'0.4rem',cursor:'pointer',fontSize:'0.77rem',fontWeight:status===v?700:400,
                  }}>
                    {v==='confirmed'?'مؤكد (مدفوع)':'بانتظار الإيصال'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{fontSize:'0.74rem',color:'var(--text-muted)',display:'block',marginBottom:'0.22rem'}}>ملاحظة داخلية (اختياري)</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="ملاحظة للإدارة..."
                style={{width:'100%',padding:'0.5rem 0.65rem',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:'0.45rem',color:'var(--text-main)',fontSize:'0.82rem',resize:'vertical'}}/>
            </div>
          </div>

          {/* عمود الفترات */}
          <div style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.75rem',padding:'1rem',
            display:'flex',flexDirection:'column',gap:'0.8rem',
          }}>
            <h3 style={{margin:0,fontSize:'0.88rem',fontWeight:700,color:'var(--text-main)',display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <CalendarDays size={15}/> الفترات ({selected.length})
            </h3>
            <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',maxHeight:'52vh',overflowY:'auto'}}>
              {selected.map((s,idx)=>{
                const court = COURTS.find(c=>c.id===s.court_id)
                return (
                  <div key={idx} style={{
                    background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',
                    borderRadius:'0.55rem',padding:'0.6rem 0.7rem',
                    borderRight:`3px solid ${court?.color??'var(--accent)'}`,
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.4rem'}}>
                      <span style={{fontSize:'0.79rem',fontWeight:600,color:'var(--text-main)'}}>
                        {s.day_label} · {s.court_label} · {s.period_label}
                      </span>
                      <button onClick={()=>toggle(s.date,s.court_id,s.period_number)} style={{
                        background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:0,
                      }}><X size={13}/></button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}}>
                      <div>
                        <label style={{fontSize:'0.67rem',color:'var(--text-muted)',display:'block',marginBottom:'0.15rem'}}>كود الخصم</label>
                        <input type="text" value={s.code_used}
                          onChange={e=>updSlot(idx,'code_used',e.target.value.toUpperCase())} placeholder="اختياري"
                          style={{width:'100%',padding:'0.33rem 0.45rem',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'0.3rem',color:'var(--text-main)',fontSize:'0.77rem'}}/>
                      </div>
                      <div>
                        <label style={{fontSize:'0.67rem',color:'var(--text-muted)',display:'block',marginBottom:'0.15rem'}}>المياه (كرتون)</label>
                        <div style={{display:'flex',alignItems:'center',gap:'0.25rem'}}>
                          <button onClick={()=>updSlot(idx,'water_quantity',Math.max(0,Number(s.water_quantity)-1))} style={{
                            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
                            borderRadius:'0.25rem',padding:'0.2rem 0.3rem',cursor:'pointer',color:'var(--text-main)',display:'flex',
                          }}><Minus size={10}/></button>
                          <span style={{minWidth:20,textAlign:'center',fontSize:'0.85rem',fontWeight:700,color:'var(--text-main)'}}>{s.water_quantity}</span>
                          <button onClick={()=>updSlot(idx,'water_quantity',Number(s.water_quantity)+1)} style={{
                            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
                            borderRadius:'0.25rem',padding:'0.2rem 0.3rem',cursor:'pointer',color:'var(--text-main)',display:'flex',
                          }}><Plus size={10}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* أزرار */}
        <div style={{display:'flex',justifyContent:'flex-end',gap:'0.6rem',paddingBottom:'0.5rem'}}>
          <button onClick={()=>setStep('grid')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.55rem',padding:'0.62rem 1.2rem',cursor:'pointer',
            color:'var(--text-main)',fontWeight:600,fontSize:'0.87rem',
          }}>← تعديل الفترات</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            background:'var(--accent)',color:'#000',border:'2px solid var(--accent)',
            borderRadius:'0.55rem',padding:'0.62rem 1.6rem',
            cursor:saving?'not-allowed':'pointer',fontWeight:700,fontSize:'0.9rem',
            display:'flex',alignItems:'center',gap:'0.4rem',opacity:saving?0.7:1,
          }}>
            {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <BadgeCheck size={15}/>}
            {saving ? 'جارٍ الإنشاء...' : `تأكيد الباقة (${selected.length})`}
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================ STEP 3 — النتيجة */
  function renderResult() {
    if (!result) return null
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'1.1rem',maxWidth:580,margin:'0 auto'}}>
        <div style={{
          textAlign:'center',padding:'1.75rem 1.25rem',
          background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'1rem',
        }}>
          <div style={{fontSize:'2.8rem',marginBottom:'0.3rem'}}>
            {result.failed===0?'🎉':result.created>0?'⚠️':'❌'}
          </div>
          <h2 style={{margin:'0 0 0.35rem 0',color:'var(--text-main)',fontSize:'1.15rem'}}>
            {result.failed===0?'تمت إنشاء الباقة بنجاح':result.created>0?'أُنشئت الباقة جزئياً':'فشل إنشاء الباقة'}
          </h2>
          <p style={{margin:0,color:'var(--text-muted)',fontSize:'0.82rem'}}>
            رقم الباقة: <span style={{color:'var(--accent)',fontWeight:700,fontFamily:'monospace'}}>{result.batch_id}</span>
          </p>
          <div style={{display:'flex',justifyContent:'center',gap:'2rem',marginTop:'0.9rem'}}>
            <div><div style={{fontSize:'1.5rem',fontWeight:800,color:'#7bba00'}}>{result.created}</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>نجحت</div></div>
            {result.failed>0&&<div><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--danger)'}}>{result.failed}</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>فشلت</div></div>}
          </div>
        </div>

        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'0.75rem',padding:'1rem'}}>
          <h3 style={{margin:'0 0 0.65rem 0',fontSize:'0.87rem',color:'var(--text-main)'}}>تفاصيل الفترات</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'0.38rem'}}>
            {result.results.map((r,i)=>{
              const slot = selected[i]
              return (
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:'0.6rem',
                  padding:'0.42rem 0.6rem',borderRadius:'0.38rem',
                  background:r.ok?'rgba(163,230,53,0.07)':'rgba(239,68,68,0.07)',
                }}>
                  {r.ok?<CheckCircle2 size={13} style={{color:'#7bba00',flexShrink:0}}/>:<AlertCircle size={13} style={{color:'var(--danger)',flexShrink:0}}/>}
                  <span style={{flex:1,fontSize:'0.81rem',color:'var(--text-main)'}}>
                    {slot?.day_label??r.booking_date} · {slot?.court_label??r.court_id} · {slot?.period_label??r.period_number}
                  </span>
                  {!r.ok&&<span style={{fontSize:'0.7rem',color:'var(--danger)'}}>{r.error}</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{display:'flex',gap:'0.6rem',justifyContent:'center'}}>
          <button onClick={()=>router.push('/admin/bookings')} style={{
            background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
            borderRadius:'0.55rem',padding:'0.62rem 1.2rem',cursor:'pointer',
            color:'var(--text-main)',fontWeight:600,fontSize:'0.87rem',
          }}>عرض الحجوزات</button>
          <button onClick={()=>{setStep('grid');setSelected([]);setResult(null);setPhone('');setName('');setCustomer(null);setNote('')}} style={{
            background:'var(--accent)',color:'#000',border:'2px solid var(--accent)',
            borderRadius:'0.55rem',padding:'0.62rem 1.2rem',cursor:'pointer',fontWeight:700,fontSize:'0.87rem',
          }}>إنشاء باقة جديدة</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-main)',padding:'1.1rem 1.35rem'}}>
      {toast && (
        <div style={{
          position:'fixed',top:'1rem',right:'1rem',zIndex:9999,
          background:toast.type==='ok'?'var(--accent)':'var(--danger)',
          color:toast.type==='ok'?'#000':'#fff',
          padding:'0.6rem 1rem',borderRadius:'0.5rem',
          fontWeight:600,fontSize:'0.87rem',
          boxShadow:'0 4px 18px rgba(0,0,0,0.25)',
          animation:'slideIn 0.2s ease',
        }}>
          {toast.type==='ok'?'✓ ':'✗ '}{toast.text}
        </div>
      )}
      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(1rem)} to{opacity:1;transform:translateX(0)} }
      `}</style>
      {step==='grid'    && renderGrid()}
      {step==='details' && renderDetails()}
      {step==='result'  && renderResult()}
    </div>
  )
}

/* شريط التقدم */
function StepBar({step}:{step:number}) {
  const steps = ['اختيار الفترات','بيانات الباقة','النتيجة']
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
      {steps.map((lbl,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:'0.4rem',flex:i<2?1:undefined}}>
          <div style={{
            width:24,height:24,borderRadius:'50%',flexShrink:0,
            background:i<step?'rgba(163,230,53,0.2)':i===step?'var(--accent)':'var(--bg-card)',
            border:i<step?'1px solid rgba(163,230,53,0.4)':i===step?'none':'1px solid var(--border-subtle)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:i<step?'#7bba00':i===step?'#000':'var(--text-muted)',
            fontSize:'0.7rem',fontWeight:700,
          }}>
            {i<step?<Check size={11}/>:i+1}
          </div>
          <span style={{fontSize:'0.76rem',whiteSpace:'nowrap',color:i===step?'var(--text-main)':'var(--text-muted)',fontWeight:i===step?700:400}}>{lbl}</span>
          {i<2&&<div style={{flex:1,height:2,background:i<step?'rgba(163,230,53,0.35)':'var(--border-subtle)',borderRadius:1,minWidth:16}}/>}
        </div>
      ))}
    </div>
  )
}
