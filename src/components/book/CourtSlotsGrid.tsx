'use client'
// ============================================================
// CourtSlotsGrid — شبكة الملاعب والفترات (خطوة 0)
// مستخرج من book/page.tsx
// Props:
//   selectedDate     — booking.date
//   selectedCourt    — booking.court_id
//   selectedPeriod   — booking.period_number
//   slotsForDate     — الفترات المفلترة بالتاريخ (من page.tsx)
//   holdSlot         — تبقى في page.tsx (من الممنوعات)، تُمرَّر كـ prop
//   onSlotSelect     — يُحدّث booking في الأب (court_id + period_number + price:null)
//   onSlotsRefresh   — يُعيد جلب slots عند فشل hold
//   isCourtClosed    — دالة من page.tsx
//   courtName        — دالة من page.tsx
//   basePrice        — دالة من page.tsx
// ============================================================
import { PointerIcon } from 'lucide-react'
import { getPeriodName, formatAmount } from '@/lib/utils'
import type { AvailableSlot } from '@/types'

const COURTS     = ['football', 'volleyball', 'multi'] as const
const COURT_ICONS: Record<string, string> = { football: '⚽', volleyball: '🏐', multi: '🏀🏐' }

interface CourtSlotsGridProps {
  selectedDate:   string
  selectedCourt:  string
  selectedPeriod: number
  slotsForDate:   AvailableSlot[]
  holdSlot:       (courtId: string, date: string, period: number) => Promise<boolean>
  onSlotSelect:   (courtId: string, period: number) => void
  onSlotsRefresh: (slots: AvailableSlot[]) => void
  isCourtClosed:  (courtId: string, date: string) => boolean
  courtName:      (courtId: string) => string
  basePrice:      (courtId: string) => number
}

export default function CourtSlotsGrid({
  selectedDate,
  selectedCourt,
  selectedPeriod,
  slotsForDate,
  holdSlot,
  onSlotSelect,
  onSlotsRefresh,
  isCourtClosed,
  courtName,
  basePrice,
}: CourtSlotsGridProps) {
  if (!selectedDate) {
    return (
      <div className="date-hint">
        <div className="date-hint-icon">
          <PointerIcon size={28} strokeWidth={1.5} />
        </div>
        <p>اختر يوماً أولاً لرؤية المواعيد المتاحة</p>
      </div>
    )
  }

  return (
    <div className="courts-grid animate-fade-in">
      {COURTS.map(courtId => {
        const courtSlots = slotsForDate.filter(s => s.court_id === courtId)
        const closed     = isCourtClosed(courtId, selectedDate)
        return (
          <div key={courtId} className={`court-col ${closed ? 'court-col-closed' : ''}`}>
            {/* عنوان الملعب */}
            <div className="court-col-head">
              <span className="court-col-icon">{COURT_ICONS[courtId]}</span>
              <span className="court-col-name">{courtName(courtId)}</span>
              {!closed && basePrice(courtId) > 0 && (
                <span className="court-col-price">{formatAmount(basePrice(courtId))}</span>
              )}
              {closed && (
                <span className="court-col-closed-tag">موقوف</span>
              )}
            </div>

            {/* الفترات */}
            {closed ? (
              <div className="court-col-unavail">تحت الصيانة</div>
            ) : courtSlots.length === 0 ? (
              <div className="court-col-unavail">لا فترات</div>
            ) : (
              <div className="court-col-periods">
                {[...courtSlots]
                  .sort((a, b) => a.period_number - b.period_number)
                  .map(slot => {
                    const sel    = selectedCourt === courtId && selectedPeriod === slot.period_number
                    const isHeld = (slot as AvailableSlot & { is_held?: boolean }).is_held
                    const status = !slot.is_available
                      ? (isHeld ? 'held' : 'booked')
                      : sel ? 'selected' : 'available'
                    return (
                      <button
                        key={slot.period_number}
                        id={`slot-${courtId}-${slot.period_number}`}
                        className={`court-period-btn court-period-${status}`}
                        disabled={!slot.is_available}
                        onClick={async () => {
                          if (!slot.is_available) return
                          // holdSlot تبقى في page.tsx — نستدعيها كـ prop
                          const ok = await holdSlot(courtId, selectedDate, slot.period_number)
                          if (!ok) {
                            // فشل الـ hold — نُحدّث الفترات ونوقف التقدم
                            const res  = await fetch('/api/booking/slots')
                            const data = await res.json()
                            onSlotsRefresh(data.slots ?? [])
                            return
                          }
                          // نُبلّغ الأب بالاختيار — لا نحتفظ بـ state محلي
                          onSlotSelect(courtId, slot.period_number)
                        }}
                      >
                        <span className="cpb-time">{getPeriodName(slot.period_number)}</span>
                        <span className="cpb-dot" />
                        <span className="cpb-state">
                          {status === 'held'     ? 'قيد الحجز' :
                           status === 'booked'   ? 'محجوز'     :
                           status === 'selected' ? '✓ مختار'   : 'متاح'}
                        </span>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
