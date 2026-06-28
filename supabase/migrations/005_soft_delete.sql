-- ============================================================
-- Migration 005: Soft Delete للحجوزات
-- يُضيف عمودَي الحذف الناعم على جدول bookings
-- ============================================================

-- ── إضافة عمودَي الحذف الناعم ──────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        DEFAULT NULL;

-- ── فهرس جزئي لتسريع استعلامات "الحجوزات غير المحذوفة" ────
-- (الأكثر شيوعاً: WHERE deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_bookings_not_deleted
  ON bookings (created_at DESC)
  WHERE deleted_at IS NULL;

-- ── تعليق توضيحي ────────────────────────────────────────────
COMMENT ON COLUMN bookings.deleted_at IS
  'وقت الحذف الناعم (Soft Delete). NULL يعني الحجز مرئي وفعّال.';
COMMENT ON COLUMN bookings.deleted_by IS
  'UUID المشرف الذي نفّذ الحذف الناعم (يرجع إلى auth.users).';
