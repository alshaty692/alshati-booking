// ============================================================
// src/lib/commissions.ts — دالة حساب العمولة المقترحة
// ============================================================

export interface CommissionProfile {
  commission_type:  'percentage' | 'fixed_per_booking' | 'none'
  commission_value: number
}

/**
 * يحسب المبلغ المقترح للعمولة بناءً على ملف التعويض وقيمة الحجز.
 * هذا مجرد اقتراح — القيمة النهائية المحفوظة هي ما يدخله المستخدم.
 *
 * @param profile  ملف تعويض الموظف (commission_type + commission_value)
 * @param bookingAmount  قيمة الحجز النهائية بالريال
 * @returns المبلغ المقترح (مُقرَّب لأقرب هللتين)
 */
export function calculateSuggestedCommission(
  profile: CommissionProfile,
  bookingAmount: number
): number {
  if (profile.commission_type === 'percentage') {
    return Math.round((bookingAmount * profile.commission_value / 100) * 100) / 100
  }
  if (profile.commission_type === 'fixed_per_booking') {
    return profile.commission_value
  }
  return 0  // 'none'
}
