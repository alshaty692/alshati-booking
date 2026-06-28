-- ============================================================
-- Migration 006: نظام الدفعات + إشعارات الائتمان
-- يشمل:
--   1. جدول payment_methods (طرق الدفع الديناميكية)
--   2. عمود payment_status في invoices
--   3. جدول payments (الدفعات الجزئية)
--   4. جدول credit_notes (إشعارات الائتمان)
--   5. Function next_credit_note_number()
--   6. Trigger trg_sync_invoice_payment_status
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 0. معالجة جدول payments القديم (إن وُجد بهيكل مختلف)
-- نُعيد تسميته payments_legacy للحفاظ على بياناته
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- هل يوجد جدول payments بدون عمود invoice_id؟ (= الجدول القديم)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'payments'
      AND column_name  = 'invoice_id'
  ) THEN
    -- إعادة التسمية بدل الحذف — البيانات القديمة تُحفظ في payments_legacy
    ALTER TABLE payments RENAME TO payments_legacy;
    RAISE NOTICE 'جدول payments القديم أُعيدت تسميته إلى payments_legacy';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 1. جدول payment_methods — طرق الدفع (ديناميكية بدل Enum)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_methods (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  label_ar    TEXT        NOT NULL,               -- الاسم بالعربي للعرض
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- بيانات أولية — الطرق الثلاث الأساسية
INSERT INTO payment_methods (name, label_ar, is_active, sort_order) VALUES
  ('bank_transfer', 'تحويل بنكي',  TRUE, 1),
  ('cash',          'نقداً',        TRUE, 2),
  ('other',         'أخرى',         TRUE, 3)
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_read_all"
  ON payment_methods FOR SELECT USING (TRUE);   -- قراءة عامة (للفلاتر في الواجهة)

CREATE POLICY "payment_methods_admin_write"
  ON payment_methods FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE payment_methods IS
  'طرق الدفع المتاحة — يمكن إضافة/تعطيل طرق بدون تعديل كود.';


-- ════════════════════════════════════════════════════════════
-- 2. إضافة payment_status إلى invoices
-- ════════════════════════════════════════════════════════════

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_status TEXT
    NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

COMMENT ON COLUMN invoices.payment_status IS
  'حالة الدفع المحسوبة تلقائياً بـ trigger عند كل تغيير في payments أو credit_notes.
   unpaid  = لا يوجد أي دفعة
   partial = دُفع جزء فقط
   paid    = دُفع المبلغ الصافي كاملاً';


-- ════════════════════════════════════════════════════════════
-- 3. جدول payments — الدفعات الجزئية
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID        NOT NULL
                     REFERENCES invoices(id) ON DELETE RESTRICT,
  customer_id      UUID        NOT NULL
                     REFERENCES customers(id) ON DELETE RESTRICT,
  amount           NUMERIC(10,2) NOT NULL
                     CHECK (amount > 0),
  payment_method   TEXT        NOT NULL
                     REFERENCES payment_methods(name) ON DELETE RESTRICT,
  payment_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,                          -- رقم التحويل البنكي أو المرجع
  notes            TEXT,
  recorded_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
  ON payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id
  ON payments (customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_date
  ON payments (payment_date DESC);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_service_role_all"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE payments IS
  'سجل الدفعات المرتبطة بالفواتير — يدعم الدفعات الجزئية المتعددة.';


-- ════════════════════════════════════════════════════════════
-- 4. جدول credit_notes — إشعارات الائتمان
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credit_notes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number  TEXT        NOT NULL UNIQUE,    -- CN-2026-0001
  invoice_id          UUID        NOT NULL
                        REFERENCES invoices(id) ON DELETE RESTRICT,
  customer_id         UUID        NOT NULL
                        REFERENCES customers(id) ON DELETE RESTRICT,
  amount              NUMERIC(10,2) NOT NULL
                        CHECK (amount > 0),
  reason              TEXT        NOT NULL,            -- نص حر، مطلوب
  type                TEXT        NOT NULL
                        CHECK (type IN (
                          'price_adjustment',   -- تعديل سعر
                          'partial_refund',     -- استرداد جزئي
                          'error_correction'    -- تصحيح خطأ
                        )),
  items               TEXT,                            -- JSON أو نص حر للبنود المتأثرة
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'approved', 'cancelled')),
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  cancelled_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id
  ON credit_notes (invoice_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id
  ON credit_notes (customer_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_status
  ON credit_notes (status)
  WHERE status = 'approved';  -- الأكثر استخداماً في حساب الرصيد

-- RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_service_role_all"
  ON credit_notes FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE credit_notes IS
  'إشعارات الائتمان — تُعدّل فاتورة صادرة بدون لمسها مباشرة.
   draft    = منشور، بانتظار اعتماد admin
   approved = معتمد، يُحسب في رصيد الفاتورة
   cancelled = ملغى قبل الاعتماد';

COMMENT ON COLUMN credit_notes.items IS
  'حقل JSON/نص حر يوضح البنود المتأثرة بالإشعار. مرن للتوسع مستقبلاً.';


-- ════════════════════════════════════════════════════════════
-- 5. Function: next_credit_note_number()
-- نفس منطق next_invoice_number() لكن بـ CN بدل INV
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION next_credit_note_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year    TEXT;
  v_seq     INT;
  v_result  TEXT;
BEGIN
  v_year := TO_CHAR(NOW() AT TIME ZONE 'Asia/Riyadh', 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SPLIT_PART(credit_note_number, '-', 3)
        AS INTEGER
      )
    ), 0
  ) + 1
  INTO v_seq
  FROM credit_notes
  WHERE credit_note_number LIKE 'CN-' || v_year || '-%';

  v_result := 'CN-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION next_credit_note_number() IS
  'تُولّد رقم إشعار ائتمان تسلسلي بصيغة CN-YYYY-XXXX.
   تحذير: هذه الدالة ليست thread-safe تماماً عند concurrent calls عالية — مقبول للحجم الحالي.';


-- ════════════════════════════════════════════════════════════
-- 6. Trigger: مزامنة payment_status على invoices
-- منطق بسيط فقط: SUM ومقارنة مباشرة
-- المنطق المعقد يبقى في طبقة التطبيق (lib/payments.ts)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id      UUID;
  v_total_amount    NUMERIC;
  v_approved_cn     NUMERIC;
  v_net_amount      NUMERIC;
  v_paid_amount     NUMERIC;
  v_new_status      TEXT;
BEGIN
  -- تحديد الفاتورة المتأثرة
  IF TG_TABLE_NAME = 'payments' THEN
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  ELSIF TG_TABLE_NAME = 'credit_notes' THEN
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  END IF;

  -- جلب المبلغ الإجمالي للفاتورة
  SELECT total_amount INTO v_total_amount
  FROM invoices
  WHERE id = v_invoice_id AND status = 'issued';

  -- لو الفاتورة ملغاة أو غير موجودة، لا شيء يتغير
  IF v_total_amount IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- مجموع CNs المعتمدة فقط
  SELECT COALESCE(SUM(amount), 0) INTO v_approved_cn
  FROM credit_notes
  WHERE invoice_id = v_invoice_id AND status = 'approved';

  -- الصافي المطلوب = المجموع - الائتمان المعتمد
  v_net_amount := GREATEST(0, v_total_amount - v_approved_cn);

  -- مجموع الدفعات
  SELECT COALESCE(SUM(amount), 0) INTO v_paid_amount
  FROM payments
  WHERE invoice_id = v_invoice_id;

  -- تحديد الحالة
  IF v_paid_amount <= 0 THEN
    v_new_status := 'unpaid';
  ELSIF v_paid_amount >= v_net_amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- تحديث الفاتورة
  UPDATE invoices
  SET payment_status = v_new_status
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger على payments
CREATE TRIGGER trg_sync_payment_status_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_status();

-- Trigger على credit_notes (عند اعتماد أو إلغاء CN)
CREATE TRIGGER trg_sync_payment_status_on_cn
  AFTER INSERT OR UPDATE OF status ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_status();

COMMENT ON FUNCTION sync_invoice_payment_status() IS
  'Trigger بسيط لمزامنة payment_status في invoices.
   يقتصر على: SUM(payments) + SUM(approved CNs) ومقارنة بـ total_amount.
   المنطق المعقد (التحقق من الحد الأقصى، الاسترداد، إلخ) في lib/payments.ts.';
