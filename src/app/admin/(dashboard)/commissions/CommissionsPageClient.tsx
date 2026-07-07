'use client'
// ============================================================
// CommissionsPageClient — جدول كل العمولات مع فلترة وإجماليات
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, Loader2, Filter, RefreshCw,
  TrendingUp, Hash, CheckCircle2, Clock,
} from 'lucide-react'

// ── أنواع ───────────────────────────────────────────────────

interface Commission {
  id:                            string
  compensation_profile_id:       string
  booking_id:                    string | null
  invoice_id:                    string | null
  amount:                        number
  calculated_at:                 string
  included_in_salary_payment_id: string | null
}

interface Props {
  canManagePayroll: boolean
}

// ── مساعدات ─────────────────────────────────────────────────

function formatMonth(isoDate: string) {
  const d = new Date(isoDate)
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
}

// توليد قائمة آخر 12 شهراً
function getLast12Months(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
    months.push({ value, label })
  }
  return months
}

// ============================================================
// المكوّن الرئيسي
// ============================================================

export default function CommissionsPageClient({ canManagePayroll }: Props) {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // فلاتر
  const [filterMonth,  setFilterMonth]  = useState('')

  const months = getLast12Months()

  // ── جلب العمولات ────────────────────────────────────────────

  const fetchCommissions = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (filterMonth) params.set('month', filterMonth)

      const res  = await fetch(`/api/admin/commissions?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل التحميل')
      setCommissions(data.commissions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [filterMonth])

  useEffect(() => { fetchCommissions() }, [fetchCommissions])

  // ── إحصائيات ────────────────────────────────────────────────

  const totalAll      = commissions.reduce((s, c) => s + Number(c.amount), 0)
  const totalPending  = commissions.filter(c => !c.included_in_salary_payment_id).reduce((s, c) => s + Number(c.amount), 0)
  const totalIncluded = commissions.filter(c =>  c.included_in_salary_payment_id).reduce((s, c) => s + Number(c.amount), 0)

  // ── العرض ───────────────────────────────────────────────────

  return (
    <>
      {/* ── شريط الفلترة ────────────────────────────────────── */}
      <div className="cp-toolbar">
        <div className="cp-filter-row">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            id="cp-filter-month"
            className="input"
            style={{ width: 'auto', minWidth: 160 }}
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          >
            <option value="">كل الأشهر</option>
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <button className="btn-icon" title="تحديث" onClick={fetchCommissions}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── بطاقات الإحصائيات ─────────────────────────────── */}
      {!loading && !error && (
        <div className="cp-stats">
          <div className="cp-stat-card">
            <div className="cp-stat-icon"><DollarSign size={16} /></div>
            <div>
              <div className="cp-stat-value">{totalAll.toLocaleString('ar-SA')} ر.س</div>
              <div className="cp-stat-label">إجمالي العمولات ({commissions.length})</div>
            </div>
          </div>
          <div className="cp-stat-card cp-stat-pending">
            <div className="cp-stat-icon"><Clock size={16} /></div>
            <div>
              <div className="cp-stat-value">{totalPending.toLocaleString('ar-SA')} ر.س</div>
              <div className="cp-stat-label">
                معلّقة ({commissions.filter(c => !c.included_in_salary_payment_id).length})
              </div>
            </div>
          </div>
          <div className="cp-stat-card cp-stat-paid">
            <div className="cp-stat-icon"><CheckCircle2 size={16} /></div>
            <div>
              <div className="cp-stat-value">{totalIncluded.toLocaleString('ar-SA')} ر.س</div>
              <div className="cp-stat-label">
                مُدرجة برواتب ({commissions.filter(c => c.included_in_salary_payment_id).length})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── المحتوى ─────────────────────────────────────────── */}
      {loading ? (
        <div className="cp-center">
          <Loader2 size={28} className="cp-spin" />
          <span>جارٍ تحميل العمولات…</span>
        </div>
      ) : error ? (
        <div className="cp-center">
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="btn btn-ghost" onClick={fetchCommissions}>إعادة المحاولة</button>
        </div>
      ) : commissions.length === 0 ? (
        <div className="cp-center">
          <DollarSign size={36} style={{ opacity: 0.3 }} />
          <p>لا توجد عمولات{filterMonth ? ' في هذا الشهر' : ' بعد'}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>رقم الحجز</th>
                  <th>رقم الفاتورة</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ color: 'var(--color-lime)' }}>
                        {Number(c.amount).toLocaleString('ar-SA')} ر.س
                      </strong>
                    </td>
                    <td>
                      {c.booking_id ? (
                        <a
                          href={`/admin/bookings/${c.booking_id}`}
                          style={{ color: 'var(--color-lime)', fontSize: 'var(--text-xs)', fontFamily: 'monospace' }}
                        >
                          {c.booking_id.slice(0, 8)}…
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {c.invoice_id ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontFamily: 'monospace' }}>
                          {c.invoice_id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(c.calculated_at).toLocaleDateString('ar-SA', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </td>
                    <td>
                      {c.included_in_salary_payment_id ? (
                        <span className="badge badge-confirmed" style={{ fontSize: '0.7rem' }}>
                          <CheckCircle2 size={10} /> مُدرجة
                        </span>
                      ) : (
                        <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                          <Clock size={10} /> معلّقة
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Styles ───────────────────────────────────────────── */}
      <style>{`
        .cp-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-5);
          flex-wrap: wrap;
        }
        .cp-filter-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .cp-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }
        @media (max-width: 600px) { .cp-stats { grid-template-columns: 1fr; } }
        .cp-stat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .cp-stat-icon {
          width: 36px; height: 36px;
          background: var(--color-lime-muted);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-lime);
          flex-shrink: 0;
        }
        .cp-stat-pending .cp-stat-icon {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }
        .cp-stat-paid .cp-stat-icon {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          opacity: 0.7;
        }
        .cp-stat-value {
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .cp-stat-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: 2px;
        }
        .cp-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-16);
          color: var(--text-muted);
          text-align: center;
        }
        .cp-spin { animation: cpSpin 0.9s linear infinite; }
        @keyframes cpSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
