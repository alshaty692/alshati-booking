-- ============================================================
-- Migration 011 — إزالة نظام RLS القديم + إغلاق الثغرات الأمنية
-- ============================================================
-- التاريخ:  2026-07-06
-- المرجع:   جلسة الأمن — NOTES_LEGACY_RLS.md + قرارات 2026-07-06
--
-- ما يفعله هذا الملف (بالترتيب):
--   ١. توثيق أرشيفي كامل للدالتين والسياسات (تعليق فقط)
--   ٢. حذف السياسات المعتمدة على get_admin_role()/is_admin_user()
--   ٣. استبدال bookings_visitor_select بنسخة بدون is_admin_user()
--   ٤. حذف الدالتين (بدون CASCADE — للاكتشاف الصريح لأي اعتماد منسي)
--   ٥. تحقق ختامي بـ DO $$ + SELECT للتوثيق
--
-- ما لا يمسّه هذا الملف:
--   - سياسات service_role_all على أي جدول
--   - سياسات anon المدرجة في migration 001
--   - admin_users_authenticated_select_own (تعتمد على auth.uid() مباشرة)
--   - codes_read_all / codes_anon_select_active
--   - customers_visitor_select / customers_anon_select_own
--   - blocked_slots_anon_select
--   - slot_holds (جميع سياساته)
-- ============================================================
--
-- ⚠️ يُشغَّل يدوياً في Supabase Dashboard > SQL Editor
-- ⚠️ مرة واحدة فقط — IF EXISTS تجعله آمن الإعادة
-- ============================================================


-- ============================================================
-- القسم ١ — أرشيف توثيقي (تعليق SQL فقط — لا تنفيذ)
-- ============================================================

/*
  ╔══════════════════════════════════════════════════════════════╗
  ║  ARCHIVED FUNCTION: get_admin_role()                        ║
  ║  حُذفت بتاريخ: 2026-07-06                                  ║
  ║  أُنشئت: مباشرة في Supabase Dashboard (قبل نظام migrations) ║
  ╚══════════════════════════════════════════════════════════════╝

  ── العيب الأمني الموثَّق ──────────────────────────────────────
  لا تفحص is_active إطلاقاً.
  مستخدم حسابه معطَّل (is_active=false) لكن role='admin' لا يزال
  مخزناً في العمود القديم → يُعامَل كمدير نشط كامل الصلاحيات.

  ── التعريف الكامل ─────────────────────────────────────────────
  CREATE OR REPLACE FUNCTION public.get_admin_role()
   RETURNS text LANGUAGE plpgsql SECURITY DEFINER
  AS $function$
  declare v_role text;
  begin
    select role into v_role from public.admin_users where id = auth.uid();
    return coalesce(v_role, 'none');
  end;
  $function$

  ╔══════════════════════════════════════════════════════════════╗
  ║  ARCHIVED FUNCTION: is_admin_user()                         ║
  ║  حُذفت بتاريخ: 2026-07-06                                  ║
  ╚══════════════════════════════════════════════════════════════╝

  ── العيب الأمني الموثَّق ──────────────────────────────────────
  لا تفحص is_active.
  أي مستخدم موجود في admin_users يُعامَل كمدير حتى لو كان
  حسابه معطَّلاً — SECURITY DEFINER تُعمّق المشكلة.

  ── التعريف الكامل ─────────────────────────────────────────────
  CREATE OR REPLACE FUNCTION public.is_admin_user()
   RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
  AS $function$
  begin
    return exists (
      select 1 from public.admin_users where id = auth.uid()
    );
  end;
  $function$

  ╔══════════════════════════════════════════════════════════════╗
  ║  ARCHIVED POLICIES — المحذوفة في هذا الملف (2026-07-06)    ║
  ╚══════════════════════════════════════════════════════════════╝

  (القائمة مستخرجة من Supabase SQL Editor بتاريخ 2026-07-06
   الاستعلام: SELECT * FROM pg_policies WHERE tablename IN (...))

  الجدول          | اسم السياسة                   | CMD  | يعتمد على
  ─────────────────────────────────────────────────────────────────────
  admin_users     | admin_users_admin_write        | ALL  | is_admin_user()
  admin_users     | admin_users_self_select        | SEL  | is_admin_user() / get_admin_role()
  blocked_slots   | admin_all                      | ALL  | is_admin_user()
  bookings        | bookings_admin_all             | ALL  | is_admin_user()
  bookings        | bookings_viewer_select         | SEL  | get_admin_role() = 'viewer'
  bookings        | bookings_visitor_select        | SEL  | OR is_admin_user() — مُستبدَلة
  codes           | codes_admin_write              | ALL  | is_admin_user()
  customers       | customers_admin_all            | ALL  | is_admin_user()
  ─────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════╗
  ║  PRESERVED POLICIES — لم تُلمس (مستقلة عن الدالتين)        ║
  ╚══════════════════════════════════════════════════════════════╝

  ملاحظة تاريخية: السياسات القديمة (*_anon_select_own، *_anon_select،
  *_anon_insert، إلخ) من migration 001 حُذفت جميعها بـ migration 010
  واستُبدلت بسياسات RESTRICTIVE deny_anon تُغلق بوابة anon بالكامل.
  القائمة التالية تعكس الوضع الحالي بعد migration 010:

  الجدول          | اسم السياسة                         | ملاحظة
  ─────────────────────────────────────────────────────────────────────
  admin_users     | admin_users_authenticated_select_own | auth.uid() مباشرة (محفوظة)
  admin_users     | admin_users_service_role_all         | service_role (محفوظة)
  blocked_slots   | blocked_slots_deny_anon              | RESTRICTIVE — من migration 010
  blocked_slots   | blocked_slots_service_role_all       | service_role (محفوظة)
  bookings        | bookings_deny_anon                   | RESTRICTIVE — من migration 010
  bookings        | bookings_service_role_all            | service_role (محفوظة)
  codes           | codes_deny_anon                      | RESTRICTIVE — من migration 010
  codes           | codes_service_role_all               | service_role (محفوظة)
  customers       | customers_deny_anon                  | RESTRICTIVE — من migration 010
  customers       | customers_service_role_all           | service_role (محفوظة)
  slot_holds      | slot_holds_deny_anon                 | RESTRICTIVE — من migration 010
  slot_holds      | slot_holds_service_role_all          | service_role (محفوظة)
  ─────────────────────────────────────────────────────────────────────
  ⚠️ الأسماء الدقيقة لسياسات deny_anon تحتاج تأكيداً من Dashboard
     (migration 010 طُبِّق مباشرة ولم يُحفظ كملف .sql)
  ─────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════╗
  ║  سبب الحذف (الخيار ب من NOTES_LEGACY_RLS.md)              ║
  ╚══════════════════════════════════════════════════════════════╝

  ١. requirePermission() في lib/permissions.ts يغطي كل الحماية
     المطلوبة بشكل أقوى: يفحص is_active + role_id + permission_key
  ٢. لا يوجد أي كود حي يستخدم Supabase Browser Client مع
     authenticated session للجداول الخمسة — مُثبَت بالاختبار الحي
  ٣. الدالتان لا تفحصان is_active — عيب أمني موثَّق
  ٤. وجود طبقتين متناقضتين (نظام جديد + قديم) مصدر خطر مستقبلي
*/


-- ============================================================
-- القسم ٢ — حذف السياسات المعتمدة على الدالتين القديمتين
-- (DROP POLICY IF EXISTS — آمن للتشغيل المتعدد)
-- ============================================================

-- ── admin_users ──────────────────────────────────────────────
-- المحفوظة: admin_users_authenticated_select_own (auth.uid() مباشرة)
-- المحفوظة: admin_users_service_role_all
DROP POLICY IF EXISTS "admin_users_admin_write" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_self_select"  ON public.admin_users;

-- ── blocked_slots ─────────────────────────────────────────────
-- المحفوظة: blocked_slots_anon_select، blocked_slots_service_role_all
DROP POLICY IF EXISTS "admin_all" ON public.blocked_slots;

-- ── bookings ──────────────────────────────────────────────────
-- المحفوظة: bookings_anon_insert، bookings_anon_select_own، bookings_service_role_all
-- bookings_visitor_select: تُحذف هنا وتُعاد بناؤها في القسم ٢.١
DROP POLICY IF EXISTS "bookings_admin_all"       ON public.bookings;
DROP POLICY IF EXISTS "bookings_viewer_select"   ON public.bookings;
DROP POLICY IF EXISTS "bookings_visitor_select"  ON public.bookings;

-- ── codes ─────────────────────────────────────────────────────
-- المحفوظة: codes_anon_select_active، codes_service_role_all
DROP POLICY IF EXISTS "codes_admin_write" ON public.codes;

-- ── customers ─────────────────────────────────────────────────
-- المحفوظة: customers_anon_select_own، customers_service_role_all
DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;


-- ============================================================
-- القسم ٢.١ — إعادة بناء bookings_visitor_select بدون is_admin_user()
-- ============================================================
-- الأصلية: SELECT لـ TO public بشرطين:
--            customer_phone = current_setting('app.current_phone', ...) OR is_admin_user()
-- الجديدة:  نفس الدور (TO public) + نفس شرط phone (محفوظ حرفياً) بدون OR is_admin_user()
-- التحسين: NULLIF(..., '') بدل مقارنة مباشرة — يمنع تسرب صفوف عند غياب الـ setting
-- ملاحظة: كل API routes تستخدم service_role الذي يتجاوز RLS كلياً —
--          هذه السياسة احتياطية للوصول المباشر المحتمل.
-- ============================================================
CREATE POLICY "bookings_visitor_select" ON public.bookings
  FOR SELECT
  TO public
  USING (
    customer_phone = NULLIF(current_setting('app.current_phone', TRUE), '')
  );


-- ============================================================
-- القسم ٣ — حذف الدالتين القديمتين
-- بدون CASCADE: أي اعتماد منسي يُولّد خطأ واضح بدل حذف صامت
-- ============================================================
DROP FUNCTION IF EXISTS public.get_admin_role();
DROP FUNCTION IF EXISTS public.is_admin_user();


-- ============================================================
-- القسم ٤ — تحقق ختامي
-- ============================================================

DO $$
DECLARE
  v_func_count   INT;
  v_stale_count  INT;
  v_policy_count INT;
BEGIN

  -- أ: تأكد أن الدالتين محذوفتان بالكامل
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname IN ('get_admin_role', 'is_admin_user')
    AND n.nspname = 'public';

  IF v_func_count > 0 THEN
    RAISE EXCEPTION
      'FAIL: % دالة قديمة لا تزال موجودة — راجع الاعتماديات المتبقية',
      v_func_count;
  ELSE
    RAISE NOTICE '✓ الدالتان القديمتان محذوفتان بالكامل';
  END IF;

  -- ب: تأكد لا سياسة متبقية تشير للدالتين في qual أو with_check
  SELECT COUNT(*) INTO v_stale_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
         qual        LIKE '%get_admin_role%'
      OR qual        LIKE '%is_admin_user%'
      OR with_check  LIKE '%get_admin_role%'
      OR with_check  LIKE '%is_admin_user%'
    );

  IF v_stale_count > 0 THEN
    RAISE EXCEPTION
      'FAIL: % سياسة لا تزال تشير للدالتين القديمتين — راجع pg_policies',
      v_stale_count;
  ELSE
    RAISE NOTICE '✓ لا سياسة تشير للدالتين القديمتين';
  END IF;

  -- ج: إحصاء السياسات المتبقية على الجداول الخمسة (للتوثيق)
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'bookings', 'customers', 'slot_holds',
      'blocked_slots', 'codes', 'admin_users'
    );

  RAISE NOTICE '✓ السياسات المتبقية على الجداول الستة: % سياسة', v_policy_count;
  RAISE NOTICE '══ Migration 011 اكتملت بنجاح ══';

END $$;


-- ── عرض نهائي: السياسات المتبقية (للمراجعة البصرية) ─────────
SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'bookings', 'customers', 'slot_holds',
    'blocked_slots', 'codes', 'admin_users'
  )
ORDER BY tablename, policyname;
