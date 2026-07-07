'use client'
// ============================================================
// CommissionsSection — قسم تخصيص العمولات بصفحة تفاصيل الحجز
// يعرض العمولات المخصَّصة + Modal إضافة عمولة جديدة
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  DollarSign, Plus, X, Loader2, Trash2, AlertTriangle,
  TrendingUp, Hash,
} from 'lucide-react'
import { calculateSuggestedCommission } from '@/lib/commissions'

// ── أنواع البيانات ──────────────────────────────────────────

interface Beneficiary {
  profile_id:       string
  beneficiary_type: 'employee' | 'admin_user'
  beneficiary_id:   string
  name:             string
  subtitle:         string
  commission_type:  'percentage' | 'fixed_per_booking'
  commission_value: number
}

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
  bookingId:         string
  bookingAmount:     number   // final_price للحجز — أساس حساب العمولة
  canManagePayroll:  boolean
}

// ── تسميات نوع العمولة ─────────────────────────────────────

function commissionLabel(type: string, value: number) {
  if (type === 'percentage')        return `${value}%`
  if (type === 'fixed_per_booking') return `${value} ر.س ثابت`
  return ''
}

// ── أيقونة نوع العمولة ─────────────────────────────────────

function CommIcon({ type }: { type: string }) {
  if (type === 'percentage')        return <TrendingUp size={12} />
  if (type === 'fixed_per_booking') return <Hash size={12} />
  return null
}

// ============================================================
// Modal: إضافة عمولة جديدة
// ============================================================

function AddCommissionModal({
  bookingId,
  bookingAmount,
  onClose,
  onSuccess,
}: {
  bookingId:     string
  bookingAmount: number
  onClose:       () => void
  onSuccess:     (c: Commission) => void
}) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loadingB,      setLoadingB]      = useState(true)
  const [selected,      setSelected]      = useState<Beneficiary | null>(null)
  const [amount,        setAmount]        = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // جلب المستفيدين المؤهلين
  useEffect(() => {
    fetch('/api/admin/commissions/eligible-beneficiaries')
      .then(r => r.json())
      .then(d => setBeneficiaries(d.beneficiaries ?? []))
      .catch(() => setError('فشل تحميل قائمة المستفيدين'))
      .finally(() => setLoadingB(false))
  }, [])

  // عند اختيار مستفيد: احسب المقترح تلقائياً
  const handleSelectProfile = (profileId: string) => {
    const b = beneficiaries.find(x => x.profile_id === profileId)
    setSelected(b ?? null)
    if (b) {
      const suggested = calculateSuggestedCommission(
        { commission_type: b.commission_type, commission_value: b.commission_value },
        bookingAmount
      )
      setAmount(String(suggested))
    } else {
      setAmount('')
    }
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selected) { setError('اختر موظفاً أو مستفيداً'); return }
    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('المبلغ يجب أن يكون أكبر من صفر'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/admin/commissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          compensation_profile_id: selected.profile_id,
          booking_id:  bookingId,
          amount:      parsedAmount,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess(data.commission)
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  const suggested = selected
    ? calculateSuggestedCommission(
        { commission_type: selected.commission_type, commission_value: selected.commission_value },
        bookingAmount
      )
    : null

  return (
    <div className="cs-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cs-modal" role="dialog" aria-modal="true" aria-labelledby="cs-modal-title">
        {/* Header */}
        <div className="cs-modal-header">
          <div className="cs-modal-icon"><DollarSign size={18} /></div>
          <div style={{ flex: 1 }}>
            <h2 id="cs-modal-title" className="cs-modal-title">إضافة عمولة للحجز</h2>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              قيمة الحجز: {bookingAmount.toLocaleString('ar-SA')} ر.س
            </p>
          </div>
          <button className="cs-close" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* اختيار المستفيد */}
          <div className="cs-field">
            <label className="cs-label">المستفيد *</label>
            {loadingB ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                <Loader2 size={14} className="cs-spin" /> جارٍ التحميل…
              </div>
            ) : beneficiaries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
                لا يوجد موظفون/إداريون مؤهلون للعمولة حالياً.
                <br />
                <span style={{ fontSize: 'var(--text-xs)' }}>تأكد أن ملفات التعويض فعّالة وأن commission_type ≠ none</span>
              </p>
            ) : (
              <select
                id="cs-select-profile"
                className="input"
                value={selected?.profile_id ?? ''}
                onChange={e => handleSelectProfile(e.target.value)}
                required
              >
                <option value="">— اختر مستفيداً —</option>
                {beneficiaries.map(b => (
                  <option key={b.profile_id} value={b.profile_id}>
                    {b.name} ({b.subtitle}) — {commissionLabel(b.commission_type, b.commission_value)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* المبلغ المقترح والنهائي */}
          {selected && (
            <>
              {suggested !== null && (
                <div className="cs-suggestion">
                  <CommIcon type={selected.commission_type} />
                  <span>
                    المبلغ المقترح:&nbsp;
                    <strong style={{ color: 'var(--color-lime)' }}>
                      {suggested.toLocaleString('ar-SA')} ر.س
                    </strong>
                    {selected.commission_type === 'percentage' && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        &nbsp;({selected.commission_value}% من {bookingAmount.toLocaleString('ar-SA')})
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="cs-field">
                <label className="cs-label">المبلغ النهائي (ر.س) *</label>
                <input
                  id="cs-amount"
                  className="input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  يمكنك تعديل المبلغ المقترح قبل الحفظ
                </span>
              </div>
            </>
          )}

          {error && (
            <div className="cs-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="cs-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>إلغاء</button>
            <button
              id="btn-save-commission"
              type="submit"
              className="btn btn-primary"
              disabled={saving || !selected || beneficiaries.length === 0}
            >
              {saving ? <Loader2 size={14} className="cs-spin" /> : <DollarSign size={14} />}
              {saving ? 'جارٍ الحفظ…' : 'تخصيص العمولة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// القسم الرئيسي
// ============================================================

export default function CommissionsSection({ bookingId, bookingAmount, canManagePayroll }: Props) {
  const [mounted,     setMounted]     = useState(false)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [addOpen,     setAddOpen]     = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // جلب العمولات لهذا الحجز
  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/commissions?booking_id=${bookingId}`)
      const data = await res.json()
      if (res.ok) setCommissions(data.commissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => { fetchCommissions() }, [fetchCommissions])

  // حذف عمولة
  const handleDelete = async (commissionId: string) => {
    if (deletingId) return
    setDeleteError(null)
    setDeletingId(commissionId)
    try {
      const res  = await fetch(`/api/admin/commissions/${commissionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'فشل الحذف')
        return
      }
      setCommissions(prev => prev.filter(c => c.id !== commissionId))
    } catch {
      setDeleteError('فشل الاتصال بالخادم')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddSuccess = (c: Commission) => {
    setCommissions(prev => [c, ...prev])
    setAddOpen(false)
  }

  const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="cs-wrap">
      {/* رأس القسم */}
      <div className="cs-header">
        <div className="cs-header-title">
          <DollarSign size={16} style={{ color: 'var(--color-lime-dim)' }} />
          <h2>تخصيص عمولة</h2>
        </div>
        {canManagePayroll && (
          <button
            id="btn-add-commission"
            className="btn btn-primary"
            style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.8rem' }}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={13} strokeWidth={2.5} /> إضافة عمولة
          </button>
        )}
      </div>

      {/* المحتوى */}
      {loading ? (
        <div className="cs-loading">
          <Loader2 size={18} className="cs-spin" />
          <span>جارٍ التحميل…</span>
        </div>
      ) : commissions.length === 0 ? (
        <p className="cs-empty">لا توجد عمولات مخصَّصة لهذا الحجز بعد</p>
      ) : (
        <>
          <div className="cs-list">
            {commissions.map(c => (
              <div key={c.id} className={`cs-item ${c.included_in_salary_payment_id ? 'cs-item-paid' : ''}`}>
                <div className="cs-item-info">
                  <span className="cs-item-amount">
                    {Number(c.amount).toLocaleString('ar-SA')} ر.س
                  </span>
                  {c.included_in_salary_payment_id ? (
                    <span className="cs-badge cs-badge-paid">مُدرجة براتب</span>
                  ) : (
                    <span className="cs-badge cs-badge-pending">معلّقة</span>
                  )}
                </div>
                <div className="cs-item-meta">
                  {new Date(c.calculated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                {canManagePayroll && !c.included_in_salary_payment_id && (
                  <button
                    id={`btn-del-comm-${c.id}`}
                    className="btn-icon cs-del-btn"
                    title="حذف العمولة"
                    disabled={deletingId === c.id}
                    onClick={() => handleDelete(c.id)}
                  >
                    {deletingId === c.id
                      ? <Loader2 size={13} className="cs-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>

          {commissions.length > 1 && (
            <div className="cs-total">
              المجموع: <strong style={{ color: 'var(--color-lime)' }}>{totalAmount.toLocaleString('ar-SA')} ر.س</strong>
            </div>
          )}
        </>
      )}

      {/* رسالة خطأ الحذف */}
      {deleteError && (
        <div className="cs-error" style={{ marginTop: 'var(--space-3)' }}>
          <AlertTriangle size={14} />
          <span>{deleteError}</span>
          <button className="cs-err-dismiss" onClick={() => setDeleteError(null)}>×</button>
        </div>
      )}

      {/* Modal */}
      {mounted && addOpen && createPortal(
        <AddCommissionModal
          bookingId={bookingId}
          bookingAmount={bookingAmount}
          onClose={() => setAddOpen(false)}
          onSuccess={handleAddSuccess}
        />,
        document.body
      )}

      {/* Styles */}
      <style>{`
        .cs-wrap {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }
        .cs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--border-subtle);
        }
        .cs-header-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .cs-header-title h2 {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          margin: 0;
          color: var(--text-primary);
        }
        .cs-loading {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-muted);
          font-size: var(--text-sm);
          padding: var(--space-4) 0;
        }
        .cs-empty {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin: 0;
          padding: var(--space-3) 0;
        }
        .cs-spin { animation: csSpin 0.9s linear infinite; }
        @keyframes csSpin { to { transform: rotate(360deg); } }

        /* قائمة العمولات */
        .cs-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .cs-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          font-size: var(--text-sm);
        }
        .cs-item-paid { opacity: 0.75; }
        .cs-item-info {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }
        .cs-item-amount {
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .cs-item-meta {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-right: auto;
        }
        .cs-badge {
          font-size: 10px;
          padding: 0.1em 0.55em;
          border-radius: var(--radius-full);
          font-weight: var(--font-semibold);
          border: 1px solid;
          white-space: nowrap;
        }
        .cs-badge-paid {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border-color: var(--color-lime-dim);
        }
        .cs-badge-pending {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border-color: rgba(245,166,35,.3);
        }
        .cs-del-btn {
          width: 26px; height: 26px;
          background: none;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .cs-del-btn:hover:not(:disabled) {
          color: var(--color-danger);
          border-color: var(--color-danger);
          background: var(--color-danger-bg);
        }
        .cs-del-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cs-total {
          margin-top: var(--space-3);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          text-align: left;
          padding-top: var(--space-2);
          border-top: 1px solid var(--border-subtle);
        }

        /* Modal */
        .cs-backdrop {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(3px);
          z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: csFadeIn 0.15s ease;
        }
        @keyframes csFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .cs-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%; max-width: 460px;
          padding: var(--space-6);
          animation: csSlideUp 0.18s ease;
          max-height: 90vh;
          overflow-y: auto;
        }
        @keyframes csSlideUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .cs-modal-header {
          display: flex; align-items: flex-start; gap: var(--space-3);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
        }
        .cs-modal-icon {
          width: 36px; height: 36px;
          background: var(--color-lime-muted);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-lime);
          flex-shrink: 0;
        }
        .cs-modal-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0 0 2px;
        }
        .cs-close {
          background: none; border: none;
          color: var(--text-muted); cursor: pointer;
          padding: var(--space-1); border-radius: var(--radius-sm);
          display: flex; transition: color 0.15s;
          margin-right: auto;
        }
        .cs-close:hover { color: var(--text-primary); }
        .cs-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
        }
        .cs-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }
        .cs-suggestion {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          margin-bottom: var(--space-3);
        }
        .cs-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--color-danger);
          margin-bottom: var(--space-3);
        }
        .cs-err-dismiss {
          margin-right: auto;
          background: none; border: none;
          color: var(--color-danger);
          cursor: pointer; font-size: 1rem; padding: 0;
        }
        .cs-modal-footer {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          margin-top: var(--space-5);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>
    </div>
  )
}
