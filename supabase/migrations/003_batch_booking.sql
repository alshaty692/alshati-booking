-- ============================================================
-- Migration 003 — إضافة batch_id لجدول bookings
-- ============================================================

-- إضافة حقل batch_id (nullable — NULL يعني حجز فردي عادي)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- فهرس لتسريع استعلامات "كل حجوزات الباقة"
CREATE INDEX IF NOT EXISTS idx_bookings_batch_id 
  ON bookings(batch_id) 
  WHERE batch_id IS NOT NULL;

-- فهرس مركّب للبحث السريع بالباقة + الحالة
CREATE INDEX IF NOT EXISTS idx_bookings_batch_status 
  ON bookings(batch_id, status) 
  WHERE batch_id IS NOT NULL;
