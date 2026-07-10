'use client'
// ============================================================
// PayrollClient — صفحة تشغيل الرواتب الشهرية (Client Component)
// يشمل: اختيار الشهر · جدول المستفيدين · Confirm Modal · Payslip
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { Loader2, DollarSign, CheckCircle2, Clock, Printer, X, AlertTriangle, RefreshCw, Banknote, Gift } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────

interface PaymentRecord {
  id:                string
  compensation_profile_id: string
  period_month:      string
  base_amount:       number
  commission_amount: number
  bonus_amount:      number
  total_amount:      number
  paid_at:           string
  notes:             string | null
}

interface PayrollRow {
  profile_id:       string
  beneficiary_type: 'admin_user' | 'employee'
  beneficiary_id:   string
  name:             string
  position:         string
  base_salary:      number
  commission_total: number
  bonus_total:      number
  total_due:        number
  commission_ids:   string[]
  bonus_ids:        string[]
  payment:          PaymentRecord | null
}

interface Props {
  canManagePayroll: boolean
}

// ── Helpers ──────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س'
}

function getLast12Months() {
  const result: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
    result.push({ value, label })
  }
  return result
}

function currentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function formatPaidAt(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── PayslipModal ─────────────────────────────────────────────

function PayslipModal({ row, month, onClose }: { row: PayrollRow; month: string; onClose: () => void }) {
  const p = row.payment!
  const monthLabel = new Date(month + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })

  return (
    <div className="pl-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pl-modal pl-payslip" id="payslip-print-area">
        <div className="pl-payslip-header">
          <div className="pl-payslip-logo">💵</div>
          <div>
            <h2 className="pl-payslip-title">كشف راتب</h2>
            <p className="pl-payslip-sub">منشأة حي الشاطئ الرياضي</p>
          </div>
          <button className="pl-close no-print" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pl-payslip-meta">
          <div className="pl-payslip-meta-item">
            <span className="pl-payslip-meta-label">المستفيد</span>
            <span className="pl-payslip-meta-val">{row.name}</span>
          </div>
          <div className="pl-payslip-meta-item">
            <span className="pl-payslip-meta-label">المنصب</span>
            <span className="pl-payslip-meta-val">{row.position}</span>
          </div>
          <div className="pl-payslip-meta-item">
            <span className="pl-payslip-meta-label">الشهر</span>
            <span className="pl-payslip-meta-val">{monthLabel}</span>
          </div>
          <div className="pl-payslip-meta-item">
            <span className="pl-payslip-meta-label">تاريخ الصرف</span>
            <span className="pl-payslip-meta-val">{formatPaidAt(p.paid_at)}</span>
          </div>
          <div className="pl-payslip-meta-item">
            <span className="pl-payslip-meta-label">نوع المستفيد</span>
            <span className="pl-payslip-meta-val">{row.beneficiary_type === 'admin_user' ? 'مدير / إداري' : 'موظف ميداني'}</span>
          </div>
        </div>

        <table className="pl-payslip-table">
          <thead>
            <tr>
              <th>البند</th>
              <th>المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>الراتب الأساسي</td>
              <td className="pl-payslip-amt">{fmt(Number(p.base_amount))}</td>
            </tr>
            {Number(p.commission_amount) > 0 && (
              <tr>
                <td>العمولات ({row.commission_ids.length} سجل)</td>
                <td className="pl-payslip-amt pl-lime">{fmt(Number(p.commission_amount))}</td>
              </tr>
            )}
            {Number(p.bonus_amount) > 0 && (
              <tr>
                <td>المكافآت ({row.bonus_ids.length} سجل)</td>
                <td className="pl-payslip-amt pl-lime">{fmt(Number(p.bonus_amount))}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="pl-payslip-total-row">
              <td>الإجمالي المصروف</td>
              <td className="pl-payslip-total">{fmt(Number(p.total_amount))}</td>
            </tr>
          </tfoot>
        </table>

        {p.notes && (
          <div className="pl-payslip-notes">
            <strong>ملاحظات:</strong> {p.notes}
          </div>
        )}

        <div className="pl-payslip-footer">
          <p>رقم السجل: {p.id.slice(0, 8)}…</p>
          <p>صُدر بتاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div className="pl-payslip-actions no-print">
          <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
          <button
            id="btn-print-payslip"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            <Printer size={15} /> طباعة الكشف
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ConfirmPayModal ───────────────────────────────────────────

function ConfirmPayModal({
  row,
  month,
  onConfirm,
  onClose,
  paying,
  payError,
}: {
  row:      PayrollRow
  month:    string
  onConfirm: (notes: string) => void
  onClose:  () => void
  paying:   boolean
  payError: string | null
}) {
  const [notes, setNotes] = useState('')
  const monthLabel = new Date(month + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })

  return (
    <div className="pl-backdrop" onClick={e => { if (e.target === e.currentTarget && !paying) onClose() }}>
      <div className="pl-modal">
        <div className="pl-modal-header">
          <div className="pl-modal-icon"><DollarSign size={18} /></div>
          <h3 className="pl-modal-title">تأكيد صرف الراتب</h3>
          <button className="pl-close" onClick={onClose} disabled={paying}><X size={18} /></button>
        </div>

        <div className="pl-confirm-name">{row.name}</div>
        <div className="pl-confirm-period">شهر {monthLabel} · {row.position}</div>

        <div className="pl-breakdown">
          <div className="pl-bk-row">
            <span className="pl-bk-label">الراتب الأساسي</span>
            <span className="pl-bk-val">{fmt(row.base_salary)}</span>
          </div>
          {row.commission_total > 0 && (
            <div className="pl-bk-row">
              <span className="pl-bk-label">العمولات ({row.commission_ids.length} سجل)</span>
              <span className="pl-bk-val pl-lime">{fmt(row.commission_total)}</span>
            </div>
          )}
          {row.bonus_total > 0 && (
            <div className="pl-bk-row">
              <span className="pl-bk-label">المكافآت ({row.bonus_ids.length} سجل)</span>
              <span className="pl-bk-val pl-lime">{fmt(row.bonus_total)}</span>
            </div>
          )}
          <div className="pl-bk-divider" />
          <div className="pl-bk-row pl-bk-total">
            <span className="pl-bk-label">الإجمالي المستحق</span>
            <span className="pl-bk-val">{fmt(row.total_due)}</span>
          </div>
        </div>

        <div className="pl-field">
          <label className="pl-label">ملاحظات (اختياري)</label>
          <textarea
            className="input"
            rows={2}
            placeholder="مثال: راتب شهر يوليو 2026 مع مكافأة الأداء"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={paying}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {payError && (
          <div className="pl-error">
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            {payError}
          </div>
        )}

        <div className="pl-modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={paying}>إلغاء</button>
          <button
            id="btn-confirm-pay"
            className="btn btn-primary"
            onClick={() => onConfirm(notes)}
            disabled={paying}
          >
            {paying ? <Loader2 size={15} className="pl-spin" /> : <DollarSign size={15} />}
            {paying ? 'جارٍ الصرف…' : `صرف ${fmt(row.total_due)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── BonusModal ───────────────────────────────────────────────

function BonusModal({
  profileId,
  name,
  onClose,
  onSuccess,
}: {
  profileId: string
  name:      string
  onClose:   () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const n = Number(amount)
    if (isNaN(n) || n <= 0) { setError('المبلغ يجب أن يكون أكبر من صفر'); return }
    if (!reason.trim())     { setError('سبب المكافأة مطلوب'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/admin/bonuses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ compensation_profile_id: profileId, amount: n, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل إنشاء المكافأة')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pl-backdrop" onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="pl-modal">
        <div className="pl-modal-header">
          <div className="pl-modal-icon"><Gift size={18} /></div>
          <h3 className="pl-modal-title">إضافة مكافأة — {name}</h3>
          <button className="pl-close" onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pl-field">
            <label className="pl-label">المبلغ (ر.س) *</label>
            <input
              id="bonus-amount"
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              autoFocus
              disabled={saving}
            />
          </div>
          <div className="pl-field">
            <label className="pl-label">السبب *</label>
            <input
              id="bonus-reason"
              className="input"
              type="text"
              placeholder="مثال: مكافأة الأداء المتميز · بدل رمضان"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          {error && (
            <div className="pl-error">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <div className="pl-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>إلغاء</button>
            <button id="btn-save-bonus" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="pl-spin" /> : <Gift size={14} />}
              {saving ? 'جارٍ الحفظ…' : 'حفظ المكافأة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export default function PayrollClient({ canManagePayroll }: Props) {
  const months   = getLast12Months()
  const [month,  setMonth]  = useState(currentMonth())
  const [rows,   setRows]   = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Modal states
  const [confirmRow, setConfirmRow] = useState<PayrollRow | null>(null)
  const [paying,     setPaying]     = useState(false)
  const [payError,   setPayError]   = useState<string | null>(null)
  const [payslipRow, setPayslipRow] = useState<PayrollRow | null>(null)
  const [bonusRow,   setBonusRow]   = useState<PayrollRow | null>(null)

  const fetchPayroll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/admin/payroll?month=${month}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل تحميل البيانات')
      setRows(data.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchPayroll() }, [fetchPayroll])

  // ── تنفيذ الصرف ─────────────────────────────────────────────
  const handlePay = async (notes: string) => {
    if (!confirmRow) return
    setPaying(true); setPayError(null)
    try {
      const res  = await fetch('/api/admin/payroll/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          compensation_profile_id: confirmRow.profile_id,
          period_month:            month,
          base_amount:             confirmRow.base_salary,
          commission_amount:       confirmRow.commission_total,
          bonus_amount:            confirmRow.bonus_total,
          commission_ids:          confirmRow.commission_ids,
          bonus_ids:               confirmRow.bonus_ids,
          notes:                   notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل الصرف')
      setConfirmRow(null)
      await fetchPayroll()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setPaying(false)
    }
  }

  // ── إحصائيات سريعة ────────────────────────────────────────
  const paidCount    = rows.filter(r => r.payment).length
  const pendingCount = rows.filter(r => !r.payment).length
  const pendingTotal = rows.filter(r => !r.payment).reduce((s, r) => s + r.total_due, 0)
  const paidTotal    = rows.filter(r => r.payment).reduce((s, r) => s + Number(r.payment!.total_amount), 0)

  const monthLabel = month
    ? new Date(month + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
    : ''

  return (
    <>
      {/* ── فلتر الشهر ────────────────────────────────────── */}
      <div className="pl-toolbar">
        <div className="pl-toolbar-right">
          <label className="pl-label" htmlFor="payroll-month-select">الشهر</label>
          <select
            id="payroll-month-select"
            className="input pl-month-select"
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <button
          id="btn-refresh-payroll"
          className="btn btn-ghost"
          onClick={fetchPayroll}
          disabled={loading}
          title="تحديث"
        >
          <RefreshCw size={15} className={loading ? 'pl-spin' : ''} />
        </button>
      </div>

      {/* ── بطاقات الإحصائيات ─────────────────────────────── */}
      {!loading && !error && rows.length > 0 && (
        <div className="pl-stats">
          <div className="pl-stat pl-stat-pending">
            <div className="pl-stat-icon"><Clock size={18} /></div>
            <div>
              <div className="pl-stat-val">{pendingCount}</div>
              <div className="pl-stat-lbl">لم يُصرف بعد</div>
              <div className="pl-stat-sub">{fmt(pendingTotal)}</div>
            </div>
          </div>
          <div className="pl-stat pl-stat-paid">
            <div className="pl-stat-icon"><CheckCircle2 size={18} /></div>
            <div>
              <div className="pl-stat-val">{paidCount}</div>
              <div className="pl-stat-lbl">صُرف</div>
              <div className="pl-stat-sub">{fmt(paidTotal)}</div>
            </div>
          </div>
          <div className="pl-stat pl-stat-total">
            <div className="pl-stat-icon"><Banknote size={18} /></div>
            <div>
              <div className="pl-stat-val">{rows.length}</div>
              <div className="pl-stat-lbl">إجمالي المستفيدين</div>
              <div className="pl-stat-sub">شهر {monthLabel}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── حالات التحميل والخطأ ──────────────────────────── */}
      {loading && (
        <div className="pl-center">
          <Loader2 size={32} className="pl-spin" />
          <p>جارٍ تحميل بيانات الرواتب…</p>
        </div>
      )}

      {!loading && error && (
        <div className="pl-error pl-error-block">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="pl-empty">
          <Banknote size={48} strokeWidth={1.5} />
          <p>لا يوجد مستفيدون نشطون حالياً</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            أضف موظفين أو مديرين وفعّل ملفات تعويضهم أولاً
          </p>
        </div>
      )}

      {/* ── جدول الرواتب ─────────────────────────────────── */}
      {!loading && !error && rows.length > 0 && (
        <div className="table-container">
          <table className="table pl-table">
            <thead>
              <tr>
                <th>المستفيد</th>
                <th>الأساسي</th>
                <th>عمولات</th>
                <th>مكافآت</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th style={{ width: 200 }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const paid = row.payment !== null
                return (
                  <tr key={row.profile_id} className={paid ? 'pl-row-paid' : ''}>
                    <td>
                      <div className="pl-cell-name">{row.name}</div>
                      <div className="pl-cell-sub">
                        <span className={`pl-type-badge ${row.beneficiary_type === 'admin_user' ? 'pl-type-admin' : 'pl-type-emp'}`}>
                          {row.beneficiary_type === 'admin_user' ? 'إداري' : 'ميداني'}
                        </span>
                        {row.position !== '—' && (
                          <span className="pl-cell-position">{row.position}</span>
                        )}
                      </div>
                    </td>
                    <td className="pl-num">{fmt(row.base_salary)}</td>
                    <td className="pl-num">
                      {row.commission_total > 0 ? (
                        <span className="pl-lime">{fmt(row.commission_total)}</span>
                      ) : <span className="pl-muted">—</span>}
                    </td>
                    <td className="pl-num">
                      {row.bonus_total > 0 ? (
                        <span className="pl-lime">{fmt(row.bonus_total)}</span>
                      ) : <span className="pl-muted">—</span>}
                    </td>
                    <td className="pl-num pl-total-cell">{fmt(row.total_due)}</td>
                    <td>
                      {paid ? (
                        <div className="pl-status-paid">
                          <CheckCircle2 size={13} />
                          <span>صُرف {new Date(row.payment!.paid_at).toLocaleDateString('ar-SA')}</span>
                        </div>
                      ) : (
                        <div className="pl-status-pending">
                          <Clock size={13} />
                          <span>لم يُصرف بعد</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="pl-row-actions">
                        {canManagePayroll && !paid && (
                          <button
                            id={`btn-pay-${row.profile_id}`}
                            className="btn btn-primary pl-btn-pay"
                            onClick={() => { setConfirmRow(row); setPayError(null) }}
                          >
                            <DollarSign size={13} /> صرف
                          </button>
                        )}
                        {canManagePayroll && !paid && (
                          <button
                            id={`btn-bonus-${row.profile_id}`}
                            className="btn btn-ghost pl-btn-bonus"
                            onClick={() => setBonusRow(row)}
                            title="إضافة مكافأة"
                          >
                            <Gift size={13} />
                          </button>
                        )}
                        {paid && (
                          <button
                            id={`btn-payslip-${row.profile_id}`}
                            className="btn btn-ghost pl-btn-payslip"
                            onClick={() => setPayslipRow(row)}
                          >
                            <Printer size={13} /> كشف الراتب
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {confirmRow && (
        <ConfirmPayModal
          row={confirmRow}
          month={month}
          onConfirm={handlePay}
          onClose={() => { if (!paying) setConfirmRow(null) }}
          paying={paying}
          payError={payError}
        />
      )}

      {payslipRow && (
        <PayslipModal
          row={payslipRow}
          month={month}
          onClose={() => setPayslipRow(null)}
        />
      )}

      {bonusRow && (
        <BonusModal
          profileId={bonusRow.profile_id}
          name={bonusRow.name}
          onClose={() => setBonusRow(null)}
          onSuccess={fetchPayroll}
        />
      )}

      {/* ── Styles ────────────────────────────────────────── */}
      <style>{`
        /* Toolbar */
        .pl-toolbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
          flex-wrap: wrap;
        }
        .pl-toolbar-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .pl-month-select {
          min-width: 160px;
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
        }

        /* Stats */
        .pl-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .pl-stat {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-5);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pl-stat:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .pl-stat-icon {
          width: 42px; height: 42px;
          border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pl-stat-pending .pl-stat-icon { background: var(--color-warning-bg); color: var(--color-warning); }
        .pl-stat-paid    .pl-stat-icon { background: var(--color-lime-muted); color: var(--color-lime); }
        .pl-stat-total   .pl-stat-icon { background: var(--bg-elevated);      color: var(--text-secondary); }
        .pl-stat-val {
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          line-height: 1.1;
        }
        .pl-stat-lbl { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); margin-top: 2px; }
        .pl-stat-sub { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }

        /* Table */
        .pl-table .pl-num { text-align: end; font-variant-numeric: tabular-nums; }
        .pl-total-cell { font-weight: var(--font-bold); color: var(--text-primary); }
        .pl-lime   { color: var(--color-lime); font-weight: var(--font-semibold); }
        .pl-muted  { color: var(--text-muted); }
        .pl-row-paid { opacity: 0.8; }
        .pl-cell-name     { font-weight: var(--font-semibold); color: var(--text-primary); }
        .pl-cell-sub      { display: flex; align-items: center; gap: var(--space-2); margin-top: 3px; flex-wrap: wrap; }
        .pl-cell-position { font-size: var(--text-xs); color: var(--text-muted); }
        .pl-type-badge {
          font-size: 10px;
          padding: 0.1em 0.55em;
          border-radius: var(--radius-full);
          font-weight: var(--font-semibold);
          border: 1px solid;
          white-space: nowrap;
        }
        .pl-type-admin { background: rgba(139,92,246,.1); color: #a78bfa; border-color: rgba(139,92,246,.3); }
        .pl-type-emp   { background: var(--color-lime-muted); color: var(--color-lime); border-color: var(--color-lime-dim); }

        /* Status */
        .pl-status-paid, .pl-status-pending {
          display: flex; align-items: center; gap: 5px;
          font-size: var(--text-xs); font-weight: var(--font-semibold);
        }
        .pl-status-paid    { color: var(--color-lime); }
        .pl-status-pending { color: var(--color-warning); }

        /* Row actions */
        .pl-row-actions { display: flex; gap: var(--space-2); align-items: center; }
        .pl-btn-pay     { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
        .pl-btn-bonus   { padding: var(--space-1) var(--space-2); font-size: var(--text-xs); }
        .pl-btn-payslip { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }

        /* States */
        .pl-center {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: var(--space-4);
          padding: var(--space-16); color: var(--text-muted);
        }
        .pl-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: var(--space-4);
          padding: var(--space-16); color: var(--text-muted); text-align: center;
        }
        .pl-error {
          display: flex; align-items: flex-start; gap: var(--space-2);
          background: var(--color-danger-bg); border: 1px solid rgba(224,85,85,.4);
          border-radius: var(--radius-md); padding: var(--space-3);
          font-size: var(--text-sm); color: var(--color-danger);
          margin-bottom: var(--space-4);
        }
        .pl-error-block { margin-top: var(--space-4); }
        .pl-spin { animation: plSpin 0.9s linear infinite; }
        @keyframes plSpin { to { transform: rotate(360deg); } }

        /* Modal Backdrop */
        .pl-backdrop {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(4px);
          z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: plFadeIn 0.15s ease;
        }
        @keyframes plFadeIn { from { opacity: 0 } to { opacity: 1 } }

        /* Modal */
        .pl-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%; max-width: 480px;
          padding: var(--space-6);
          animation: plSlideUp 0.18s ease;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }
        @keyframes plSlideUp { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
        .pl-modal-header {
          display: flex; align-items: center; gap: var(--space-3);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
        }
        .pl-modal-icon {
          width: 36px; height: 36px;
          background: var(--color-lime-muted);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-lime); flex-shrink: 0;
        }
        .pl-modal-title {
          font-size: var(--text-base); font-weight: var(--font-bold);
          color: var(--text-primary); margin: 0; flex: 1;
        }
        .pl-close {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: var(--space-1);
          border-radius: var(--radius-sm); display: flex;
          transition: color 0.15s;
        }
        .pl-close:hover { color: var(--text-primary); }
        .pl-modal-footer {
          display: flex; gap: var(--space-3); justify-content: flex-end;
          margin-top: var(--space-5); padding-top: var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }
        .pl-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-4); }
        .pl-label { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); }

        /* Confirm breakdown */
        .pl-confirm-name { font-size: var(--text-lg); font-weight: var(--font-bold); color: var(--text-primary); }
        .pl-confirm-period { font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-5); margin-top: 2px; }
        .pl-breakdown {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-5);
        }
        .pl-bk-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; }
        .pl-bk-label { font-size: var(--text-sm); color: var(--text-secondary); }
        .pl-bk-val { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); }
        .pl-bk-divider { border-top: 1px solid var(--border-subtle); margin: var(--space-2) 0; }
        .pl-bk-total .pl-bk-label { font-weight: var(--font-bold); color: var(--text-primary); font-size: var(--text-base); }
        .pl-bk-total .pl-bk-val   { font-size: var(--text-base); color: var(--color-lime); }

        /* Payslip */
        .pl-payslip { max-width: 560px; }
        .pl-payslip-header {
          display: flex; align-items: center; gap: var(--space-4);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 2px solid var(--color-lime-dim);
        }
        .pl-payslip-logo { font-size: 2rem; }
        .pl-payslip-title { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--text-primary); margin: 0; }
        .pl-payslip-sub { font-size: var(--text-xs); color: var(--text-muted); margin: 2px 0 0; }
        .pl-payslip-meta {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--space-3) var(--space-6);
          margin-bottom: var(--space-5);
          background: var(--bg-elevated);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          border: 1px solid var(--border-subtle);
        }
        .pl-payslip-meta-item { display: flex; flex-direction: column; gap: 2px; }
        .pl-payslip-meta-label { font-size: var(--text-xs); color: var(--text-muted); }
        .pl-payslip-meta-val   { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); }
        .pl-payslip-table {
          width: 100%; border-collapse: collapse;
          margin-bottom: var(--space-4);
          font-size: var(--text-sm);
        }
        .pl-payslip-table th {
          background: var(--bg-elevated);
          padding: var(--space-2) var(--space-3);
          text-align: start;
          color: var(--text-secondary);
          font-weight: var(--font-semibold);
          border-bottom: 1px solid var(--border-subtle);
        }
        .pl-payslip-table td {
          padding: var(--space-2) var(--space-3);
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }
        .pl-payslip-amt { text-align: end; font-variant-numeric: tabular-nums; }
        .pl-payslip-total-row td {
          font-weight: var(--font-bold);
          border-top: 2px solid var(--color-lime-dim);
          border-bottom: none;
        }
        .pl-payslip-total { text-align: end; font-size: var(--text-base); color: var(--color-lime); }
        .pl-payslip-notes {
          font-size: var(--text-xs); color: var(--text-muted);
          padding: var(--space-3); background: var(--bg-elevated);
          border-radius: var(--radius-md); margin-bottom: var(--space-4);
          border: 1px solid var(--border-subtle);
        }
        .pl-payslip-footer {
          display: flex; justify-content: space-between;
          font-size: var(--text-xs); color: var(--text-muted);
          border-top: 1px solid var(--border-subtle);
          padding-top: var(--space-3); margin-bottom: var(--space-4);
        }
        .pl-payslip-footer p { margin: 0; }
        .pl-payslip-actions {
          display: flex; gap: var(--space-3); justify-content: flex-end;
        }

        /* Print */
        @media print {
          .no-print { display: none !important; }
          .pl-backdrop { position: static; background: none; backdrop-filter: none; padding: 0; }
          .pl-modal { box-shadow: none; border: none; max-height: none; max-width: 100%; }
          body * { visibility: hidden; }
          #payslip-print-area, #payslip-print-area * { visibility: visible; }
          #payslip-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }

        @media (max-width: 600px) {
          .pl-stats { grid-template-columns: 1fr 1fr; }
          .pl-payslip-meta { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}
