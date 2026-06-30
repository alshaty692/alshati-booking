'use client'
// ============================================================
// HardDeleteModal — مودال الحذف النهائي للحجز
// يظهر فقط للـ admin على الحجوزات (cancelled/rejected/expired)
// ============================================================
import { useState, useCallback } from 'react'
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
  const [isOpen,     setIsOpen]     = useState(false)
  const [fetching,   setFetching]   = useState(false)   // جلب pre-delete-check
  const [submitting, setSubmitting] = useState(false)   // إرسال الحذف
  const [checkData,  setCheckData]  = useState<PreDeleteCheckResult | null>(null)
  const [reason,     setReason]     = useState('')
  const [blockSlot,  setBlockSlot]  = useState(true)
  const [apiError,   setApiError]   = useState<string | null>(null)
  const [warning,    setWarning]    = useState<string | null>(null)

  if (role !== 'admin') return null

  // ── فتح المودال: يفتح فوراً ثم يجلب البيانات داخله ───────
  // هذا يضمن تشغيل animation مرة واحدة فقط عند الفتح
  const handleOpen = useCallback(async () => {
    // 1. افتح المودال فوراً مع spinner داخلي
    setIsOpen(true)
    setFetching(true)
    setCheckData(null)
    setApiError(null)
    setWarning(null)
    setReason('')
    setBlockSlot(true)

    // 2. جلب البيانات بعد الفتح (animation تعمل أثناء الجلب)
    try {
      const res  = await fetch(`/api/admin/bookings/${bookingId}/pre-delete-check`)
      const data = await res.json() as PreDeleteCheckResult
      setCheckData(data)
    } catch {
      setApiError('فشل تحميل بيانات الفحص — حاول مجدداً')
    } finally {
      setFetching(false)
    }
  }, [bookingId])

  // ── إغلاق المودال ────────────────────────────────────────
  const handleClose = () => {
    if (submitting) return
    setIsOpen(false)
    // تنظيف State بعد إغلاق المودال (بدون تأخير)
    setCheckData(null)
    setReason('')
    setApiError(null)
    setWarning(null)
    setFetching(false)
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

  return (
    <>
      {/* ── زر الحذف النهائي ─────────────────────────────── */}
      <button
        id={`btn-hard-delete-${bookingId}`}
        type="button"
        className="btn btn-danger btn-full"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
        onClick={handleOpen}
        aria-label="حذف نهائي للحجز"
      >
        <Trash2 size={15} strokeWidth={2} />
        حذف نهائي للحجز
      </button>

      {/* ── Portal: Backdrop + Modal ─────────────────────── */}
      {/* المودال يُركَّب مرة واحدة عند الفتح — animation تعمل مرة واحدة فقط */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-delete-title"
          className="hd-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="hd-modal">

            {/* ── حالة التحميل (skeleton) ─────────────── */}
            {fetching && (
              <div className="hd-loading-state">
                <div className="hd-spinner-wrap">
                  <Loader2 size={24} className="hd-spin" color="var(--color-lime)" />
                </div>
                <p className="hd-loading-text">جارٍ فحص بيانات الحجز...</p>
              </div>
            )}

            {/* ── المحتوى الفعلي (يظهر بعد اكتمال الجلب) ─ */}
            {!fetching && (
              <>
                {/* رأس المودال */}
                <div className="hd-header">
                  <div className="hd-icon-wrap">
                    <ShieldAlert size={20} color="var(--color-danger)" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 id="hard-delete-title" className="hd-title">
                      حذف نهائي للحجز
                    </h2>
                    <p className="hd-subtitle">
                      هذا الإجراء غير قابل للتراجع — الحجز سيُحذف نهائياً، والفاتورة ستُشطب مع حفظ السبب.
                    </p>
                  </div>
                </div>

                {/* خطأ جلب البيانات */}
                {apiError && !checkData && (
                  <div className="hd-alert hd-alert-error">
                    <XCircle size={15} />
                    <span>{apiError}</span>
                  </div>
                )}

                {checkData && (
                  <>
                    {/* تحذير الحجز المحجوب (isBlocked) */}
                    {checkData.isBlocked && (
                      <div className="hd-alert hd-alert-error">
                        <XCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{blockMessage(checkData)}</span>
                      </div>
                    )}

                    {/* تحذير التقييم (T2) */}
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

                    {/* نموذج (يظهر فقط لو غير محجوب) */}
                    {!checkData.isBlocked && (
                      <>
                        {/* حقل السبب */}
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

                        {/* اختيار مصير الفترة */}
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

                        {/* تحذير عام */}
                        <div className="hd-alert hd-alert-subtle">
                          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>بعد التأكيد: الحجز يُحذف نهائياً بدون رجعة. الفاتورة تُشطب مع حفظ السبب وبيانات الحجز.</span>
                        </div>
                      </>
                    )}

                    {/* خطأ API أثناء الإرسال */}
                    {apiError && checkData && (
                      <div className="hd-alert hd-alert-error">
                        <XCircle size={14} />
                        <span>{apiError}</span>
                      </div>
                    )}

                    {/* تحذير بعد النجاح */}
                    {warning && (
                      <div className="hd-alert hd-alert-warning">
                        <span>{warning} — جارٍ التوجيه...</span>
                      </div>
                    )}
                  </>
                )}

                {/* أزرار الإجراء */}
                <div className="hd-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                    disabled={submitting}
                    style={{ minWidth: 90 }}
                  >
                    إلغاء
                  </button>

                  {checkData && !checkData.isBlocked && (
                    <button
                      id={`btn-confirm-hard-delete-${bookingId}`}
                      type="button"
                      className="btn btn-danger"
                      onClick={handleSubmit}
                      disabled={submitting || !reason.trim()}
                      style={{
                        minWidth: 140,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                        opacity: !reason.trim() ? 0.5 : 1,
                      }}
                    >
                      {submitting
                        ? <><Loader2 size={14} className="hd-spin" /> جارٍ الحذف...</>
                        : <><Trash2 size={14} /> تأكيد الحذف</>
                      }
                    </button>
                  )}

                  {/* زر إغلاق لو محجوب أو خطأ بدون بيانات */}
                  {(!checkData || checkData.isBlocked) && !fetching && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClose}
                      style={{ minWidth: 90 }}
                    >
                      حسناً
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Styles ─────────────────────────────────────────── */}
      <style>{`
        /* Backdrop — animation مرة واحدة فقط عند mount */
        .hd-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(3px);
          padding: 1rem;
          animation: hd-fade-in 0.15s ease both;
        }

        /* Modal card — يتحرك من الأسفل للأعلى مرة واحدة */
        .hd-modal {
          background: var(--bg-card);
          border: 1px solid rgba(224, 85, 85, .3);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: var(--space-6);
          box-shadow: 0 24px 64px rgba(0, 0, 0, .45);
          animation: hd-slide-up 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* حالة التحميل — تظهر بمكان ثابت دون أي layout shift */
        .hd-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          padding: var(--space-8) 0;
          min-height: 160px;
        }

        .hd-spinner-wrap {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(132, 204, 22, .1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hd-loading-text {
          margin: 0;
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        /* رأس المودال */
        .hd-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .hd-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(224, 85, 85, .12);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .hd-title {
          margin: 0;
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          color: var(--color-danger);
        }

        .hd-subtitle {
          margin: 4px 0 0;
          font-size: var(--text-sm);
          color: var(--text-muted);
          line-height: 1.55;
        }

        /* تنبيهات */
        .hd-alert {
          display: flex;
          align-items: flex-start;
          gap: var(--space-2);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
          font-size: var(--text-sm);
          line-height: 1.55;
        }

        .hd-alert-error {
          background: rgba(224, 85, 85, .08);
          border: 1px solid rgba(224, 85, 85, .28);
          color: var(--text-primary);
        }

        .hd-alert-warning {
          background: rgba(245, 158, 11, .08);
          border: 1px solid rgba(245, 158, 11, .28);
          color: var(--text-primary);
        }

        .hd-alert-subtle {
          background: rgba(224, 85, 85, .05);
          border: 1px solid rgba(224, 85, 85, .18);
          color: var(--text-muted);
          font-size: var(--text-xs);
        }

        /* حقل النص */
        .hd-field {
          margin-bottom: var(--space-4);
        }

        .hd-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }

        /* Fieldset */
        .hd-fieldset {
          border: none;
          padding: 0;
          margin: 0 0 var(--space-4);
        }

        .hd-legend {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }

        .hd-radio-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .hd-radio-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          cursor: pointer;
          font-size: var(--text-sm);
        }

        .hd-radio-text {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          flex-wrap: wrap;
        }

        .hd-muted { color: var(--text-muted); }

        /* أزرار */
        .hd-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          margin-top: var(--space-2);
        }

        /* Animations — بدون opacity مزدوج */
        @keyframes hd-fade-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }

        @keyframes hd-slide-up {
          from { transform: translateY(20px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }

        /* Spinner */
        .hd-spin {
          animation: hd-rotate 0.9s linear infinite;
        }

        @keyframes hd-rotate {
          from { transform: rotate(0deg)   }
          to   { transform: rotate(360deg) }
        }
      `}</style>
    </>
  )
}
