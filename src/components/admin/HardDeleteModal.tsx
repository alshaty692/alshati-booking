'use client'
// ============================================================
// HardDeleteModal — مودال الحذف النهائي للحجز
// يظهر فقط للـ admin على الحجوزات (cancelled/rejected/expired)
//
// ⚠️ السبب الجذري لمشكلة التموضع:
//   .card:hover { transform: translateY(-1px) }
//   أي عنصر أب يحمل transform يُصبح containing-block لـ position:fixed
//   الحل: نستخدم createPortal لتركيب المودال في document.body مباشرةً
//   خارج شجرة .card كلياً → position:fixed يعود للـ viewport دائماً
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Star, XCircle, Loader2, ShieldAlert } from 'lucide-react'
import type { PreDeleteCheckResult } from '@/lib/bookings'

interface Props {
  bookingId: string
  role:      string
}

export default function HardDeleteModal({ bookingId, role }: Props) {
  const router = useRouter()

  // ── State ─────────────────────────────────────────────────
  const [mounted,    setMounted]    = useState(false)   // SSR hydration guard
  const [isOpen,     setIsOpen]     = useState(false)
  const [btnLoading, setBtnLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkData,  setCheckData]  = useState<PreDeleteCheckResult | null>(null)
  const [reason,     setReason]     = useState('')
  const [blockSlot,  setBlockSlot]  = useState(true)
  const [apiError,   setApiError]   = useState<string | null>(null)
  const [warning,    setWarning]    = useState<string | null>(null)

  const fetchingRef = useRef(false)

  // ── SSR guard: createPortal يحتاج document ───────────────
  // نُفعّل بعد الـ hydration فقط لتجنب SSR/CSR mismatch
  useEffect(() => { setMounted(true) }, [])

  if (role !== 'admin') return null

  // ── فتح المودال ──────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    setBtnLoading(true)
    setCheckData(null)
    setApiError(null)
    setWarning(null)
    setReason('')
    setBlockSlot(true)

    try {
      const res  = await fetch(`/api/admin/bookings/${bookingId}/pre-delete-check`)
      const data = await res.json() as PreDeleteCheckResult
      setCheckData(data)
      setIsOpen(true)
    } catch {
      setApiError('فشل تحميل بيانات الفحص — حاول مجدداً')
    } finally {
      setBtnLoading(false)
      fetchingRef.current = false
    }
  }, [bookingId])

  // ── إغلاق المودال ────────────────────────────────────────
  const handleClose = () => {
    if (submitting) return
    setIsOpen(false)
    setCheckData(null)
    setReason('')
    setApiError(null)
    setWarning(null)
  }

  // ── إرسال الحذف ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!reason.trim()) { setApiError('سبب الحذف مطلوب'); return }
    if (checkData?.isBlocked) return

    setSubmitting(true)
    setApiError(null)
    try {
      const res  = await fetch(`/api/admin/bookings/${bookingId}/delete-permanently`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim(), blockSlot }),
      })
      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? 'حدث خطأ')
        return
      }

      if (data.warning) {
        setWarning(data.warning)
        setTimeout(() => router.push('/admin/bookings'), 2000)
      } else {
        router.push('/admin/bookings')
      }
    } catch {
      setApiError('فشل الاتصال بالخادم')
    } finally {
      setSubmitting(false)
    }
  }

  // ── رسالة السبب حسب blockReason ──────────────────────────
  function blockMessage(check: PreDeleteCheckResult): string {
    switch (check.blockReason) {
      case 'booking_still_active':
        return 'الحجز لا يزال نشطاً. ألغِه أولاً ثم حاول الحذف.'
      case 'combined_invoice':
        return `هذا الحجز جزء من باقة بفاتورة موحّدة (${check.invoiceNumber ?? ''}). الحذف الفردي غير ممكن — استخدم إلغاء الباقة كاملة.`
      case 'has_payments':
        return 'فاتورة هذا الحجز تحتوي على مدفوعات مسجّلة. الحذف غير ممكن — استخدم الإلغاء بدلاً منه.'
      case 'has_approved_cns':
        return 'فاتورة هذا الحجز تحتوي على إشعارات ائتمان معتمدة. الحذف غير ممكن — استخدم الإلغاء بدلاً منه.'
      default:
        return 'لا يمكن حذف هذا الحجز.'
    }
  }

  // ── محتوى المودال ────────────────────────────────────────
  const modalContent = isOpen && checkData ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hard-delete-title"
      className="hd-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="hd-modal" onClick={(e) => e.stopPropagation()}>

        {/* رأس المودال */}
        <div className="hd-header">
          <div className="hd-icon-wrap">
            <ShieldAlert size={20} color="var(--color-danger)" strokeWidth={2} />
          </div>
          <div>
            <h2 id="hard-delete-title" className="hd-title">حذف نهائي للحجز</h2>
            <p className="hd-subtitle">
              هذا الإجراء غير قابل للتراجع — الحجز سيُحذف نهائياً، والفاتورة ستُشطب مع حفظ السبب.
            </p>
          </div>
        </div>

        {/* تحذير الحجز المحجوب */}
        {checkData.isBlocked && (
          <div className="hd-alert hd-alert-error">
            <XCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{blockMessage(checkData)}</span>
          </div>
        )}

        {/* تحذير التقييم */}
        {checkData.hasRating && !checkData.isBlocked && (
          <div className="hd-alert hd-alert-warning">
            <Star size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              هذا الحجز عليه تقييم
              {checkData.ratingValue ? ` (${checkData.ratingValue}/5 نجوم)` : ''}
              {' '}— سيُحذف تلقائياً مع الحجز نهائياً.
            </span>
          </div>
        )}

        {/* نموذج */}
        {!checkData.isBlocked && (
          <>
            <div className="hd-field">
              <label htmlFor={`hd-reason-${bookingId}`} className="hd-label">
                سبب الحذف <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                id={`hd-reason-${bookingId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبباً واضحاً للحذف النهائي..."
                required
                rows={3}
                className="input"
                style={{ resize: 'vertical', minHeight: '80px', width: '100%' }}
                disabled={submitting}
              />
            </div>

            <fieldset className="hd-fieldset">
              <legend className="hd-legend">مصير الفترة بعد الحذف</legend>
              <div className="hd-radio-group">
                <label className="hd-radio-label">
                  <input
                    type="radio"
                    name={`slot-fate-${bookingId}`}
                    checked={blockSlot}
                    onChange={() => setBlockSlot(true)}
                    disabled={submitting}
                    style={{ accentColor: 'var(--color-danger)', width: 16, height: 16 }}
                  />
                  <span className="hd-radio-text">
                    <span>🔴</span>
                    <strong>احجز الفترة</strong>
                    <span className="hd-muted">(الافتراضي) — تُضاف لـ blocked_slots</span>
                  </span>
                </label>
                <label className="hd-radio-label">
                  <input
                    type="radio"
                    name={`slot-fate-${bookingId}`}
                    checked={!blockSlot}
                    onChange={() => setBlockSlot(false)}
                    disabled={submitting}
                    style={{ accentColor: 'var(--color-lime)', width: 16, height: 16 }}
                  />
                  <span className="hd-radio-text">
                    <span>🟢</span>
                    <strong>أتح الفترة</strong>
                    <span className="hd-muted">— تُفتح للحجز مجدداً فوراً</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="hd-alert hd-alert-subtle">
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>بعد التأكيد: الحجز يُحذف نهائياً بدون رجعة. الفاتورة تُشطب مع حفظ السبب وبيانات الحجز.</span>
            </div>
          </>
        )}

        {/* خطأ */}
        {apiError && (
          <div className="hd-alert hd-alert-error" style={{ marginBottom: 'var(--space-3)' }}>
            <XCircle size={14} /><span>{apiError}</span>
          </div>
        )}

        {/* تحذير نجاح */}
        {warning && (
          <div className="hd-alert hd-alert-warning" style={{ marginBottom: 'var(--space-3)' }}>
            <span>{warning} — جارٍ التوجيه...</span>
          </div>
        )}

        {/* أزرار */}
        <div className="hd-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting} style={{ minWidth: 90 }}>
            إلغاء
          </button>
          {!checkData.isBlocked && (
            <button
              id={`btn-confirm-hard-delete-${bookingId}`}
              type="button"
              className="btn btn-danger"
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', opacity: !reason.trim() ? 0.5 : 1 }}
            >
              {submitting
                ? <><Loader2 size={14} style={{ animation: 'hd-rotate 0.9s linear infinite' }} /> جارٍ الحذف...</>
                : <><Trash2 size={14} /> تأكيد الحذف</>}
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {/* زر الحذف */}
      <button
        id={`btn-hard-delete-${bookingId}`}
        type="button"
        className="btn btn-danger btn-full"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', opacity: btnLoading ? 0.75 : 1 }}
        onClick={handleOpen}
        disabled={btnLoading}
        aria-label="حذف نهائي للحجز"
      >
        {btnLoading
          ? <Loader2 size={15} style={{ animation: 'hd-rotate 0.9s linear infinite' }} />
          : <Trash2 size={15} strokeWidth={2} />}
        {btnLoading ? 'جارٍ الفحص...' : 'حذف نهائي للحجز'}
      </button>

      {/* خطأ خارج المودال */}
      {apiError && !isOpen && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <XCircle size={12} /> {apiError}
        </p>
      )}

      {/* ✅ Portal: يركّب المودال في document.body مباشرةً
          → position:fixed يتموضع بالنسبة للـ viewport لا لـ .card
          → لا يتأثر بـ .card:hover { transform: translateY(-1px) }
          → mounted guard يمنع SSR hydration mismatch */}
      {mounted && createPortal(
        <>
          {modalContent}
          <style>{`
            .hd-backdrop {
              position: fixed;
              inset: 0;
              z-index: 9999;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(0,0,0,0.55);
              backdrop-filter: blur(3px);
              padding: 1rem;
              animation: hd-fade-in 0.15s ease both;
            }
            .hd-modal {
              position: relative;
              background: var(--bg-card, #1a1a2e);
              border: 1px solid rgba(224,85,85,.3);
              border-radius: var(--radius-lg, 12px);
              width: 100%;
              max-width: 480px;
              max-height: 90vh;
              overflow-y: auto;
              padding: var(--space-6, 24px);
              box-shadow: 0 24px 64px rgba(0,0,0,.5);
              animation: hd-slide-up 0.22s cubic-bezier(0.22,1,0.36,1) both;
              transform: none;
            }
            .hd-header   { display:flex; align-items:flex-start; gap:var(--space-3,12px); margin-bottom:var(--space-4,16px); }
            .hd-icon-wrap{ width:40px; height:40px; border-radius:50%; background:rgba(224,85,85,.12); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
            .hd-title    { margin:0; font-size:var(--text-lg,1.125rem); font-weight:var(--font-bold,700); color:var(--color-danger,#e05555); }
            .hd-subtitle { margin:4px 0 0; font-size:var(--text-sm,.875rem); color:var(--text-muted); line-height:1.55; }
            .hd-alert    { display:flex; align-items:flex-start; gap:var(--space-2,8px); border-radius:var(--radius-md,8px); padding:var(--space-3,12px) var(--space-4,16px); margin-bottom:var(--space-4,16px); font-size:var(--text-sm,.875rem); line-height:1.55; }
            .hd-alert-error   { background:rgba(224,85,85,.08);  border:1px solid rgba(224,85,85,.28);  color:var(--text-primary); }
            .hd-alert-warning { background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.28); color:var(--text-primary); }
            .hd-alert-subtle  { background:rgba(224,85,85,.05);  border:1px solid rgba(224,85,85,.18);  color:var(--text-muted); font-size:var(--text-xs,.75rem); }
            .hd-field   { margin-bottom:var(--space-4,16px); }
            .hd-label   { display:block; font-size:var(--text-sm,.875rem); font-weight:var(--font-medium,500); color:var(--text-primary); margin-bottom:var(--space-2,8px); }
            .hd-fieldset{ border:none; padding:0; margin:0 0 var(--space-4,16px); }
            .hd-legend  { font-size:var(--text-sm,.875rem); font-weight:var(--font-medium,500); color:var(--text-primary); margin-bottom:var(--space-2,8px); }
            .hd-radio-group { display:flex; flex-direction:column; gap:var(--space-2,8px); }
            .hd-radio-label { display:flex; align-items:center; gap:var(--space-2,8px); cursor:pointer; font-size:var(--text-sm,.875rem); }
            .hd-radio-text  { display:flex; align-items:center; gap:var(--space-1,4px); flex-wrap:wrap; }
            .hd-muted   { color:var(--text-muted); }
            .hd-actions { display:flex; gap:var(--space-3,12px); justify-content:flex-end; margin-top:var(--space-2,8px); }
            @keyframes hd-fade-in  { from{opacity:0}       to{opacity:1} }
            @keyframes hd-slide-up { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
            @keyframes hd-rotate   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          `}</style>
        </>,
        document.body
      )}
    </>
  )
}
