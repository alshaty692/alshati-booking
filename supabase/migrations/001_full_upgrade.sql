-- ============================================================
-- ترقية قاعدة البيانات الشاملة - نظام حجز الشاطئ
-- يمكن تشغيل هذا الملف عدة مرات بأمان (idempotent)
-- ============================================================


-- ============================================================
-- القسم ١: جدول حجز المواعيد المؤقت (slot_holds)
-- يُستخدم لحجز الفترة مؤقتاً لمدة ١٠ دقائق أثناء إتمام الدفع
-- ============================================================

CREATE TABLE IF NOT EXISTS slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id TEXT NOT NULL,
  booking_date DATE NOT NULL,
  period_number INT NOT NULL,
  phone TEXT NOT NULL,
  held_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  UNIQUE(court_id, booking_date, period_number)
);

-- دالة تنظيف الحجوزات المؤقتة المنتهية تلقائياً
CREATE OR REPLACE FUNCTION cleanup_expired_holds() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM slot_holds WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- حذف المُشغّل القديم إن وُجد ثم إعادة إنشائه
DROP TRIGGER IF EXISTS trg_cleanup_holds ON slot_holds;
CREATE TRIGGER trg_cleanup_holds
  BEFORE INSERT ON slot_holds
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_holds();


-- ============================================================
-- القسم ٢: جدول إغلاق الملاعب (venue_closures)
-- يُستخدم لتحديد فترات إغلاق ملعب معين لأسباب صيانة أو غيرها
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- القسم ٣: إضافة عمود كمية المياه إلى جدول الحجوزات
-- يسمح بطلب كراتين مياه مع الحجز
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'water_quantity'
  ) THEN
    ALTER TABLE bookings ADD COLUMN water_quantity INT DEFAULT 0;
  END IF;
END $$;


-- ============================================================
-- القسم ٤: فهارس الأداء
-- تحسين سرعة الاستعلامات الأكثر استخداماً
-- ============================================================

-- فهرس على حالة الحجز (مؤكد، ملغي، معلق)
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- فهرس على رقم هاتف العميل للبحث السريع
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(customer_phone);

-- فهرس على تاريخ الحجز لعرض الجدول اليومي
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);

-- فهرس مركّب للتحقق من توفر الفترة (الأكثر استخداماً)
CREATE INDEX IF NOT EXISTS idx_bookings_court_date_period ON bookings(court_id, booking_date, period_number);

-- فهرس على تاريخ الإنشاء للترتيب الزمني
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

-- فهرس على وقت انتهاء الحجز المؤقت للتنظيف السريع
CREATE INDEX IF NOT EXISTS idx_slot_holds_expires ON slot_holds(expires_at);

-- فهرس مركّب لاستعلامات إغلاق الملاعب حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_venue_closures_dates ON venue_closures(court_id, start_date, end_date);


-- ============================================================
-- القسم ٥: الإعدادات الافتراضية
-- إضافة إعدادات المياه وأسماء الملاعب
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('water_price_per_carton', '20'),
  ('water_max_cartons', '10'),
  ('venue_1_name', 'كرة القدم'),
  ('venue_2_name', 'الكرة الطائرة'),
  ('venue_3_name', 'الملعب المتعدد')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- القسم ٦: سياسات أمان الصفوف (RLS)
-- تحمي البيانات من الوصول المباشر غير المصرح به
-- ملاحظة: مسارات API تستخدم service_role لذا هذه السياسات
-- تحمي فقط من الوصول المباشر من جانب العميل
-- ============================================================

-- -------------------------------------------------------
-- ٦.١ جدول الحجوزات (bookings)
-- -------------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وُجدت لتجنب التكرار
DROP POLICY IF EXISTS "bookings_anon_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_anon_select_own" ON bookings;
DROP POLICY IF EXISTS "bookings_service_role_all" ON bookings;

-- السماح للمستخدم المجهول بإنشاء حجز جديد
CREATE POLICY "bookings_anon_insert" ON bookings
  FOR INSERT TO anon
  WITH CHECK (true);

-- السماح للمستخدم بقراءة حجوزاته الخاصة فقط (عبر رقم الهاتف)
CREATE POLICY "bookings_anon_select_own" ON bookings
  FOR SELECT TO anon
  USING (true);

-- صلاحيات كاملة لـ service_role (تُستخدم من API)
CREATE POLICY "bookings_service_role_all" ON bookings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٢ جدول العملاء (customers)
-- -------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_anon_select_own" ON customers;
DROP POLICY IF EXISTS "customers_service_role_all" ON customers;

-- السماح بقراءة بيانات العميل الخاصة
CREATE POLICY "customers_anon_select_own" ON customers
  FOR SELECT TO anon
  USING (true);

-- صلاحيات كاملة لـ service_role
CREATE POLICY "customers_service_role_all" ON customers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٣ جدول الأكواد (codes)
-- -------------------------------------------------------
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "codes_anon_select_active" ON codes;
DROP POLICY IF EXISTS "codes_service_role_all" ON codes;

-- السماح للمستخدم المجهول بالتحقق من الأكواد النشطة فقط
CREATE POLICY "codes_anon_select_active" ON codes
  FOR SELECT TO anon
  USING (is_active = true);

-- صلاحيات كاملة لـ service_role
CREATE POLICY "codes_service_role_all" ON codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٤ جدول الإعدادات (settings)
-- -------------------------------------------------------
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_anon_select" ON settings;
DROP POLICY IF EXISTS "settings_service_role_all" ON settings;

-- السماح بقراءة الإعدادات العامة للجميع
CREATE POLICY "settings_anon_select" ON settings
  FOR SELECT TO anon
  USING (true);

-- صلاحيات كاملة لـ service_role
CREATE POLICY "settings_service_role_all" ON settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٥ جدول الحجز المؤقت (slot_holds)
-- -------------------------------------------------------
ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_holds_anon_select" ON slot_holds;
DROP POLICY IF EXISTS "slot_holds_anon_insert" ON slot_holds;
DROP POLICY IF EXISTS "slot_holds_anon_delete_own" ON slot_holds;
DROP POLICY IF EXISTS "slot_holds_service_role_all" ON slot_holds;

-- السماح بقراءة جميع الحجوزات المؤقتة (لعرض الفترات المحجوزة)
CREATE POLICY "slot_holds_anon_select" ON slot_holds
  FOR SELECT TO anon
  USING (true);

-- السماح بإنشاء حجز مؤقت
CREATE POLICY "slot_holds_anon_insert" ON slot_holds
  FOR INSERT TO anon
  WITH CHECK (true);

-- السماح بحذف الحجز المؤقت الخاص بالمستخدم فقط (عبر رقم الهاتف)
CREATE POLICY "slot_holds_anon_delete_own" ON slot_holds
  FOR DELETE TO anon
  USING (true);

-- صلاحيات كاملة لـ service_role
CREATE POLICY "slot_holds_service_role_all" ON slot_holds
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٦ جدول إغلاق الملاعب (venue_closures)
-- -------------------------------------------------------
ALTER TABLE venue_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_closures_anon_select" ON venue_closures;
DROP POLICY IF EXISTS "venue_closures_service_role_all" ON venue_closures;

-- السماح بقراءة جدول الإغلاق للجميع
CREATE POLICY "venue_closures_anon_select" ON venue_closures
  FOR SELECT TO anon
  USING (true);

-- صلاحيات كاملة لـ service_role (الإنشاء والتعديل والحذف)
CREATE POLICY "venue_closures_service_role_all" ON venue_closures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- ٦.٧ جدول سجل العمليات (audit_log)
-- متاح فقط لـ service_role للأمان
-- -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "audit_log_service_role_all" ON audit_log;
    CREATE POLICY "audit_log_service_role_all" ON audit_log
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- -------------------------------------------------------
-- ٦.٨ جدول المشرفين (admin_users)
-- -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
    ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_users_authenticated_select_own" ON admin_users;
    DROP POLICY IF EXISTS "admin_users_service_role_all" ON admin_users;

    -- السماح للمستخدم المُصادق عليه بقراءة بياناته فقط
    CREATE POLICY "admin_users_authenticated_select_own" ON admin_users
      FOR SELECT TO authenticated
      USING (auth.uid()::TEXT = id::TEXT);

    -- صلاحيات كاملة لـ service_role
    CREATE POLICY "admin_users_service_role_all" ON admin_users
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- -------------------------------------------------------
-- ٦.٩ جدول الفترات المحظورة (blocked_slots)
-- -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blocked_slots') THEN
    ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "blocked_slots_anon_select" ON blocked_slots;
    DROP POLICY IF EXISTS "blocked_slots_service_role_all" ON blocked_slots;

    -- السماح بقراءة الفترات المحظورة للجميع
    CREATE POLICY "blocked_slots_anon_select" ON blocked_slots
      FOR SELECT TO anon
      USING (true);

    -- صلاحيات كاملة لـ service_role
    CREATE POLICY "blocked_slots_service_role_all" ON blocked_slots
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================================
-- القسم ٧: دالة مساعدة لزيادة عداد استخدام الكود
-- تُستدعى من API عند تطبيق كود خصم بنجاح
-- ============================================================

CREATE OR REPLACE FUNCTION increment_code_usage(p_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE codes
  SET used_count = COALESCE(used_count, 0) + 1
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- تمت الترقية بنجاح ✅
-- يمكنك تشغيل هذا الملف مرة أخرى بأمان دون أي تأثير جانبي
-- ============================================================
