-- ============================================================
-- Migration 007: إضافة عمود snapshot للحجز المحذوف نهائياً
-- يُحفظ في الفاتورة قبل حذف الحجز لضمان وضوح السجل المالي
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cancelled_booking_snapshot JSONB;

COMMENT ON COLUMN invoices.cancelled_booking_snapshot IS
  'snapshot لبيانات الحجز المحذوف نهائياً (hard delete).
   يُملأ تلقائياً عند تنفيذ deleteBookingPermanently() في lib/bookings.ts.
   البنية: { booking_date, court_id, period_number, customer_name, customer_phone, base_price, total_amount, invoice_number }
   يبقى فارغاً للفواتير العادية والإلغاءات الناعمة.';
