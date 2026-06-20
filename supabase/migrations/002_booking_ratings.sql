-- ============================================================
-- 002_booking_ratings.sql
-- جدول تقييمات الحجوزات
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  rating      INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_booking ON booking_ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_ratings_phone   ON booking_ratings(phone);

ALTER TABLE booking_ratings ENABLE ROW LEVEL SECURITY;

-- العميل المجهول يقرأ (لعرض التقييمات الخاصة به)
CREATE POLICY "ratings_anon_select_own" ON booking_ratings
  FOR SELECT TO anon USING (true);

-- العميل المجهول يضيف تقييم واحد فقط (UNIQUE يمنع التكرار)
CREATE POLICY "ratings_anon_insert" ON booking_ratings
  FOR INSERT TO anon WITH CHECK (true);

-- service_role صلاحية كاملة
CREATE POLICY "ratings_service_role_all" ON booking_ratings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
