'use client'
// ============================================================
// /admin/invoices — صفحة قائمة الفواتير
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { Receipt, Search, X, ChevronRight, ChevronLeft, FileText } from 'lucide-react'

/* ── أنواع ──────────────────────────────────────────────────── */
interface Customer { id: string; name: string; phone: string; customer_code: string }
interface Booking  { id: string; booking_date: string; court_id: string; period_number: number }

interface Invoice {
  id:                  string
  invoice_number:      string
  status:              'issued' | 'cancelled'
  issued_at:           string
  cancelled_at:        string | null
  total_amount:        number
  court_amount:        number
  base_price:          number
  discount_amount:     number
  discount_code:       string | null
  discount_percentage: number
  water_quantity:      number
  water_unit_price:    number
  water_total:         number
  batch_id:            string | null
  booking_id:          string | null
  customer_id:         string
  customers:           Customer | null
  bookings:            Booking | null
}

const COURT_LABELS: Record<string, string> = {
  football:   '⚽ كرة القدم',
  volleyball: '🏐 الكرة الطائرة',
  multi:      '🏀 الملعب المتعدد',
}
const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  // BUG-02: استخدام السنة الحالية بدلاً من القيمة الثابتة 2025
  const d = new Date(new Date().getFullYear(), i, 1)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    // BUG-03: u-ca-gregory يضمن عرض الأشهر ميلادية على iOS
    label: d.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' }),
  }
}).reverse()

/* ── Modal تفاصيل الفاتورة ────────────────────────────────── */
function InvoiceModal({
  invoice,
  onClose,
  onCancel,
}: {
  invoice: Invoice
  onClose: () => void
  onCancel: (id: string) => Promise<void>
}) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)

  const cust = invoice.customers
  const bk   = invoice.bookings

  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  async function handleCancel() {
    setCancelling(true)
    await onCancel(invoice.id)
    setCancelling(false)
    onClose()
  }

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="inv-modal-header">
          <div>
            <span className="inv-number">{invoice.invoice_number}</span>
            <span className={`inv-badge ${invoice.status}`}>
              {invoice.status === 'issued' ? '✅ مُصدرة' : '❌ ملغاة'}
            </span>
          </div>
          <button className="inv-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* بيانات العميل */}
        <section className="inv-section">
          <h3 className="inv-section-title">بيانات العميل</h3>
          <div className="inv-row"><span>الاسم</span><strong>{cust?.name ?? '—'}</strong></div>
          <div className="inv-row"><span>الكود</span><strong className="inv-code">{cust?.customer_code ?? '—'}</strong></div>
          <div className="inv-row"><span>الجوال</span><strong dir="ltr">{cust?.phone ?? '—'}</strong></div>
        </section>

        {/* تفاصيل الحجز */}
        <section className="inv-section">
          <h3 className="inv-section-title">
            {invoice.batch_id ? `باقة — ${invoice.batch_id}` : 'تفاصيل الحجز'}
          </h3>
          {bk && (
            <>
              <div className="inv-row"><span>الملعب</span><strong>{COURT_LABELS[bk.court_id] ?? bk.court_id}</strong></div>
              <div className="inv-row"><span>التاريخ</span><strong>{new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</strong></div>
              <div className="inv-row"><span>الفترة</span><strong>{PERIOD_LABELS[bk.period_number] ?? bk.period_number}</strong></div>
            </>
          )}
          {invoice.batch_id && !bk && (
            <div className="inv-row"><span>نوع</span><strong>فاتورة مجمّعة للباقة</strong></div>
          )}
        </section>

        {/* بنود الفاتورة */}
        <section className="inv-section">
          <h3 className="inv-section-title">بنود الفاتورة</h3>
          <div className="inv-line-items">
            <div className="inv-item">
              <span>سعر الملعب{invoice.batch_id ? ' (مجموع)' : ''}</span>
              <span>{fmt(invoice.base_price)} ر</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="inv-item inv-discount">
                <span>
                  خصم
                  {invoice.discount_code ? ` (${invoice.discount_code})` : ''}
                  {invoice.discount_percentage > 0 ? ` — ${invoice.discount_percentage}%` : ''}
                </span>
                <span>−{fmt(invoice.discount_amount)} ر</span>
              </div>
            )}
            {invoice.water_quantity > 0 && (
              <div className="inv-item">
                <span>مياه ({invoice.water_quantity} كرتون × {fmt(invoice.water_unit_price)} ر)</span>
                <span>{fmt(invoice.water_total)} ر</span>
              </div>
            )}
            <div className="inv-item inv-total">
              <span>الإجمالي</span>
              <span>{fmt(invoice.total_amount)} ر</span>
            </div>
          </div>
        </section>

        {/* التواريخ */}
        <section className="inv-section">
          <div className="inv-row"><span>تاريخ الإصدار</span><strong>{new Date(invoice.issued_at).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' })}</strong></div>
          {invoice.cancelled_at && (
            <div className="inv-row"><span>تاريخ الإلغاء</span><strong>{new Date(invoice.cancelled_at).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' })}</strong></div>
          )}
        </section>

        {/* إلغاء يدوي */}
        {invoice.status === 'issued' && (
          <div className="inv-actions">
            {!showCancelForm ? (
              <button className="inv-cancel-btn" onClick={() => setShowCancelForm(true)}>
                ❌ إلغاء الفاتورة يدوياً
              </button>
            ) : (
              <div className="inv-cancel-form">
                <input
                  className="inv-cancel-input"
                  placeholder="سبب الإلغاء (اختياري)"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
                <div className="inv-cancel-btns">
                  <button className="inv-cancel-confirm" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
                  </button>
                  <button className="inv-cancel-back" onClick={() => setShowCancelForm(false)}>رجوع</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── الصفحة الرئيسية ─────────────────────────────────────── */
export default function InvoicesPage() {
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [selected,  setSelected]  = useState<Invoice | null>(null)

  // فلاتر
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter,  setMonthFilter]  = useState('')
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (monthFilter)  params.set('month',  monthFilter)
    if (search)       params.set('search', search)
    params.set('page', String(page))

    const res  = await fetch(`/api/admin/invoices?${params}`)
    const data = await res.json()
    setInvoices(data.invoices ?? [])
    setTotal(data.total ?? 0)
    setPages(data.pages ?? 1)
    setLoading(false)
  }, [statusFilter, monthFilter, search, page])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  async function handleCancelInvoice(id: string) {
    const reason = (document.querySelector('.inv-cancel-input') as HTMLInputElement)?.value ?? ''
    await fetch(`/api/admin/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_reason: reason }),
    })
    await fetchInvoices()
  }

  const issued    = invoices.filter(i => i.status === 'issued')
  const totalIssued = issued.reduce((s, i) => s + i.total_amount, 0)
  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return (
    <div className="inv-page">
      <style>{`
        .inv-page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
        .inv-page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:.75rem; }
        .inv-page-title { display:flex; align-items:center; gap:.5rem; font-size:1.5rem; font-weight:700; }
        .inv-stats { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.25rem; }
        .inv-stat { background:var(--card); border:1px solid var(--border); border-radius:.75rem; padding:.75rem 1.25rem; flex:1; min-width:140px; }
        .inv-stat-val { font-size:1.4rem; font-weight:700; }
        .inv-stat-lbl { font-size:.8rem; color:var(--text-muted); margin-top:.1rem; }
        .inv-filters { display:flex; gap:.75rem; flex-wrap:wrap; margin-bottom:1.25rem; }
        .inv-select { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.45rem .75rem; font-size:.875rem; color:var(--text); min-width:140px; }
        .inv-search { display:flex; gap:.5rem; flex:1; min-width:200px; }
        .inv-search input { flex:1; background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.45rem .75rem; font-size:.875rem; color:var(--text); }
        .inv-search button { background:var(--primary); color:#fff; border:none; border-radius:.5rem; padding:.45rem .9rem; cursor:pointer; display:flex; align-items:center; gap:.3rem; }
        .inv-table-wrap { overflow-x:auto; border-radius:.75rem; border:1px solid var(--border); background:var(--card); }
        .inv-table { width:100%; border-collapse:collapse; }
        .inv-table th { padding:.75rem 1rem; text-align:right; font-size:.8rem; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap; }
        .inv-table td { padding:.85rem 1rem; border-bottom:1px solid var(--border); font-size:.875rem; vertical-align:middle; }
        .inv-table tr:last-child td { border-bottom:none; }
        .inv-table tr:hover td { background:var(--muted); }
        .inv-table tr { cursor:pointer; }
        .inv-badge { display:inline-flex; align-items:center; gap:.25rem; padding:.2rem .6rem; border-radius:999px; font-size:.75rem; font-weight:600; }
        .inv-badge.issued    { background:#d1fae5; color:#065f46; }
        .inv-badge.cancelled { background:#fee2e2; color:#991b1b; }
        .dark .inv-badge.issued    { background:#064e3b; color:#6ee7b7; }
        .dark .inv-badge.cancelled { background:#7f1d1d; color:#fca5a5; }
        .inv-number { font-weight:700; font-size:.875rem; }
        .inv-customer-code { font-size:.75rem; color:var(--text-muted); }
        .inv-amount { font-weight:700; text-align:left; direction:ltr; }
        .inv-pagination { display:flex; align-items:center; justify-content:center; gap:.75rem; margin-top:1.25rem; }
        .inv-pg-btn { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.4rem .8rem; cursor:pointer; color:var(--text); display:flex; align-items:center; }
        .inv-pg-btn:disabled { opacity:.4; cursor:default; }
        .inv-pg-info { font-size:.875rem; color:var(--text-muted); }
        .inv-empty { text-align:center; padding:3rem; color:var(--text-muted); }
        /* Modal */
        .inv-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1rem; }
        .inv-modal { background:var(--card); border-radius:1rem; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; }
        .inv-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.25rem .75rem; border-bottom:1px solid var(--border); }
        .inv-number { font-size:1rem; font-weight:700; }
        .inv-close-btn { background:none; border:none; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; }
        .inv-section { padding:.75rem 1.25rem; border-bottom:1px solid var(--border); }
        .inv-section:last-child { border-bottom:none; }
        .inv-section-title { font-size:.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:.5rem; font-weight:600; letter-spacing:.05em; }
        .inv-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.3rem 0; font-size:.875rem; }
        .inv-row span { color:var(--text-muted); }
        .inv-code { background:var(--muted); padding:.15rem .5rem; border-radius:.375rem; font-size:.8rem; font-weight:700; }
        .inv-line-items { display:flex; flex-direction:column; gap:.35rem; }
        .inv-item { display:flex; justify-content:space-between; font-size:.875rem; padding:.2rem 0; }
        .inv-discount { color:#f59e0b; }
        .inv-total { border-top:1px solid var(--border); padding-top:.5rem; margin-top:.25rem; font-weight:700; font-size:1rem; }
        .inv-actions { padding:1rem 1.25rem; }
        .inv-cancel-btn { width:100%; background:transparent; border:1.5px solid #ef4444; color:#ef4444; border-radius:.5rem; padding:.6rem; cursor:pointer; font-size:.875rem; }
        .inv-cancel-btn:hover { background:#fef2f2; }
        .inv-cancel-form { display:flex; flex-direction:column; gap:.5rem; }
        .inv-cancel-input { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.5rem .75rem; font-size:.875rem; color:var(--text); }
        .inv-cancel-btns { display:flex; gap:.5rem; }
        .inv-cancel-confirm { flex:1; background:#ef4444; color:#fff; border:none; border-radius:.5rem; padding:.55rem; cursor:pointer; }
        .inv-cancel-back { background:var(--muted); border:none; border-radius:.5rem; padding:.55rem 1rem; cursor:pointer; color:var(--text); }
      `}</style>

      {/* Header */}
      <div className="inv-page-header">
        <h1 className="inv-page-title">
          <Receipt size={22} /> الفواتير
        </h1>
      </div>

      {/* Stats */}
      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-val">{total}</div>
          <div className="inv-stat-lbl">إجمالي الفواتير</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{invoices.filter(i => i.status === 'issued').length}</div>
          <div className="inv-stat-lbl">مُصدرة</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{fmt(totalIssued)} ر</div>
          <div className="inv-stat-lbl">مجموع المُصدرة</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{invoices.filter(i => i.status === 'cancelled').length}</div>
          <div className="inv-stat-lbl">ملغاة</div>
        </div>
      </div>

      {/* Filters */}
      <div className="inv-filters">
        <select className="inv-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">الحالة: الكل</option>
          <option value="issued">✅ مُصدرة</option>
          <option value="cancelled">❌ ملغاة</option>
        </select>

        <select className="inv-select" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1) }}>
          <option value="">كل الأشهر</option>
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <form className="inv-search" onSubmit={handleSearch}>
          <input
            placeholder="بحث باسم، جوال، أو كود عميل..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button type="submit"><Search size={16} /></button>
        </form>
      </div>

      {/* Table */}
      <div className="inv-table-wrap">
        {loading ? (
          <div className="inv-empty">جاري التحميل...</div>
        ) : invoices.length === 0 ? (
          <div className="inv-empty">
            <FileText size={40} style={{ opacity: .3, marginBottom: '.5rem' }} />
            <div>لا توجد فواتير</div>
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>الحجز</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>تاريخ الإصدار</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const cust = inv.customers
                const bk   = inv.bookings
                return (
                  <tr key={inv.id} onClick={() => setSelected(inv)}>
                    <td>
                      <span className="inv-number">{inv.invoice_number}</span>
                      {inv.batch_id && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>📦 {inv.batch_id}</div>}
                    </td>
                    <td>
                      <div>{cust?.name ?? '—'}</div>
                      <div className="inv-customer-code">{cust?.customer_code ?? ''}</div>
                    </td>
                    <td>
                      {bk ? (
                        <>
                          <div>{COURT_LABELS[bk.court_id] ?? bk.court_id}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                            {new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory')} · {PERIOD_LABELS[bk.period_number]}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>باقة مجمّعة</span>
                      )}
                    </td>
                    <td className="inv-amount">{fmt(inv.total_amount)} ر</td>
                    <td><span className={`inv-badge ${inv.status}`}>{inv.status === 'issued' ? '✅ مُصدرة' : '❌ ملغاة'}</span></td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                      {new Date(inv.issued_at).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="inv-pagination">
          <button className="inv-pg-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
            <ChevronRight size={16} />
          </button>
          <span className="inv-pg-info">صفحة {page} من {pages}</span>
          <button className="inv-pg-btn" onClick={() => setPage(p => p + 1)} disabled={page >= pages}>
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <InvoiceModal
          invoice={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancelInvoice}
        />
      )}
    </div>
  )
}
