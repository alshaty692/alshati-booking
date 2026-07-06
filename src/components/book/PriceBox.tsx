'use client'
// ============================================================
// PriceBox — صندوق عرض السعر والخصم والمياه (خطوة 1)
// مستخرج من book/page.tsx
// مكوّن عرض بحت — لا state ولا منطق داخلي
// Props:
//   price      — booking.price من الأب (PriceCalculation)
//   waterTotal — booking.water_quantity * waterPrice (محسوبة بالأب)
// ============================================================
import { formatAmount } from '@/lib/utils'
import type { PriceCalculation } from '@/types'

interface PriceBoxProps {
  price:      PriceCalculation
  waterTotal: number
}

export default function PriceBox({ price, waterTotal }: PriceBoxProps) {
  return (
    <div className="price-box animate-fade-in">
      <div className="price-row">
        <span>السعر الأصلي</span>
        <span>{formatAmount(price.base_price)}</span>
      </div>
      {price.discount_amount > 0 && (
        <div className="price-row discount">
          <span>الخصم 🎉</span>
          <span>- {formatAmount(price.discount_amount)}</span>
        </div>
      )}
      {waterTotal > 0 && (
        <div className="price-row">
          <span>💧 مياه</span>
          <span>{formatAmount(waterTotal)}</span>
        </div>
      )}
      <div className="price-row total">
        <span>الإجمالي</span>
        <strong>{formatAmount((price.final_price ?? 0) + waterTotal)}</strong>
      </div>
    </div>
  )
}
