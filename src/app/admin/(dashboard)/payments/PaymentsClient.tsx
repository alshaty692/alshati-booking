'use client'
// ============================================================
// PaymentsClient — صفحة الدفعات المستقلة
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  CreditCard, Loader2, TrendingUp,
  Hash, Wallet, ExternalLink,
} from 'lucide-react'
import FilterBar from '@/components/admin/FilterBar'

/* ── أنواع ─────────────────────────────────────────────────── */

interface Payment {
  id:                   string
  amount:               number
  payment_method:       string
  payment_method_label: string
  payment_date:         string
  reference_number:     string | null
  notes:                string | null
  created_at:           string
  invoice_id:           string
  invoice_number:       string | null
  customer_name:        string | null
}

interface PaymentMethod { name: string; label_ar: string }

/* ── ثوابت الفلاتر ─────────────────────────────────────────── */

const PERIOD_OPTIONS = [
  { value: 'today', label: 'اليوم' },
  { value: 'week',  label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'all',   label: 'كل الفترات' },
]

const METHOD_ICON: Record<string, string> = {
  bank_transfer: '🏦',
  cash:          '💵',
  other:         '💳',
}

function fmt(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/* ══════════════════════════════════════════════════════════════
   المكوّن الرئيسي
══════════════════════════════════════════════════════════════ */

export default function PaymentsClient() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  // ── الفلاتر — تقرأ من URL params للتوافق مع بطاقة "تحصيل اليوم"
  const [period, setPeriod]   = useState<string>(searchParams.get('period') ?? 'month')
  const [method, setMethod]   = useState<string>(searchParams.get('method') ?? 'all')

  const [payments,    setPayments]    = useState<Payment[]>([])
  const [methods,     setMethods]     = useState<PaymentMethod[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)

  // ── جلب البيانات ─────────────────────────────────────────────
  const fetchPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else           setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (period !== 'all') params.set('period', period)
      if (method !== 'all') params.set('method', method)

      const res  = await fetch(`/api/admin/payments?${params}`, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }

      setPayments(data.payments ?? [])
      setTotal(data.total ?? 0)
      setMethods(data.payment_methods ?? [])
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period, method])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // ── إحصاء الأكثر استخداماً ───────────────────────────────────
  const topMethod = (() => {
    if (!payments.length) return null
    const counts: Record<string, number> = {}
    for (const p of payments) counts[p.payment_method] = (counts[p.payment_method] ?? 0) + 1
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (!top) return null
    const m = methods.find(x => x.name === top[0])
    return m ? `${METHOD_ICON[m.name] ?? '💳'} ${m.label_ar} (${top[1]})` : null
  })()

  // ── تغيير الفلتر + تحديث URL ─────────────────────────────────
  function changePeriod(v: string) {
    setPeriod(v)
    const p = new URLSearchParams(searchParams.toString())
    if (v === 'all') p.delete('period'); else p.set('period', v)
    router.replace(`/admin/payments?${p}`, { scroll: false })
  }

  function changeMethod(v: string) {
    setMethod(v)
    const p = new URLSearchParams(searchParams.toString())
    if (v === 'all') p.delete('method'); else p.set('method', v)
    router.replace(`/admin/payments?${p}`, { scroll: false })
  }

  // ── حالة التحميل ─────────────────────────────────────────────
  if (loading) return (
    <div className="pm-loading">
      <Loader2 size={28} strokeWidth={1.5} className="pm-spin-icon" />
      <p>جاري تحميل الدفعات...</p>
    </div>
  )

  if (error) return (
    <div className="pm-error card">
      <p>⚠️ {error}</p>
      <button className="btn btn-ghost" onClick={() => fetchPayments()}>إعادة المحاولة</button>
    </div>
  )

  // ══════════════════════════════════════════════════════════════

  return (
    <div className="pm-root">

      {/* ── شريط الفلاتر الموحّد ── */}
      <FilterBar
        tabGroups={[{
          value:    period,
          onChange: changePeriod,
          tabs: PERIOD_OPTIONS.map(o => ({ value: o.value, label: o.label })),
        }]}
        selects={[{
          id:      'pm-method-select',
          label:   'الطريقة:',
          value:   method,
          options: [
            { value: 'all', label: 'الكل' },
            ...methods.map(m => ({ value: m.name, label: m.label_ar })),
          ],
          onChange: changeMethod,
        }]}
        onRefresh={() => fetchPayments(true)}
        refreshing={refreshing}
      />

      {/* ── بطاقات الملخص ── */}
      <div className="pm-stats">
        {/* إجمالي المبلغ */}
        <div className="pm-stat-card pm-stat-lime">
          <div className="pm-stat-icon">
            <TrendingUp size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="pm-stat-val">{fmt(total)} <span className="pm-stat-cur">ر.س</span></div>
            <div className="pm-stat-lbl">
              إجمالي {PERIOD_OPTIONS.find(o => o.value === period)?.label ?? ''}
            </div>
          </div>
        </div>

        {/* عدد الدفعات */}
        <div className="pm-stat-card pm-stat-info">
          <div className="pm-stat-icon">
            <Hash size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="pm-stat-val">{payments.length}</div>
            <div className="pm-stat-lbl">عدد الدفعات</div>
          </div>
        </div>

        {/* الأكثر استخداماً */}
        {topMethod && (
          <div className="pm-stat-card pm-stat-muted">
            <div className="pm-stat-icon">
              <Wallet size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div className="pm-stat-val pm-stat-val-sm">{topMethod}</div>
              <div className="pm-stat-lbl">الأكثر استخداماً</div>
            </div>
          </div>
        )}
      </div>

      {/* ── الجدول ── */}
      {payments.length === 0 ? (
        <div className="pm-empty card">
          <CreditCard size={36} strokeWidth={1} className="pm-empty-icon" />
          <p>لا توجد دفعات بالفلتر الحالي</p>
        </div>
      ) : (
        <div className="pm-table-wrap card">
          <table className="pm-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الفاتورة</th>
                <th>اسم العميل</th>
                <th>المبلغ</th>
                <th>طريقة الدفع</th>
                <th>الرقم المرجعي</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="pm-row">
                  <td className="pm-td-date">{fmtDate(p.payment_date)}</td>
                  <td>
                    {p.invoice_number ? (
                      <Link
                        href={`/admin/invoices?highlight=${p.invoice_id}`}
                        className="pm-inv-link"
                        title="فتح الفاتورة"
                      >
                        {p.invoice_number}
                        <ExternalLink size={11} strokeWidth={2} />
                      </Link>
                    ) : (
                      <span className="pm-muted">—</span>
                    )}
                  </td>
                  <td className="pm-td-name">{p.customer_name ?? <span className="pm-muted">—</span>}</td>
                  <td>
                    <span className="pm-amount">{fmt(p.amount)}</span>
                    <span className="pm-cur"> ر.س</span>
                  </td>
                  <td>
                    <span className="pm-method-badge">
                      {METHOD_ICON[p.payment_method] ?? '💳'} {p.payment_method_label}
                    </span>
                  </td>
                  <td className="pm-td-ref">
                    {p.reference_number
                      ? <code className="pm-ref">{p.reference_number}</code>
                      : <span className="pm-muted">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        /* ── Loading / Error / Empty ── */
        .pm-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-3); padding: var(--space-12);
          color: var(--text-muted);
        }
        .pm-error {
          padding: var(--space-6); text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
          color: var(--color-danger);
        }
        .pm-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-3); padding: var(--space-12);
          color: var(--text-muted);
        }
        .pm-empty-icon { opacity: 0.3; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .pm-spin-icon { animation: spin 1s linear infinite; color: var(--color-lime); }
        .pm-spin      { animation: spin 0.8s linear infinite; }

        /* ── Root ── */
        .pm-root { display: flex; flex-direction: column; gap: var(--space-4); }

        /* ── Stats ── */
        .pm-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--space-4);
        }

        .pm-stat-card {
          display: flex; align-items: center; gap: var(--space-4);
          padding: var(--space-5);
          background: var(--bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
        }
        .pm-stat-lime  { border-color: var(--color-lime-dim); }
        .pm-stat-info  { border-color: rgba(74,158,191,.3); }
        .pm-stat-muted { border-color: var(--border-subtle); }

        .pm-stat-icon {
          width: 44px; height: 44px; border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pm-stat-lime  .pm-stat-icon { background: var(--color-lime-muted); color: var(--color-lime); }
        .pm-stat-info  .pm-stat-icon { background: var(--color-info-bg);     color: var(--color-info); }
        .pm-stat-muted .pm-stat-icon { background: var(--bg-elevated);        color: var(--text-secondary); }

        .pm-stat-val {
          font-size: var(--text-2xl); font-weight: var(--font-black);
          color: var(--text-primary); line-height: 1.1;
        }
        .pm-stat-val-sm { font-size: var(--text-base); }
        .pm-stat-cur { font-size: var(--text-sm); font-weight: var(--font-medium); }
        .pm-stat-lbl { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }

        /* ── Table ── */
        .pm-table-wrap { padding: 0; overflow: hidden; }
        .pm-table {
          width: 100%; border-collapse: collapse;
          font-size: var(--text-sm);
        }
        .pm-table th {
          background: var(--bg-elevated);
          padding: var(--space-3) var(--space-4);
          text-align: right;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }
        .pm-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          vertical-align: middle;
        }
        .pm-row:last-child td { border-bottom: none; }
        .pm-row:hover td { background: var(--bg-elevated); }

        .pm-td-date { font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; }
        .pm-td-name { font-weight: var(--font-medium); }
        .pm-td-ref  { font-size: var(--text-xs); }

        .pm-inv-link {
          display: inline-flex; align-items: center; gap: 0.25rem;
          color: var(--color-info);
          text-decoration: none;
          font-family: monospace;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
        }
        .pm-inv-link:hover { text-decoration: underline; }

        .pm-amount { font-weight: var(--font-bold); color: var(--color-lime); }
        [data-theme="light"] .pm-amount { color: #2D5A00; }
        .pm-cur { font-size: var(--text-xs); color: var(--text-muted); }

        .pm-method-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.2em 0.6em;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .pm-ref {
          font-family: monospace;
          font-size: var(--text-xs);
          background: var(--bg-elevated);
          padding: 0.1em 0.4em;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
        }

        .pm-muted { color: var(--text-muted); }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .pm-filters-inner { gap: var(--space-3); }
          .pm-filter-group  { flex-wrap: wrap; }
          .pm-stats         { grid-template-columns: 1fr 1fr; }
          .pm-table th:nth-child(6),
          .pm-table td:nth-child(6) { display: none; }
        }
        @media (max-width: 480px) {
          .pm-stats { grid-template-columns: 1fr; }
          .pm-table th:nth-child(3),
          .pm-table td:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  )
}
