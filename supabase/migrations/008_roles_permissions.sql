-- ============================================================
-- Migration 008: نظام الصلاحيات الديناميكي — المرحلة ١ من ٤
-- الجداول الجديدة : roles, role_permissions
-- تعديل admin_users: إضافة role_id + username + display_name
--                     + is_active + created_by
-- ============================================================
-- ⚠️  عمود role القديم يبقى دون أي مساس — الكود الحالي (14
--     ملف API + types + UI) يقرأ منه مباشرة. الانتقال الفعلي
--     للكود يصير بالمرحلة ٢ — صفر تعديل على أي .ts في هذا الملف.
--
-- ملاحظة auth_user_id:
--     admin_users.id هو نفسه auth.users.id — المستخدم يُنشأ في
--     Supabase Auth أولاً وَيُدرج UUID-ه كـ PK مباشرةً.
--     لا حاجة لعمود auth_user_id منفصل.
--
-- ✅  قابل للتشغيل مرة أخرى بأمان (idempotent):
--     IF NOT EXISTS على كل جدول وعمود وقيد
--     ON CONFLICT DO NOTHING على كل INSERT
--     CREATE OR REPLACE على كل دالة
--     DROP TRIGGER IF EXISTS قبل كل CREATE TRIGGER
-- ============================================================

-- ============================================================
-- قرارات تصميم واعية موثَّقة
-- ──────────────────────────────────────────────────────────
-- أ) لا عمود allowed في role_permissions — وجود الصف = مسموح،
--    غيابه = ممنوع (مبدأ الرفض الافتراضي).
--    شاشة المصفوفة المرئية (Phase 3):
--      تفعيل خانة  → INSERT INTO role_permissions
--      إطفاء خانة  → DELETE FROM role_permissions
--    هذا يُبقي الجدول نظيفاً ولا يحتاج عمود boolean إضافياً.
--
-- ب) trigger حماية آخر مدير يحرس role_id (العمود الجديد) فقط.
--    عمود role القديم غير محروس وهذا مقبول مؤقتاً:
--      - لا توجد أي واجهة حالية تُعدِّل عمود role مباشرةً.
--      - الحماية الكاملة تتحقق عند إزالة عمود role بالمرحلة ٢
--        حيث يصبح role_id هو المصدر الوحيد.
--
-- ج) مفاتيح وحدة المصروفات (زرع مسبق مقصود):
--    view_expenses / create_expense / approve_expense
--    الأسماء القديمة بوثيقة التصميم (expenses.view/create/approve)
--    تُستبدل بهذه الأسماء الجديدة. لا migration إضافي مستقبلاً.
--    الواجهة تُبنى بالمرحلة ٣ أو ٤.
--
-- د) manage_users (زرع مسبق مقصود):
--    واجهة إدارة المستخدمين تُبنى بالمرحلة ٤.
--    المفتاح يُزرع الآن حتى لا نحتاج migration إضافياً.
--    admin فقط.
-- ============================================================


-- ============================================================
-- القسم ١: جدول الأدوار (roles)
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  label_ar    TEXT        NOT NULL,
  description TEXT,
  is_system   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT roles_pkey        PRIMARY KEY (id),
  CONSTRAINT roles_name_unique UNIQUE      (name)
);

COMMENT ON TABLE  roles            IS 'أدوار النظام — الثلاثة الأساسية (is_system=true) محمية من الحذف';
COMMENT ON COLUMN roles.name       IS 'مفتاح الدور: admin / editor / viewer / أي دور مخصص';
COMMENT ON COLUMN roles.label_ar   IS 'الاسم المعروض بالعربية في الواجهة الإدارية';
COMMENT ON COLUMN roles.is_system  IS 'true = لا يمكن حذف هذا الدور من الواجهة';


-- ============================================================
-- القسم ٢: جدول صلاحيات الأدوار (role_permissions)
-- مصفوفة Roles × Permissions — كل صف = دور يملك صلاحية واحدة
-- راجع قرار التصميم (أ) في رأس الملف حول غياب عمود allowed
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  role_id        UUID        NOT NULL,
  permission_key TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT role_permissions_pkey   PRIMARY KEY (id),
  CONSTRAINT role_permissions_fk     FOREIGN KEY (role_id)
                                     REFERENCES  roles(id)
                                     ON DELETE CASCADE,
  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_key)
);

COMMENT ON TABLE  role_permissions                IS 'مصفوفة الصلاحيات — كل صف يمنح دوراً صلاحية واحدة. وجود الصف=مسموح، غيابه=ممنوع';
COMMENT ON COLUMN role_permissions.permission_key IS 'مفتاح الصلاحية — راجع القسم ٥ للقائمة الكاملة والجدول المرجعي';

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
  ON role_permissions (role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_key
  ON role_permissions (permission_key);


-- ============================================================
-- القسم ٣: إضافة الأعمدة الجديدة إلى admin_users
-- ──────────────────────────────────────────────────────────
-- كل عمود في بلوك DO مستقل — idempotent بالكامل.
-- القيود الفريدة تُفحص منفصلة عن الأعمدة (ثغرة idempotency
-- مُعالَجة: لو العمود موجود من تشغيل جزئي سابق والقيد لا،
-- يُضاف القيد في الفحص المستقل دون إعادة إنشاء العمود).
-- عمود role القديم لا يُعدَّل ولا يُحذف (راجع قرار ب في الرأس).
-- تأكيد: admin_users.id = auth.users.id — لا حاجة لعمود منفصل.
-- ============================================================


-- ٣.١ role_id — FK إلى roles.id (عمود النظام الجديد)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'admin_users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE admin_users
      ADD COLUMN role_id UUID
        REFERENCES roles(id) ON DELETE SET NULL;
    COMMENT ON COLUMN admin_users.role_id IS
      'FK → roles.id (نظام الصلاحيات الجديد) — role القديم يبقى للكود الحالي حتى المرحلة ٢';
  END IF;
END $$;


-- ٣.٢ username — اسم مستخدم فريد
-- فحص العمود منفصل عن فحص القيد لضمان idempotency الكاملة
DO $$
BEGIN
  -- أ) إضافة العمود لو غائب
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'admin_users' AND column_name = 'username'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN username TEXT;
    COMMENT ON COLUMN admin_users.username IS
      'اسم مستخدم فريد — nullable للمستخدمين القدامى حتى يُحدَّث يدوياً';
  END IF;

  -- ب) إضافة القيد الفريد لو غائب (مستقل عن أ)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_name       = 'admin_users'
      AND  constraint_name  = 'admin_users_username_unique'
      AND  constraint_type  = 'UNIQUE'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_username_unique UNIQUE (username);
  END IF;
END $$;


-- ٣.٣ display_name — الاسم المعروض في الواجهة الجديدة
-- مستقل عن full_name القديم (محفوظ للتوافق مع الكود الحالي)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'admin_users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN display_name TEXT;
    COMMENT ON COLUMN admin_users.display_name IS
      'الاسم المعروض في الواجهة الجديدة — full_name يبقى للتوافق مع الكود الحالي';
  END IF;
END $$;


-- ٣.٤ is_active — تفعيل/تعطيل الحساب بدون حذفه
-- DEFAULT true: كل المستخدمين الحاليين نشطون تلقائياً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'admin_users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE admin_users
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    COMMENT ON COLUMN admin_users.is_active IS
      'false = الحساب معطَّل — لا تسجيل دخول ولا تنفيذ أي عملية. يُحسب في حماية آخر مدير';
  END IF;
END $$;


-- ٣.٥ created_by — من أنشأ هذا الحساب الإداري
-- FK ذاتي ON DELETE SET NULL — المستخدم الأول يبقى NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'admin_users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE admin_users
      ADD COLUMN created_by UUID
        REFERENCES admin_users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN admin_users.created_by IS
      'FK ذاتي → admin_users.id: من أنشأ هذا الحساب — NULL للمستخدم الأول';
  END IF;
END $$;


-- ============================================================
-- القسم ٤: زرع الأدوار الثلاثة الأساسية
-- ============================================================

INSERT INTO roles (name, label_ar, description, is_system)
VALUES
  ('admin',
   'مدير',
   'صلاحيات كاملة على جميع أقسام النظام بما فيها الإعدادات وإدارة الحسابات',
   true),

  ('editor',
   'محرر',
   'صلاحيات التشغيل اليومي الكاملة — حجوزات وفواتير ومدفوعات — بدون إعدادات أو إغلاق أو إدارة حسابات',
   true),

  ('viewer',
   'مشاهد',
   'قراءة وعرض البيانات فقط — لا تعديل ولا حذف',
   true)
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- القسم ٥: زرع مفاتيح الصلاحيات — 24 مفتاحاً × 3 أدوار
-- ──────────────────────────────────────────────────────────
-- الجدول المرجعي الرسمي:
-- ──────────────────────────────────────────────────────────
--  #   المفتاح               الوصف                              admin  editor  viewer
-- ─────────────────────────────────────────────────────────────────────────────────
--  ── الحجوزات ──────────────────────────────────────────────────────────────────
--  1   view_dashboard        لوحة التحكم والإحصائيات             ✓      ✓       ✓
--  2   view_bookings         عرض وتصفح الحجوزات                  ✓      ✓       ✓
--  3   create_booking        حجز يدوي أو متعدد (batch)           ✓      ✓       ✗
--  4   edit_booking          تعديل تفاصيل وحالة الحجز             ✓      ✓       ✗
--  5   cancel_booking        إلغاء الحجز                         ✓      ✓       ✗
--  6   soft_delete_booking   الحذف الناعم (ملغى/مرفوض/منتهي)    ✓      ✓       ✗
--  7   hard_delete_booking   الحذف النهائي من قاعدة البيانات     ✓      ✗       ✗
--  ── العملاء ───────────────────────────────────────────────────────────────────
--  8   view_customers        عرض بيانات العملاء                  ✓      ✓       ✓
--  9   edit_customer         تعديل بيانات العميل (تصنيف/إيقاف)  ✓      ✓       ✗
--  ── الفواتير والمالية ─────────────────────────────────────────────────────────
-- 10   view_invoices         عرض الفواتير                        ✓      ✓       ✓
-- 11   manage_invoices       إنشاء/تعديل/إلغاء الفواتير          ✓      ✓       ✗
-- 12   manage_payments       إنشاء/تعديل سجلات المدفوعات        ✓      ✓       ✗
-- 13   manage_credit_notes   إنشاء/إلغاء إشعارات الدائن         ✓      ✓       ✗
-- 14   approve_credit_note   اعتماد إشعار الدائن (لا رجعة)      ✓      ✗       ✗
--  ── المصروفات (زرع مسبق — الواجهة تُبنى لاحقاً) ─────────────────────────────
-- 15   view_expenses         عرض المصروفات                       ✓      ✓       ✓
-- 16   create_expense        إنشاء/تعديل مصروف                  ✓      ✓       ✗
-- 17   approve_expense       اعتماد المصروف النهائي              ✓      ✗       ✗
--      ملاحظة: الأسماء القديمة بوثيقة التصميم (expenses.view /
--      expenses.create / expenses.approve) تُستبدل بهذه الأسماء.
--  ── الأكواد والتوافر ──────────────────────────────────────────────────────────
-- 18   manage_codes          إدارة أكواد الخصم                    ✓      ✓       ✗
-- 19   manage_availability   التوافر اليومي (فتح/حظر فترات)      ✓      ✓       ✗
-- 20   manage_closure        الإغلاق الكامل/المجدول للمنشأة      ✓      ✗       ✗
--      ملاحظة الفصل: manage_availability=عمليات يومية يملكها editor،
--      manage_closure=قرار مؤسسي يملكه admin فقط.
--  ── التقارير والتصدير ─────────────────────────────────────────────────────────
-- 21   view_reports          عرض التقارير والإحصائيات            ✓      ✓       ✓
-- 22   export_data           تصدير البيانات (Excel)              ✓      ✓       ✗
--  ── إدارة النظام ──────────────────────────────────────────────────────────────
-- 23   manage_settings       إعدادات النظام العامة               ✓      ✗       ✗
-- 24   manage_users          إدارة حسابات المشرفين وأدوارهم      ✓      ✗       ✗
--      (زرع مسبق مقصود — الواجهة تُبنى بالمرحلة ٤)
-- ──────────────────────────────────────────────────────────
-- الملخص:
--   admin  = 24 صلاحية (الكل)
--   editor = 18 صلاحية (الكل ما عدا: 7,14,17,20,23,24)
--   viewer =  6 صلاحيات (1,2,8,10,15,21)
-- ──────────────────────────────────────────────────────────
-- مبدأ الرفض الافتراضي: أي مفتاح غير موجود = ممنوع تلقائياً.
-- ──────────────────────────────────────────────────────────


-- ── admin: جميع الـ 24 مفتاح ─────────────────────────────

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM   roles r
CROSS  JOIN (VALUES
  -- الحجوزات
  ('view_dashboard'),        --  1
  ('view_bookings'),         --  2
  ('create_booking'),        --  3
  ('edit_booking'),          --  4
  ('cancel_booking'),        --  5
  ('soft_delete_booking'),   --  6
  ('hard_delete_booking'),   --  7 ← admin فقط
  -- العملاء
  ('view_customers'),        --  8
  ('edit_customer'),         --  9
  -- الفواتير والمالية
  ('view_invoices'),         -- 10
  ('manage_invoices'),       -- 11
  ('manage_payments'),       -- 12
  ('manage_credit_notes'),   -- 13
  ('approve_credit_note'),   -- 14 ← admin فقط
  -- المصروفات
  ('view_expenses'),         -- 15
  ('create_expense'),        -- 16
  ('approve_expense'),       -- 17 ← admin فقط
  -- الأكواد والتوافر
  ('manage_codes'),          -- 18
  ('manage_availability'),   -- 19
  ('manage_closure'),        -- 20 ← admin فقط
  -- التقارير
  ('view_reports'),          -- 21
  ('export_data'),           -- 22
  -- إدارة النظام
  ('manage_settings'),       -- 23 ← admin فقط
  ('manage_users')           -- 24 ← admin فقط
) AS p (key)
WHERE  r.name = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;


-- ── editor: 18 مفتاح (بدون: 7,14,17,20,23,24) ──────────

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM   roles r
CROSS  JOIN (VALUES
  -- الحجوزات
  ('view_dashboard'),        --  1
  ('view_bookings'),         --  2
  ('create_booking'),        --  3
  ('edit_booking'),          --  4
  ('cancel_booking'),        --  5
  ('soft_delete_booking'),   --  6  ✓
  -- hard_delete_booking    --  7  ✗ admin فقط
  -- العملاء
  ('view_customers'),        --  8
  ('edit_customer'),         --  9
  -- الفواتير والمالية
  ('view_invoices'),         -- 10
  ('manage_invoices'),       -- 11
  ('manage_payments'),       -- 12
  ('manage_credit_notes'),   -- 13
  -- approve_credit_note    -- 14  ✗ admin فقط
  -- المصروفات
  ('view_expenses'),         -- 15
  ('create_expense'),        -- 16
  -- approve_expense        -- 17  ✗ admin فقط
  -- الأكواد والتوافر
  ('manage_codes'),          -- 18
  ('manage_availability'),   -- 19  ✓ (التوافر اليومي)
  -- manage_closure         -- 20  ✗ admin فقط
  -- التقارير
  ('view_reports'),          -- 21
  ('export_data')            -- 22
  -- manage_settings        -- 23  ✗ admin فقط
  -- manage_users           -- 24  ✗ admin فقط
) AS p (key)
WHERE  r.name = 'editor'
ON CONFLICT (role_id, permission_key) DO NOTHING;


-- ── viewer: 6 مفاتيح (قراءة فقط) ────────────────────────

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM   roles r
CROSS  JOIN (VALUES
  ('view_dashboard'),   --  1
  ('view_bookings'),    --  2
  ('view_customers'),   --  8
  ('view_invoices'),    -- 10
  ('view_expenses'),    -- 15
  ('view_reports')      -- 21
) AS p (key)
WHERE  r.name = 'viewer'
ON CONFLICT (role_id, permission_key) DO NOTHING;


-- ============================================================
-- القسم ٦: ربط admin_users الحاليين بـ role_id تلقائياً
-- مطابقة نصية مباشرة: roles.name = admin_users.role (القديم)
-- يشتغل فقط لمن role_id IS NULL لتجنب التكرار عند الإعادة
-- ============================================================

UPDATE admin_users au
SET    role_id = r.id
FROM   roles r
WHERE  r.name     = au.role
  AND  au.role_id IS NULL;


-- ============================================================
-- القسم ٧: القيمة الافتراضية لـ role_id = viewer
-- استمراراً لسلوك DEFAULT 'viewer' الحالي في عمود role
-- ============================================================

DO $$
DECLARE
  v_viewer_id UUID;
BEGIN
  SELECT id INTO v_viewer_id FROM roles WHERE name = 'viewer';

  IF v_viewer_id IS NULL THEN
    RAISE EXCEPTION 'فشل جلب معرّف دور viewer — تحقق من القسم ٤';
  END IF;

  -- %L::uuid لأن UUID لا يُمرَّر كقيمة ثابتة في DDL مباشرةً
  EXECUTE format(
    'ALTER TABLE admin_users ALTER COLUMN role_id SET DEFAULT %L::uuid',
    v_viewer_id::text
  );
END $$;


-- ============================================================
-- القسم ٨: حماية الأدوار الأساسية من الحذف (is_system)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_system_role_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION
      'الدور "%" دور أساسي (is_system=true) ومحمي من الحذف. '
      'عدّل is_system إلى false أولاً إذا كنت متأكداً تماماً.',
      OLD.name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_system_role_delete ON roles;
CREATE TRIGGER trg_prevent_system_role_delete
  BEFORE DELETE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_role_delete();


-- ============================================================
-- القسم ٩: حماية آخر مدير نشط
-- ──────────────────────────────────────────────────────────
-- السيناريوهات الثلاثة:
--   أ) DELETE             — حذف آخر مدير نشط
--   ب) UPDATE role_id     — تنزيل دور آخر مدير نشط
--   ج) UPDATE is_active   — تعطيل آخر مدير نشط
--
-- "نشط" = role_id = admin_role AND is_active = true
-- المدير الخامل (is_active=false) لا يُحسب في الحماية.
--
-- راجع قرار (ب) في رأس الملف:
--   الحراسة تشمل role_id فقط — عمود role القديم غير محروس
--   لعدم وجود واجهة تُعدِّله. يُعالَج نهائياً بالمرحلة ٢.
--
-- الوضع الحالي (مستخدم واحد — 837146ac...):
--   الـ trigger يمنع حذفه/تنزيله/تعطيله من أول لحظة.
--   للتغيير: أضف مديراً نشطاً آخر أولاً.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_last_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_role_id UUID;
  v_active_admins INT;
BEGIN
  -- جلب معرّف admin ديناميكياً — لا UUID ثابت في الكود
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';

  -- أدوار غير محمَّلة بعد (نادر) → نتجاوز
  IF v_admin_role_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ──────────────────────────────────────────────────────
  -- سيناريو أ: DELETE
  -- ──────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN

    IF OLD.role_id = v_admin_role_id AND OLD.is_active = true THEN
      SELECT COUNT(*) INTO v_active_admins
      FROM   admin_users
      WHERE  role_id   = v_admin_role_id
        AND  is_active = true
        AND  id        != OLD.id;

      IF v_active_admins = 0 THEN
        RAISE EXCEPTION
          'لا يمكن حذف المستخدم "%" — هو المدير النشط الوحيد. '
          'أضف مديراً آخر أو أعِد تفعيل مدير موجود.',
          OLD.id;
      END IF;
    END IF;

    RETURN OLD;

  -- ──────────────────────────────────────────────────────
  -- سيناريوهات ب + ج: UPDATE
  -- ──────────────────────────────────────────────────────
  ELSIF TG_OP = 'UPDATE' THEN

    -- ب) تنزيل الدور: admin نشط → دور آخر
    IF OLD.role_id   = v_admin_role_id
   AND OLD.is_active = true
   AND NEW.role_id   IS DISTINCT FROM v_admin_role_id
    THEN
      SELECT COUNT(*) INTO v_active_admins
      FROM   admin_users
      WHERE  role_id   = v_admin_role_id
        AND  is_active = true
        AND  id        != OLD.id;

      IF v_active_admins = 0 THEN
        RAISE EXCEPTION
          'لا يمكن تغيير دور "%" — هو المدير النشط الوحيد. '
          'أضف مديراً آخر أولاً.',
          OLD.id;
      END IF;
    END IF;

    -- ج) التعطيل: admin نشط → is_active = false
    IF OLD.role_id   = v_admin_role_id
   AND OLD.is_active = true
   AND NEW.is_active = false
    THEN
      SELECT COUNT(*) INTO v_active_admins
      FROM   admin_users
      WHERE  role_id   = v_admin_role_id
        AND  is_active = true
        AND  id        != OLD.id;

      IF v_active_admins = 0 THEN
        RAISE EXCEPTION
          'لا يمكن تعطيل "%" — هو المدير النشط الوحيد. '
          'أضف مديراً نشطاً آخر أولاً.',
          OLD.id;
      END IF;
    END IF;

    -- ملاحظة: تغيير الدور والتعطيل في UPDATE واحد → يُفحص كلا
    -- الشرطين. الاستثناء الأول يُلغي العملية كاملاً.

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON admin_users;
CREATE TRIGGER trg_protect_last_admin
  BEFORE DELETE OR UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION protect_last_admin();


-- ============================================================
-- القسم ١٠: RLS على الجداول الجديدة
-- ──────────────────────────────────────────────────────────
-- مبدأ الرفض الافتراضي (Deny by Default):
--   لا وصول مباشر من العميل (anon/authenticated) بأي شكل.
--   القراءة والتعديل يمران حصراً عبر API routes بـ service_role.
-- ============================================================

ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_service_role_all"              ON roles;
DROP POLICY IF EXISTS "roles_deny_direct_access"            ON roles;
DROP POLICY IF EXISTS "role_permissions_service_role_all"   ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_deny_direct_access" ON role_permissions;

CREATE POLICY "roles_service_role_all" ON roles
  FOR ALL TO service_role
  USING      (true)
  WITH CHECK (true);

CREATE POLICY "role_permissions_service_role_all" ON role_permissions
  FOR ALL TO service_role
  USING      (true)
  WITH CHECK (true);

CREATE POLICY "roles_deny_direct_access" ON roles
  AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false);

CREATE POLICY "role_permissions_deny_direct_access" ON role_permissions
  AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false);


-- ============================================================
-- القسم ١١: تحقق ختامي — تقرير تفصيلي
-- admin=24 / editor=18 / viewer=6
-- ============================================================

DO $$
DECLARE
  v_roles_count        INT;
  v_perm_admin         INT;
  v_perm_editor        INT;
  v_perm_viewer        INT;
  v_linked_users       INT;
  v_unlinked_users     INT;
  v_active_admin_count INT;
  v_admin_role_id      UUID;
  v_default_col        TEXT;
  v_has_username       BOOLEAN;
  v_has_display_name   BOOLEAN;
  v_has_is_active      BOOLEAN;
  v_has_created_by     BOOLEAN;
  v_has_uniq_username  BOOLEAN;
BEGIN
  -- أعمدة admin_users الجديدة
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_users' AND column_name='username')
    INTO v_has_username;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_users' AND column_name='display_name')
    INTO v_has_display_name;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_users' AND column_name='is_active')
    INTO v_has_is_active;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_users' AND column_name='created_by')
    INTO v_has_created_by;
  SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='admin_users'
      AND constraint_name='admin_users_username_unique'
      AND constraint_type='UNIQUE')
    INTO v_has_uniq_username;

  -- الأدوار
  SELECT COUNT(*) INTO v_roles_count FROM roles;

  -- الصلاحيات
  SELECT COUNT(*) INTO v_perm_admin
    FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.name='admin';
  SELECT COUNT(*) INTO v_perm_editor
    FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.name='editor';
  SELECT COUNT(*) INTO v_perm_viewer
    FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.name='viewer';

  -- المستخدمون
  SELECT COUNT(*) INTO v_linked_users   FROM admin_users WHERE role_id IS NOT NULL;
  SELECT COUNT(*) INTO v_unlinked_users FROM admin_users WHERE role_id IS NULL;

  SELECT id INTO v_admin_role_id FROM roles WHERE name='admin';
  SELECT COUNT(*) INTO v_active_admin_count
    FROM admin_users WHERE role_id=v_admin_role_id AND is_active=true;

  SELECT column_default INTO v_default_col
    FROM information_schema.columns
   WHERE table_name='admin_users' AND column_name='role_id';

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '✅  Migration 008 — تقرير التحقق الختامي';
  RAISE NOTICE '───────────────────────────────────────────────';
  RAISE NOTICE '  [admin_users] أعمدة وقيود جديدة:';
  RAISE NOTICE '    role_id              : موجود دائماً';
  RAISE NOTICE '    username             : %', CASE WHEN v_has_username     THEN '✓' ELSE '✗ مفقود' END;
  RAISE NOTICE '    username UNIQUE      : %', CASE WHEN v_has_uniq_username THEN '✓' ELSE '✗ مفقود' END;
  RAISE NOTICE '    display_name         : %', CASE WHEN v_has_display_name THEN '✓' ELSE '✗ مفقود' END;
  RAISE NOTICE '    is_active            : %', CASE WHEN v_has_is_active    THEN '✓' ELSE '✗ مفقود' END;
  RAISE NOTICE '    created_by           : %', CASE WHEN v_has_created_by   THEN '✓' ELSE '✗ مفقود' END;
  RAISE NOTICE '───────────────────────────────────────────────';
  RAISE NOTICE '  [roles]              : % دور', v_roles_count;
  RAISE NOTICE '  [role_permissions]   :';
  RAISE NOTICE '    admin  = % صلاحية  (المتوقع: 24)', v_perm_admin;
  RAISE NOTICE '    editor = % صلاحية  (المتوقع: 18)', v_perm_editor;
  RAISE NOTICE '    viewer = % صلاحية  (المتوقع:  6)', v_perm_viewer;
  RAISE NOTICE '───────────────────────────────────────────────';
  RAISE NOTICE '  [admin_users] مربوطون    : %', v_linked_users;
  RAISE NOTICE '  [admin_users] غير مربوطين: %', v_unlinked_users;
  RAISE NOTICE '  [admin_users] مدراء نشطون: %', v_active_admin_count;
  RAISE NOTICE '  [role_id DEFAULT]         : %', v_default_col;
  RAISE NOTICE '═══════════════════════════════════════════════';

  -- ── تحذيرات الحراسة ──────────────────────────────────
  IF v_active_admin_count = 0 THEN
    RAISE WARNING '⚠️  لا يوجد أي مدير نشط — راجعَ القسمَين ٦ و٣.٤';
  END IF;

  IF v_unlinked_users > 0 THEN
    RAISE WARNING '⚠️  % مستخدم بدون role_id — تحقق من تطابق قيم role القديمة',
                  v_unlinked_users;
  END IF;

  IF v_perm_admin != 24 THEN
    RAISE WARNING '⚠️  صلاحيات admin = % (المتوقع 24)', v_perm_admin;
  END IF;

  IF v_perm_editor != 18 THEN
    RAISE WARNING '⚠️  صلاحيات editor = % (المتوقع 18)', v_perm_editor;
  END IF;

  IF v_perm_viewer != 6 THEN
    RAISE WARNING '⚠️  صلاحيات viewer = % (المتوقع 6)', v_perm_viewer;
  END IF;
END $$;


-- ============================================================
-- ✅ تمت الترقية — يمكن تشغيل هذا الملف مرة أخرى بأمان
-- ============================================================
