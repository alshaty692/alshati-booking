'use client'
// ============================================================
// SuccessStep — خطوة النجاح (step 4) لصفحة الحجز
// مستخرج من book/page.tsx
// Props:
//   date, courtDisplayName, periodDisplay — قيم جاهزة من الأب
//   onReset    — resetBooking() من الأب
//   onMyBookings — router.push('/my-bookings') من الأب
// ============================================================
import { CalendarDays, BookOpen, PartyPopper } from 'lucide-react'

interface SuccessStepProps {
  date:             string   // formatDate(booking.date) — محسوبة بالأب
  courtDisplayName: string   // courtName(booking.court_id) — محسوبة بالأب
  periodDisplay:    string   // getPeriodName(booking.period_number) — محسوبة بالأب
  onReset:          () => void
  onMyBookings:     () => void
}

export default function SuccessStep({
  date,
  courtDisplayName,
  periodDisplay,
  onReset,
  onMyBookings,
}: SuccessStepProps) {
  return (
    <div className="book-step success-step animate-slide-up">
      <div className="success-icon-wrap">
        <PartyPopper size={40} strokeWidth={1.5} />
      </div>
      <h2 className="success-title">تم استلام حجزك!</h2>
      <p className="success-desc">سيتم مراجعة الإيصال وتأكيد الحجز خلال فترة وجيزة</p>
      <div className="review-card" style={{ margin: '1.5rem 0' }}>
        <div className="review-row">
          <span className="review-label">التاريخ</span>
          <span>{date}</span>
        </div>
        <div className="review-row">
          <span className="review-label">الملعب</span>
          <span>{courtDisplayName}</span>
        </div>
        <div className="review-row">
          <span className="review-label">الفترة</span>
          <span>{periodDisplay}</span>
        </div>
      </div>
      <button id="btn-new-booking" className="btn-step-next" onClick={onReset}>
        <CalendarDays size={16} strokeWidth={2} />
        حجز جديد
      </button>
      <button
        id="btn-my-bookings"
        className="btn-step-secondary"
        style={{ marginTop: '0.75rem' }}
        onClick={onMyBookings}
      >
        <BookOpen size={16} strokeWidth={2} />
        عرض حجوزاتي
      </button>
    </div>
  )
}
