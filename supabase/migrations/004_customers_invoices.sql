-- ============================================================
-- 004_customers_invoices.sql  (v2 — تتجاوز trg_sync_customer_stats بأمان)
-- ربط العملاء + نظام الفواتير
-- ============================================================

BEGIN;

-- ============================================================
-- القسم ١: دالة توليد customer_code
-- (تُنشأ أولاً — تحتاجها الدالتان التاليتان)
-- ============================================================

CREATE OR REPLACE FUNCTION next_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  last_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(customer_code, '-', 2) AS INT)
  ), 0)
  INTO last_seq
  FROM customers
  WHERE customer_code LIKE 'CUST-%';

  RETURN 'CUST-' || LPAD((last_seq + 1)::TEXT, 4, '0');
END;
$$;


-- ============================================================
-- القسم ٢: BEFORE INSERT trigger على customers
-- يُولّد customer_code تلقائياً إذا كان NULL
-- يحمي من sync_customer_stats وأي مصدر insert آخر الآن ومستقبلاً
-- ============================================================

CREATE OR REPLACE FUNCTION auto_assign_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := next_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_customer_code ON customers;
CREATE TRIGGER trg_auto_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_customer_code();


-- ============================================================
-- القسم ٣: إضافة customer_code وbackfill للعملاء الموجودين
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

-- Backfill تسلسلي حسب created_at
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM customers
  WHERE customer_code IS NULL
)
UPDATE customers c
SET customer_code = 'CUST-' || LPAD(r.rn::TEXT, 4, '0')
FROM ranked r
WHERE c.id = r.id;


-- ============================================================
-- القسم ٤: تعطيل trg_sync_customer_stats مؤقتاً
-- لمنع أي INSERT على customers أثناء SET NOT NULL
-- ============================================================

ALTER TABLE bookings DISABLE TRIGGER trg_sync_customer_stats;


-- ============================================================
-- القسم ٥: جعل customer_code إلزامياً + UNIQUE
-- الآن آمن: الـ trigger معطّل ولا INSERT يحصل على customers
-- ============================================================

ALTER TABLE customers
  ALTER COLUMN customer_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_customer_code_unique'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_customer_code_unique UNIQUE (customer_code);
  END IF;
END $$;


-- ============================================================
-- القسم ٦: إعادة تفعيل trg_sync_customer_stats
-- الآن trg_auto_customer_code يحمي من أي insert بدون كود
-- ============================================================

ALTER TABLE bookings ENABLE TRIGGER trg_sync_customer_stats;


-- ============================================================
-- القسم ٧: إضافة customer_id لجدول الحجوزات + Backfill
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

UPDATE bookings b
SET customer_id = c.id
FROM customers c
WHERE b.customer_phone = c.phone
  AND b.customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id
  ON bookings(customer_id)
  WHERE customer_id IS NOT NULL;


-- ============================================================
-- القسم ٨: جدول الفواتير (invoices)
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number      TEXT        UNIQUE NOT NULL,

  customer_id         UUID        NOT NULL REFERENCES customers(id),
  booking_id          UUID        REFERENCES bookings(id) ON DELETE RESTRICT,
  batch_id            TEXT,

  court_amount        NUMERIC     NOT NULL DEFAULT 0,
  base_price          NUMERIC     NOT NULL DEFAULT 0,
  discount_amount     NUMERIC     NOT NULL DEFAULT 0,
  discount_code       TEXT,
  discount_percentage NUMERIC     NOT NULL DEFAULT 0,
  water_quantity      INT         NOT NULL DEFAULT 0,
  water_unit_price    NUMERIC     NOT NULL DEFAULT 0,
  water_total         NUMERIC     NOT NULL DEFAULT 0,
  total_amount        NUMERIC     NOT NULL,

  status              TEXT        NOT NULL DEFAULT 'issued'
                                  CHECK (status IN ('issued', 'cancelled')),
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,

  CONSTRAINT invoices_must_have_target
    CHECK (booking_id IS NOT NULL OR batch_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer  ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking   ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_batch     ON invoices(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number    ON invoices(invoice_number);


-- ============================================================
-- القسم ٩: دالة توليد رقم الفاتورة
-- ============================================================

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT := to_char(NOW(), 'YYYY');
  last_seq     INT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(invoice_number, '-', 3) AS INT)
  ), 0)
  INTO last_seq
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';

  RETURN 'INV-' || current_year || '-' || LPAD((last_seq + 1)::TEXT, 4, '0');
END;
$$;


-- ============================================================
-- القسم ١٠: RLS لجدول الفواتير
-- ============================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_service_role_all" ON invoices;
CREATE POLICY "invoices_service_role_all" ON invoices
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


COMMIT;

-- ============================================================
-- tمت المهاجرة بنجاح
-- trg_auto_customer_code يحمي customers من أي insert بدون customer_code
-- الفواتير تنشأ فقط للحجوزات الجديدة من لحظة التفعيل
-- ============================================================
