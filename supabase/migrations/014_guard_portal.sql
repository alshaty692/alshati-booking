-- ============================================================
-- Migration 014: بوابة الحارس — Guard Portal
-- ============================================================
-- التاريخ:  2026-07-09
-- المرجع:   بوابة الحارس — مسار مستقل /guard/*
--
-- ما يفعله هذا الملف:
--   ١. إضافة عمودين جديدين لجدول bookings:
--      - water_delivered_quantity  INT nullable
--      - water_delivered_at        TIMESTAMPTZ nullable
--   ٢. إضافة إعداد guard_portal_pin في جدول settings
--      (القيمة الافتراضية: '1234' — يجب تغييرها من الإعدادات)
--
-- ما لا يمسّه هذا الملف:
--   - water_quantity أو water_price_per_carton (لا تعديل)
--   - أي جدول آخر
--
-- ✅ idempotent: IF NOT EXISTS + ON CONFLICT DO NOTHING
-- ⚠️  يُشغَّل يدوياً في Supabase Dashboard > SQL Editor
-- ============================================================

-- ── ١. إضافة عمود water_delivered_quantity ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'water_delivered_quantity'
  ) THEN
    ALTER TABLE bookings ADD COLUMN water_delivered_quantity INT DEFAULT NULL;
    COMMENT ON COLUMN bookings.water_delivered_quantity IS
      'الكمية الفعلية المسلَّمة من الماء بواسطة الحارس (NULL = لم يُسجَّل بعد)';
  END IF;
END $$;

-- ── ٢. إضافة عمود water_delivered_at ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'water_delivered_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN water_delivered_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN bookings.water_delivered_at IS
      'توقيت تسجيل الحارس للتسليم (NULL = لم يُسلَّم بعد)';
  END IF;
END $$;

-- ── ٣. إضافة إعداد PIN بوابة الحارس ──────────────────────────
INSERT INTO settings (key, value)
VALUES ('guard_portal_pin', '1234')
ON CONFLICT (key) DO NOTHING;

-- ── ٤. تحقق ختامي ────────────────────────────────────────────
DO $$
DECLARE
  col_qty  boolean;
  col_at   boolean;
  pin_row  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'water_delivered_quantity'
  ) INTO col_qty;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'water_delivered_at'
  ) INTO col_at;

  SELECT EXISTS (
    SELECT 1 FROM settings WHERE key = 'guard_portal_pin'
  ) INTO pin_row;

  IF col_qty AND col_at AND pin_row THEN
    RAISE NOTICE '✅ Migration 014 — اكتمل بنجاح: water_delivered_quantity=%,  water_delivered_at=%,  guard_portal_pin=%',
      col_qty, col_at, pin_row;
  ELSE
    RAISE EXCEPTION '❌ Migration 014 — فشل التحقق: qty=%, at=%, pin=%',
      col_qty, col_at, pin_row;
  END IF;
END $$;
