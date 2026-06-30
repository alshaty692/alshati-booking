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
  const [isOpen,    setIsOpen]    = useState(false)
  const [loading,   setLoading]   = useState(false)   // loading فحص أولي
  const [submitting, setSubmitting] = useState(false)  // loading إرسال
  const [checkData, setCheckData] = useState<PreDeleteCheckResult | null>(null)
  const [reason,    setReason]    = useState('')
  const [blockSlot, setBlockSlot] = useState(true)
  const [apiError,  setApiError]  = useState<string | null>(null)
  const [warning,   setWarning]   = useState<string | null>(null)

  // admin فقط
  if (role !== 'admin') return null

  // ── فتح المودال: جلب pre-delete-check ────────────────────
  const handleOpen = useCallback(async () => {
    setLoading(true)
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
      setLoading(false)
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

  return (
    <>
      {/* ── زر الحذف النهائي ─────────────────────────────── */}
      <button
        id={`btn-hard-delete-${bookingId}`}
        type="button"
        className="btn btn-danger btn-full"
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 'var(--space-2)',
          opacity: loading ? 0.7 : 1,
        }}
        onClick={handleOpen}
        disabled={loading}
        aria-label="حذف نهائي للحجز"
      >
        {loading
          ? <Loader2 size={15} className="animate-spin" />
          : <Trash2 size={15} strokeWidth={2} />
        }
        {loading ? 'جارٍ الفحص...' : 'حذف نهائي للحجز'}
      </button>

      {/* ── Backdrop + Modal ─────────────────────────────── */}
      {isOpen && checkData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-delete-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            padding: '1rem',
            animation: 'fadeIn .15s ease',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(224,85,85,.35)',
              borderRadius: 'var(--radius-lg)',
              width: '100%', maxWidth: '480px',
              maxHeight: '90vh', overflowY: 'auto',
              padding: 'var(--space-6)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
              animation: 'slideUp .2s ease',
            }}
          >
            {/* ── رأس المودال ─────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(224,85,85,.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ShieldAlert size={20} color="var(--color-danger)" strokeWidth={2} />
              </div>
              <div>
                <h2 id="hard-delete-title" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-danger)' }}>
                  حذف نهائي للحجز
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  هذا الإجراء غير قابل للتراجع — الحجز سيُحذف نهائياً، والفاتورة ستُشطب مع حفظ السبب.
                </p>
              </div>
            </div>

            {/* ── تحذير الحجز المحجوب (isBlocked) ────── */}
            {checkData.isBlocked && (
              <div style={{
                background: 'rgba(224,85,85,.08)',
                border: '1px solid rgba(224,85,85,.3)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              }}>
                <XCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {blockMessage(checkData)}
                </p>
              </div>
            )}

            {/* ── تحذير التقييم (T2) ──────────────────── */}
            {checkData.hasRating && !checkData.isBlocked && (
              <div style={{
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(245,158,11,.3)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              }}>
                <Star size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  هذا الحجز عليه تقييم
                  {checkData.ratingValue ? ` (${checkData.ratingValue}/5 نجوم)` : ''}
                  {' '}— سيُحذف تلقائياً مع الحجز نهائياً.
                </p>
              </div>
            )}

            {/* ── نموذج (يظهر فقط لو غير محجوب) ──────── */}
            {!checkData.isBlocked && (
              <>
                {/* حقل السبب */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label
                    htmlFor={`hard-delete-reason-${bookingId}`}
                    style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}
                  >
                    سبب الحذف <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <textarea
                    id={`hard-delete-reason-${bookingId}`}
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
                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
                  <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    مصير الفترة بعد الحذف
                  </legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                      <input
                        type="radio"
                        name={`slot-fate-${bookingId}`}
                        checked={blockSlot}
                        onChange={() => setBlockSlot(true)}
                        disabled={submitting}
                        style={{ accentColor: 'var(--color-danger)', width: 16, height: 16 }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <span style={{ fontSize: '0.85em' }}>🔴</span>
                        <strong>احجز الفترة</strong>
                        <span style={{ color: 'var(--text-muted)' }}>(الافتراضي) — تُضاف لـ blocked_slots ولا يمكن حجزها</span>
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                      <input
                        type="radio"
                        name={`slot-fate-${bookingId}`}
                        checked={!blockSlot}
                        onChange={() => setBlockSlot(false)}
                        disabled={submitting}
                        style={{ accentColor: 'var(--color-lime)', width: 16, height: 16 }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <span style={{ fontSize: '0.85em' }}>🟢</span>
                        <strong>أتح الفترة</strong>
                        <span style={{ color: 'var(--text-muted)' }}>— تُفتح للحجز مجدداً فوراً</span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                {/* تحذير عام */}
                <div style={{
                  background: 'rgba(224,85,85,.06)',
                  border: '1px solid rgba(224,85,85,.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
                }}>
                  <AlertTriangle size={14} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    بعد التأكيد: الحجز يُحذف نهائياً بدون رجعة. الفاتورة تُشطب مع حفظ السبب وبيانات الحجز فيها.
                  </p>
                </div>
              </>
            )}

            {/* ── خطأ API ─────────────────────────────── */}
            {apiError && (
              <div style={{
                background: 'rgba(224,85,85,.1)',
                border: '1px solid rgba(224,85,85,.4)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)', color: 'var(--color-danger)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              }}>
                <XCircle size={14} />
                {apiError}
              </div>
            )}

            {/* ── تحذير (warning بعد النجاح) ──────────── */}
            {warning && (
              <div style={{
                background: 'rgba(245,158,11,.1)',
                border: '1px solid rgba(245,158,11,.3)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
              }}>
                {warning} — جارٍ التوجيه...
              </div>
            )}

            {/* ── أزرار الإجراء ───────────────────────── */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={submitting}
                style={{ minWidth: 90 }}
              >
                إلغاء
              </button>

              {!checkData.isBlocked && (
                <button
                  id={`btn-confirm-hard-delete-${bookingId}`}
                  type="button"
                  className="btn btn-danger"
                  onClick={handleSubmit}
                  disabled={submitting || !reason.trim()}
                  style={{
                    minWidth: 130,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    opacity: !reason.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> جارٍ الحذف...</>
                    : <><Trash2 size={14} /> تأكيد الحذف</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Animations ───────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
