'use client'
// ============================================================
// CreditNotesClient — صفحة إشعارات الائتمان المستقلة
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Loader2, CheckCircle2, XCircle,
  Clock, AlertTriangle, ExternalLink,
} from 'lucide-react'
import FilterBar from '@/components/admin/FilterBar'

/* ── أنواع ──────────────────────────────────────────────────── */

interface CreditNote {
  id:                 string
  credit_note_number: string
  invoice_id:         string | null
  customer_id:        string | null
  amount:             number
  reason:             string
  type:               string
  status:             'draft' | 'approved' | 'cancelled'
  created_at:         string
  approved_at:        string | null
  cancelled_at:       string | null
  cancel_reason:      string | null
  invoices: {
    id:         string
    invoice_number: string
    booking_id: string | null
    bookings: {
      id:             string
      booking_date:   string
      court_id:       string
      period_number:  number
    } | null
  } | null
  customers: {
    id:            string
    name:          string
    phone:         string
    customer_code: string
  } | null
}

interface Props {
  canApprove: boolean  // approve_credit_note
  canManage:  boolean  // manage_credit_notes
}

/* ── ثوابت ──────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  price_adjustment: 'تعديل سعر',
  partial_refund:   'استرداد جزئي',
  error_correction: 'تصحيح خطأ',
}

const COURT_LABELS: Record<string, string> = {
  football:   'كرة القدم',
  volleyball: 'الكرة الطائرة',
  multi:      'ملعب متعدد',
}

const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }

function fmt(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/* ── Badge الحالة ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  if (status === 'draft') return (
    <span className="cn-badge cn-badge-draft">
      <Clock size={11} /> مسودة
    </span>
  )
  if (status === 'approved') return (
    <span className="cn-badge cn-badge-approved">
      <CheckCircle2 size={11} /> معتمد
    </span>
  )
  return (
    <span className="cn-badge cn-badge-cancelled">
      <XCircle size={11} /> ملغى
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════
   المكوّن الرئيسي
══════════════════════════════════════════════════════════════ */

export default function CreditNotesClient({ canApprove, canManage }: Props) {
  const [creditNotes,  setCreditNotes]  = useState<CreditNote[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [actionError,  setActionError]  = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // فلترة الحالة — draft افتراضياً
  const [statusFilter, setStatusFilter] = useState<'draft' | 'approved' | 'cancelled' | ''>('draft')

  /* ── جلب الإشعارات ─────────────────────────────────────────── */

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const res  = await fetch(`/api/admin/credit-notes?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل التحميل')
      setCreditNotes(data.credit_notes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchCreditNotes() }, [fetchCreditNotes])

  /* ── اعتماد إشعار ──────────────────────────────────────────── */

  const handleApprove = async (cn: CreditNote) => {
    if (!window.confirm(`اعتماد إشعار ${cn.credit_note_number} بمبلغ ${fmt(cn.amount)} ر.س؟\nلا يمكن التراجع عن هذا الإجراء.`)) return
    setActionError(null)
    setProcessingId(cn.id)
    try {
      const res  = await fetch(`/api/admin/credit-notes/${cn.id}/approve`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error ?? 'فشل الاعتماد'); return }
      // تحديث فوري
      setCreditNotes(prev => prev.map(c =>
        c.id === cn.id
          ? { ...c, status: 'approved' as const, approved_at: new Date().toISOString() }
          : c
      ).filter(c => statusFilter === 'draft' ? c.status !== 'approved' : true))
    } catch {
      setActionError('فشل الاتصال بالخادم')
    } finally {
      setProcessingId(null)
    }
  }

  /* ── إلغاء إشعار ───────────────────────────────────────────── */

  const handleCancel = async (cn: CreditNote) => {
    const reason = window.prompt(`سبب إلغاء ${cn.credit_note_number} (اختياري):`)
    if (reason === null) return  // ضغط Cancel
    setActionError(null)
    setProcessingId(cn.id)
    try {
      const res  = await fetch(`/api/admin/credit-notes/${cn.id}/cancel`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cancel_reason: reason }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error ?? 'فشل الإلغاء'); return }
      setCreditNotes(prev => prev.map(c =>
        c.id === cn.id
          ? { ...c, status: 'cancelled' as const, cancelled_at: new Date().toISOString(), cancel_reason: reason }
          : c
      ).filter(c => statusFilter === 'draft' ? c.status !== 'cancelled' : true))
    } catch {
      setActionError('فشل الاتصال بالخادم')
    } finally {
      setProcessingId(null)
    }
  }

  /* ── الإحصائيات ─────────────────────────────────────────────── */

  const totalAmount = creditNotes.reduce((s, c) => s + Number(c.amount), 0)

  /* ── العرض ──────────────────────────────────────────────────── */

  return (
    <>
      {/* ── شريط الفلاتر الموحّد ─────────────────────────────── */}
      <FilterBar
        tabGroups={[{
          value:    statusFilter,
          onChange: (v) => setStatusFilter(v as typeof statusFilter),
          tabs: [
            { value: 'draft',     label: 'المعلّقة',  icon: <Clock        size={13} /> },
            { value: '',          label: 'الكل',       icon: <FileText     size={13} /> },
            { value: 'approved',  label: 'المعتمدة',  icon: <CheckCircle2 size={13} /> },
            { value: 'cancelled', label: 'الملغاة',   icon: <XCircle      size={13} /> },
          ],
        }]}
        onRefresh={fetchCreditNotes}
        refreshing={loading}
      />

      {/* ── رسالة خطأ الإجراء ───────────────────────────────── */}
      {actionError && (
        <div className="cn-action-error">
          <AlertTriangle size={14} />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="cn-err-dismiss">×</button>
        </div>
      )}

      {/* ── إحصاء سريع ──────────────────────────────────────── */}
      {!loading && !error && creditNotes.length > 0 && (
        <div className="cn-summary">
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {creditNotes.length} إشعار
            {statusFilter === 'draft' ? ' معلّق' : statusFilter === 'approved' ? ' معتمد' : statusFilter === 'cancelled' ? ' ملغى' : ''}
          </span>
          {totalAmount > 0 && (
            <span style={{ color: 'var(--color-lime)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)' }}>
              إجمالي: {fmt(totalAmount)} ر.س
            </span>
          )}
        </div>
      )}

      {/* ── المحتوى ─────────────────────────────────────────── */}
      {loading ? (
        <div className="cn-center">
          <Loader2 size={28} className="cn-spin" />
          <span>جارٍ تحميل إشعارات الائتمان…</span>
        </div>
      ) : error ? (
        <div className="cn-center">
          <AlertTriangle size={28} style={{ color: 'var(--color-danger)' }} />
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="btn btn-ghost" onClick={fetchCreditNotes}>إعادة المحاولة</button>
        </div>
      ) : creditNotes.length === 0 ? (
        <div className="cn-center">
          <FileText size={40} style={{ opacity: 0.25 }} />
          <p style={{ color: 'var(--text-muted)' }}>
            {statusFilter === 'draft'
              ? 'لا توجد إشعارات ائتمان معلّقة'
              : 'لا توجد إشعارات ائتمان'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم الإشعار</th>
                  <th>الفاتورة</th>
                  <th>الحجز</th>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>السبب / النوع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  {(canApprove || canManage) && <th style={{ width: 120 }}>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {creditNotes.map(cn => {
                  const inv = cn.invoices
                  const bk  = inv?.bookings
                  const cust = cn.customers
                  const isProcessing = processingId === cn.id

                  return (
                    <tr key={cn.id}>
                      {/* رقم الإشعار */}
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          fontSize: 'var(--text-xs)', color: 'var(--text-primary)',
                        }}>
                          {cn.credit_note_number}
                        </span>
                      </td>

                      {/* الفاتورة */}
                      <td>
                        {inv ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: 'var(--text-xs)',
                            color: 'var(--color-lime)',
                          }}>
                            {inv.invoice_number}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* الحجز */}
                      <td>
                        {bk ? (
                          <a
                            href={`/admin/bookings/${bk.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              textDecoration: 'none',
                            }}
                          >
                            {new Date(bk.booking_date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                            · {COURT_LABELS[bk.court_id] ?? bk.court_id}
                            · {PERIOD_LABELS[bk.period_number] ?? ''}
                            <ExternalLink size={10} style={{ opacity: 0.5 }} />
                          </a>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* العميل */}
                      <td>
                        {cust ? (
                          <span style={{ fontSize: 'var(--text-sm)' }}>{cust.name}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* المبلغ */}
                      <td>
                        <strong style={{ color: 'var(--color-lime)' }}>
                          {fmt(cn.amount)} ر.س
                        </strong>
                      </td>

                      {/* السبب / النوع */}
                      <td>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>
                          {TYPE_LABELS[cn.type] ?? cn.type}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cn.reason}>
                          {cn.reason}
                        </div>
                        {cn.cancel_reason && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', marginTop: 2 }}>
                            إلغاء: {cn.cancel_reason}
                          </div>
                        )}
                      </td>

                      {/* الحالة */}
                      <td><StatusBadge status={cn.status} /></td>

                      {/* التاريخ */}
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(cn.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                        {cn.approved_at && (
                          <div style={{ color: 'var(--color-lime)', marginTop: 2 }}>
                            اعتمد: {new Date(cn.approved_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </td>

                      {/* إجراءات */}
                      {(canApprove || canManage) && (
                        <td>
                          {cn.status === 'draft' ? (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
                              {canApprove && (
                                <button
                                  id={`btn-cn-approve-${cn.id}`}
                                  className="btn btn-success"
                                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                                  disabled={isProcessing}
                                  onClick={() => handleApprove(cn)}
                                >
                                  {isProcessing
                                    ? <Loader2 size={12} className="cn-spin" />
                                    : <CheckCircle2 size={12} />
                                  }
                                  اعتماد
                                </button>
                              )}
                              {canManage && (
                                <button
                                  id={`btn-cn-cancel-${cn.id}`}
                                  className="btn btn-danger"
                                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                                  disabled={isProcessing}
                                  onClick={() => handleCancel(cn)}
                                >
                                  {isProcessing
                                    ? <Loader2 size={12} className="cn-spin" />
                                    : <XCircle size={12} />
                                  }
                                  إلغاء
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {cn.status === 'approved' ? '✓ معتمد' : '✗ ملغى'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Styles ──────────────────────────────────────────── */}
      <style>{`

        /* إحصاء سريع */
        .cn-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) var(--space-3);
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          margin-bottom: var(--space-4);
        }

        /* badges */
        .cn-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0.15em 0.55em;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-semibold);
          border: 1px solid;
          white-space: nowrap;
        }
        .cn-badge-draft    { background: var(--color-warning-bg); color: var(--color-warning); border-color: rgba(245,166,35,.3); }
        .cn-badge-approved { background: var(--color-lime-muted); color: var(--color-lime);    border-color: var(--color-lime-dim); }
        .cn-badge-cancelled { background: rgba(224,85,85,.08); color: var(--color-danger); border-color: rgba(224,85,85,.25); }

        /* خطأ إجراء */
        .cn-action-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          color: var(--color-danger);
          margin-bottom: var(--space-4);
        }
        .cn-err-dismiss {
          margin-right: auto;
          background: none; border: none;
          color: inherit; cursor: pointer; font-size: 1rem; padding: 0;
        }

        /* center placeholder */
        .cn-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-16);
          color: var(--text-muted);
          text-align: center;
        }

        /* spinner */
        .cn-spin { animation: cnSpin 0.9s linear infinite; }
        @keyframes cnSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
