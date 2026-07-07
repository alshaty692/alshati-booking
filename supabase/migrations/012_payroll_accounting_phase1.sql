-- ============================================================
-- Migration 012: قسم المحاسبة — المرحلة 1 من 5
-- الجداول: employees, compensation_profiles, salary_payments,
--           bonuses, commissions
-- الصلاحيات: manage_employees, manage_payroll, view_payroll
-- RLS: deny_anon RESTRICTIVE + service_role_all على الجداول الخمسة
-- ============================================================
-- التاريخ:  2026-07-07
-- المرجع:   تعليمات المرحلة 1 — قسم المحاسبة الجديد
--
-- ما يفعله هذا الملف (بالترتيب):
--   ١. إنشاء جدول employees (الفريق الميداني — بدون حساب دخول)
--   ٢. إنشاء جدول compensation_profiles (إعدادات التعويض)
--   ٣. إنشاء جدول salary_payments (سجل رواتب شهرية مصروفة)
--   ٤. إنشاء جدول bonuses (مكافآت لمرة وحدة)
--   ٥. إنشاء جدول commissions (عمولات مرتبطة بحجز/فاتورة)
--   ٦. إضافة 3 مفاتيح صلاحيات جديدة + ربطها بـ admin فقط
--   ٧. تفعيل RLS + سياسات deny_anon + service_role_all
--   ٨. تحقق ختامي
--
-- ما لا يمسّه هذا الملف:
--   - أي trigger لحساب العمولات تلقائياً (نطاق المرحلة 3)
--   - ربط manage_payroll/view_payroll بـ editor أو viewer (قرار معلّق)
--
-- ✅ idempotent: IF NOT EXISTS على كل جدول + ON CONFLICT DO NOTHING
-- ⚠️  لا تنشر على الإنتاج لوحدها — هي أساس للمراحل التالية
-- ⚠️  يُشغَّل يدوياً في Supabase Dashboard > SQL Editor
-- ============================================================


-- ============================================================
-- القسم ١: جدول employees (الفريق الميداني)
-- ============================================================
-- لا حساب دخول — هذا جدول بيانات فقط، مرتبط بـ compensation_profiles
-- عبر beneficiary_type='employee' + beneficiary_id=employees.id
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  full_name  TEXT        NOT NULL,
  position   TEXT,
  phone      TEXT,
  hire_date  DATE,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT employees_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.employees           IS 'الفريق الميداني — بدون حساب دخول. يُربط بـ compensation_profiles عبر beneficiary_type=employee';
COMMENT ON COLUMN public.employees.position  IS 'المسمى الوظيفي (مثال: حارس ملعب، مشرف)';
COMMENT ON COLUMN public.employees.hire_date IS 'تاريخ التوظيف — يُستخدم لحساب الأقدمية والعمولات لاحقاً';
COMMENT ON COLUMN public.employees.is_active IS 'false = موظف غير نشط — يُخفى من الواجهة الافتراضية ولكن يبقى في السجل';


-- ============================================================
-- القسم ٢: جدول compensation_profiles (إعدادات التعويض)
-- ============================================================
-- يربط أي مستفيد (إداري admin_users أو موظف employees) بإعدادات
-- راتبه وعمولاته. لا FK مباشر لعمودين — التحقق عبر منطق التطبيق.
-- UNIQUE(beneficiary_type, beneficiary_id) يمنع ملف مكرر.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compensation_profiles (
  id               UUID         NOT NULL DEFAULT gen_random_uuid(),
  beneficiary_type TEXT         NOT NULL
                     CHECK (beneficiary_type IN ('admin_user', 'employee')),
  beneficiary_id   UUID         NOT NULL,
  base_salary      NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_type  TEXT         NOT NULL DEFAULT 'none'
                     CHECK (commission_type IN ('percentage', 'fixed_per_booking', 'none')),
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT compensation_profiles_pkey   PRIMARY KEY (id),
  CONSTRAINT compensation_profiles_unique UNIQUE (beneficiary_type, beneficiary_id)
);

COMMENT ON TABLE  public.compensation_profiles                 IS 'إعدادات التعويض لكل مستفيد (admin_user أو employee). ملف واحد لكل مستفيد.';
COMMENT ON COLUMN public.compensation_profiles.beneficiary_type IS 'نوع المستفيد: admin_user → admin_users.id | employee → employees.id';
COMMENT ON COLUMN public.compensation_profiles.beneficiary_id   IS 'UUID المستفيد — يشير لـ admin_users.id أو employees.id حسب beneficiary_type';
COMMENT ON COLUMN public.compensation_profiles.commission_type  IS 'none=لا عمولة | percentage=نسبة % من الفاتورة | fixed_per_booking=مبلغ ثابت/حجز';
COMMENT ON COLUMN public.compensation_profiles.commission_value IS 'قيمة العمولة: نسبة (0-100) أو مبلغ ثابت حسب commission_type';

CREATE INDEX IF NOT EXISTS idx_compensation_profiles_beneficiary
  ON public.compensation_profiles (beneficiary_type, beneficiary_id);

-- trigger تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.set_compensation_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compensation_profiles_updated_at
  ON public.compensation_profiles;

CREATE TRIGGER trg_compensation_profiles_updated_at
  BEFORE UPDATE ON public.compensation_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_compensation_profile_updated_at();


-- ============================================================
-- القسم ٣: جدول salary_payments (سجل رواتب شهرية مصروفة)
-- ============================================================
-- UNIQUE(compensation_profile_id, period_month) يمنع صرف راتب
-- مكرر لنفس المستفيد في نفس الشهر — حماية حسابية أساسية.
-- period_month صيغة 'YYYY-MM' (مثال: '2026-07').
-- ============================================================

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id                        UUID         NOT NULL DEFAULT gen_random_uuid(),
  compensation_profile_id   UUID         NOT NULL,
  period_month              TEXT         NOT NULL,
  base_amount               NUMERIC(10,2) NOT NULL,
  commission_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount              NUMERIC(10,2) NOT NULL,
  paid_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  paid_by                   UUID,
  notes                     TEXT,

  CONSTRAINT salary_payments_pkey        PRIMARY KEY (id),
  CONSTRAINT salary_payments_profile_fk  FOREIGN KEY (compensation_profile_id)
                                          REFERENCES public.compensation_profiles(id)
                                          ON DELETE RESTRICT,
  CONSTRAINT salary_payments_unique      UNIQUE (compensation_profile_id, period_month),
  CONSTRAINT salary_payments_period_fmt  CHECK (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE  public.salary_payments              IS 'سجل الرواتب الشهرية المصروفة فعلياً — UNIQUE(profile, month) يمنع الصرف المكرر';
COMMENT ON COLUMN public.salary_payments.period_month IS 'الشهر بصيغة YYYY-MM (مثال: 2026-07). CHECK يُطبَّق بالـ CONSTRAINT أعلاه.';
COMMENT ON COLUMN public.salary_payments.paid_by      IS 'UUID المدير الذي أجرى الصرف — يشير لـ admin_users.id (بدون FK لتجنب CASCADE)';
COMMENT ON COLUMN public.salary_payments.commission_amount IS 'مجموع العمولات المُدرجة في هذا الراتب (من commissions.included_in_salary_payment_id)';
COMMENT ON COLUMN public.salary_payments.bonus_amount      IS 'مجموع المكافآت المُدرجة في هذا الراتب (من bonuses.included_in_salary_payment_id)';

CREATE INDEX IF NOT EXISTS idx_salary_payments_profile
  ON public.salary_payments (compensation_profile_id, period_month);


-- ============================================================
-- القسم ٤: جدول bonuses (مكافآت لمرة وحدة)
-- ============================================================
-- included_in_salary_payment_id: nullable — NULL=مكافأة مستقلة،
-- مملوء=مُدمجة في دورة راتب شهري.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bonuses (
  id                            UUID         NOT NULL DEFAULT gen_random_uuid(),
  compensation_profile_id       UUID         NOT NULL,
  amount                        NUMERIC(10,2) NOT NULL
                                  CHECK (amount > 0),
  reason                        TEXT         NOT NULL,
  granted_at                    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  granted_by                    UUID,
  included_in_salary_payment_id UUID,

  CONSTRAINT bonuses_pkey        PRIMARY KEY (id),
  CONSTRAINT bonuses_profile_fk  FOREIGN KEY (compensation_profile_id)
                                  REFERENCES public.compensation_profiles(id)
                                  ON DELETE RESTRICT,
  CONSTRAINT bonuses_salary_fk   FOREIGN KEY (included_in_salary_payment_id)
                                  REFERENCES public.salary_payments(id)
                                  ON DELETE SET NULL
);

COMMENT ON TABLE  public.bonuses                             IS 'مكافآت استثنائية لمرة وحدة — يمكن دمجها في راتب شهري أو صرفها منفردة';
COMMENT ON COLUMN public.bonuses.granted_by                  IS 'UUID المدير الذي منح المكافأة — يشير لـ admin_users.id';
COMMENT ON COLUMN public.bonuses.included_in_salary_payment_id IS 'NULL=مكافأة مستقلة | UUID=مُدمجة في salary_payments المحدد';

CREATE INDEX IF NOT EXISTS idx_bonuses_profile
  ON public.bonuses (compensation_profile_id);

CREATE INDEX IF NOT EXISTS idx_bonuses_salary_payment
  ON public.bonuses (included_in_salary_payment_id)
  WHERE included_in_salary_payment_id IS NOT NULL;


-- ============================================================
-- القسم ٥: جدول commissions (عمولات مرتبطة بحجز/فاتورة)
-- ============================================================
-- ⚠️ هذا الجدول يُعرِّف البنية فقط — منطق الحساب التلقائي
-- (متى يُنشأ سجل عمولة وكيف) هو نطاق المرحلة 3.
-- لا trigger أو stored procedure حالياً.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commissions (
  id                            UUID         NOT NULL DEFAULT gen_random_uuid(),
  compensation_profile_id       UUID         NOT NULL,
  booking_id                    UUID,
  invoice_id                    UUID,
  amount                        NUMERIC(10,2) NOT NULL
                                  CHECK (amount > 0),
  calculated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
  included_in_salary_payment_id UUID,

  CONSTRAINT commissions_pkey        PRIMARY KEY (id),
  CONSTRAINT commissions_profile_fk  FOREIGN KEY (compensation_profile_id)
                                      REFERENCES public.compensation_profiles(id)
                                      ON DELETE RESTRICT,
  CONSTRAINT commissions_booking_fk  FOREIGN KEY (booking_id)
                                      REFERENCES public.bookings(id)
                                      ON DELETE SET NULL,
  CONSTRAINT commissions_invoice_fk  FOREIGN KEY (invoice_id)
                                      REFERENCES public.invoices(id)
                                      ON DELETE SET NULL,
  CONSTRAINT commissions_salary_fk   FOREIGN KEY (included_in_salary_payment_id)
                                      REFERENCES public.salary_payments(id)
                                      ON DELETE SET NULL
);

COMMENT ON TABLE  public.commissions IS 'عمولات محسوبة فعلياً — مرتبطة بحجز/فاتورة. منطق الحساب التلقائي في المرحلة 3.';
COMMENT ON COLUMN public.commissions.booking_id  IS 'الحجز المُولِّد للعمولة — ON DELETE SET NULL (العمولة تبقى لو حُذف الحجز)';
COMMENT ON COLUMN public.commissions.invoice_id  IS 'الفاتورة المُولِّدة للعمولة — ON DELETE SET NULL';
COMMENT ON COLUMN public.commissions.included_in_salary_payment_id IS 'NULL=عمولة مستقلة | UUID=مُدرجة في دورة راتب';

CREATE INDEX IF NOT EXISTS idx_commissions_profile
  ON public.commissions (compensation_profile_id);

CREATE INDEX IF NOT EXISTS idx_commissions_booking
  ON public.commissions (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_invoice
  ON public.commissions (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_salary_payment
  ON public.commissions (included_in_salary_payment_id)
  WHERE included_in_salary_payment_id IS NOT NULL;


-- ============================================================
-- القسم ٦: صلاحيات قسم المحاسبة
-- ──────────────────────────────────────────────────────────
-- المفاتيح الجديدة (25-27 في جدول المرجع):
-- ──────────────────────────────────────────────────────────
-- 25  manage_employees   إضافة/تعديل الفريق الميداني + ملفات التعويض
-- 26  manage_payroll     تشغيل دورة الرواتب + مكافآت + قواعد العمولة
-- 27  view_payroll       عرض الرواتب والعمولات والمكافآت (قراءة فقط)
-- ──────────────────────────────────────────────────────────
-- توزيع الأدوار:
--   admin  = ✓ (الكل — بما إن admin يملك كل الصلاحيات)
--   editor = ✗ (قرار معلّق — يُضبط لاحقاً من واجهة إدارة الأدوار)
--   viewer = ✗ (قرار معلّق — يُضبط لاحقاً من واجهة إدارة الأدوار)
-- ──────────────────────────────────────────────────────────
-- ✅ idempotent: ON CONFLICT DO NOTHING
-- ⚠️  لا تُعطى لـ editor أو viewer تلقائياً في هذا الملف
-- ============================================================

-- admin فقط — الثلاث صلاحيات

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM   roles r
CROSS  JOIN (VALUES
  ('manage_employees'),  -- 25 ← admin فقط (وربما editor لاحقاً)
  ('manage_payroll'),    -- 26 ← admin فقط
  ('view_payroll')       -- 27 ← admin فقط (وربما viewer لاحقاً)
) AS p (key)
WHERE  r.name = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;


-- ============================================================
-- القسم ٧: RLS — تفعيل + سياسات على الجداول الخمسة
-- ──────────────────────────────────────────────────────────
-- النمط المستخدم:
--   أ) RESTRICTIVE deny_anon: يمنع anonymous تماماً
--   ب) service_role_all: وصول كامل عبر service_role (server-side)
-- ──────────────────────────────────────────────────────────
-- ملاحظة: البيانات المالية حساسة — الوصول فقط عبر service_role
-- (server-side API) وليس مباشرة من browser. الـ API يُطبَّق
-- requirePermission() قبل أي استعلام (manage_payroll/view_payroll).
-- ============================================================


-- ── employees ────────────────────────────────────────────────

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_deny_anon"      ON public.employees;
DROP POLICY IF EXISTS "employees_service_all"    ON public.employees;

CREATE POLICY "employees_deny_anon"
  ON public.employees
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "employees_service_all"
  ON public.employees
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── compensation_profiles ────────────────────────────────────

ALTER TABLE public.compensation_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compensation_profiles_deny_anon"   ON public.compensation_profiles;
DROP POLICY IF EXISTS "compensation_profiles_service_all" ON public.compensation_profiles;

CREATE POLICY "compensation_profiles_deny_anon"
  ON public.compensation_profiles
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "compensation_profiles_service_all"
  ON public.compensation_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── salary_payments ──────────────────────────────────────────

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salary_payments_deny_anon"   ON public.salary_payments;
DROP POLICY IF EXISTS "salary_payments_service_all" ON public.salary_payments;

CREATE POLICY "salary_payments_deny_anon"
  ON public.salary_payments
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "salary_payments_service_all"
  ON public.salary_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── bonuses ──────────────────────────────────────────────────

ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bonuses_deny_anon"   ON public.bonuses;
DROP POLICY IF EXISTS "bonuses_service_all" ON public.bonuses;

CREATE POLICY "bonuses_deny_anon"
  ON public.bonuses
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "bonuses_service_all"
  ON public.bonuses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── commissions ──────────────────────────────────────────────

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_deny_anon"   ON public.commissions;
DROP POLICY IF EXISTS "commissions_service_all" ON public.commissions;

CREATE POLICY "commissions_deny_anon"
  ON public.commissions
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "commissions_service_all"
  ON public.commissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- القسم ٨: تحقق ختامي
-- ============================================================

DO $$
DECLARE
  v_tables_count       INT;
  v_admin_perms_count  INT;
  v_rls_count          INT;
  v_editor_perms       INT;
  v_viewer_perms       INT;
  v_expected_tables    TEXT[] := ARRAY[
    'employees', 'compensation_profiles',
    'salary_payments', 'bonuses', 'commissions'
  ];
  v_new_keys           TEXT[] := ARRAY[
    'manage_employees', 'manage_payroll', 'view_payroll'
  ];
BEGIN

  -- أ: تأكد الجداول الخمسة موجودة
  SELECT COUNT(*) INTO v_tables_count
  FROM   information_schema.tables
  WHERE  table_schema = 'public'
    AND  table_name = ANY(v_expected_tables);

  IF v_tables_count < 5 THEN
    RAISE EXCEPTION 'FAIL: % جدول فقط من 5 — تحقق من أخطاء القسم 1-5', v_tables_count;
  ELSE
    RAISE NOTICE '✓ الجداول الخمسة موجودة: employees, compensation_profiles, salary_payments, bonuses, commissions';
  END IF;

  -- ب: تأكد الصلاحيات الثلاث مربوطة بـ admin فقط
  SELECT COUNT(*) INTO v_admin_perms_count
  FROM   role_permissions rp
  JOIN   roles r ON r.id = rp.role_id
  WHERE  r.name = 'admin'
    AND  rp.permission_key = ANY(v_new_keys);

  IF v_admin_perms_count < 3 THEN
    RAISE EXCEPTION 'FAIL: % صلاحية فقط من 3 مضافة لـ admin', v_admin_perms_count;
  ELSE
    RAISE NOTICE '✓ الصلاحيات الثلاث مضافة لـ admin (admin=28 مفتاحاً بعد migration 009)';
  END IF;

  -- ج: تأكد لا editor ولا viewer يملكها
  SELECT COUNT(*) INTO v_editor_perms
  FROM   role_permissions rp
  JOIN   roles r ON r.id = rp.role_id
  WHERE  r.name = 'editor'
    AND  rp.permission_key = ANY(v_new_keys);

  SELECT COUNT(*) INTO v_viewer_perms
  FROM   role_permissions rp
  JOIN   roles r ON r.id = rp.role_id
  WHERE  r.name = 'viewer'
    AND  rp.permission_key = ANY(v_new_keys);

  IF v_editor_perms > 0 OR v_viewer_perms > 0 THEN
    RAISE WARNING '⚠️ تحذير: editor(%) أو viewer(%) يملكان صلاحيات المحاسبة — هذا غير متوقع', v_editor_perms, v_viewer_perms;
  ELSE
    RAISE NOTICE '✓ editor و viewer لا يملكان صلاحيات المحاسبة (كما هو مطلوب)';
  END IF;

  -- د: تأكد RLS مفعّل على الجداول الخمسة
  SELECT COUNT(*) INTO v_rls_count
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public'
    AND  c.relname = ANY(v_expected_tables)
    AND  c.relrowsecurity = true;

  IF v_rls_count < 5 THEN
    RAISE EXCEPTION 'FAIL: RLS مفعّل على % جدول فقط من 5', v_rls_count;
  ELSE
    RAISE NOTICE '✓ RLS مفعّل على الجداول الخمسة';
  END IF;

  RAISE NOTICE '══ Migration 012 اكتملت بنجاح — المرحلة 1 من 5 لقسم المحاسبة ══';

END $$;


-- ── عرض ختامي: الصلاحيات الجديدة موزَّعة على الأدوار ────────

SELECT
  r.name        AS role_name,
  rp.permission_key,
  r.label_ar
FROM   role_permissions rp
JOIN   roles r ON r.id = rp.role_id
WHERE  rp.permission_key IN ('manage_employees', 'manage_payroll', 'view_payroll')
ORDER  BY r.name, rp.permission_key;
