'use client'
// ============================================================
// WaterSelector — قسم اختيار كراتين المياه (خطوة 1)
// مستخرج من book/page.tsx
// Props:
//   quantity  — booking.water_quantity من الأب (source of truth)
//   onChange  — دالة تُحدّث booking.water_quantity في الأب مباشرة
//   settings  — لقراءة water_price_per_carton / water_stock_available / water_max_cartons
// لا يوجد state داخلي — quantity مصدره الأب دائماً
// ============================================================
import { Droplets, Minus, Plus } from 'lucide-react'
import { formatAmount } from '@/lib/utils'

interface WaterSelectorProps {
  quantity: number
  onChange: (newQty: number) => void
  settings: Record<string, string>
}

export default function WaterSelector({ quantity, onChange, settings }: WaterSelectorProps) {
  const waterPrice      = Number(settings.water_price_per_carton) || 20
  const waterStock      = Number(settings.water_stock_available ?? '999')
  // fallback صفر (لا 10 عشوائي) — إذا لم تصل settings بعد يبقى + معطَّلاً حتى تكتمل
  const waterMaxSetting = settings.water_max_cartons !== undefined
    ? (Number(settings.water_max_cartons) || 0)
    : 0
  const waterMax        = waterStock > 0 ? Math.min(waterMaxSetting, waterStock) : 0
  const waterTotal      = quantity * waterPrice

  return (
    <div className="form-group">
      <label>
        <Droplets size={14} strokeWidth={2} />
        كراتين مياه 💧 (اختياري)
      </label>
      {waterStock <= 0 ? (
        <p className="water-unavailable">المياه غير متوفرة حالياً</p>
      ) : (
        <>
          <p className="water-hint">
            كل كرتون {formatAmount(waterPrice)}
            {waterStock <= 10 && (
              <span className="water-low"> (متبقي {waterStock} كرتون)</span>
            )}
          </p>
          <div className="water-counter">
            <button
              type="button"
              className="water-btn"
              disabled={quantity <= 0}
              onClick={() => onChange(Math.max(0, quantity - 1))}
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <span className="water-qty">{quantity}</span>
            <button
              type="button"
              className="water-btn"
              disabled={quantity >= waterMax}
              onClick={() => onChange(Math.min(waterMax, quantity + 1))}
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
            {quantity > 0 && (
              <span className="water-total">= {formatAmount(waterTotal)}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
