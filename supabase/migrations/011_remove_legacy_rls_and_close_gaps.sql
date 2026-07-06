-- ============================================================
-- Migration 011 — إزالة نظام RLS القديم + إغلاق الثغرات الأمنية
-- النسخة النهائية الشاملة — 13 سياسة على 9 جداول
-- ============================================================
-- التاريخ:  2026-07-06
-- المرجع:   جلسة الأمن — NOTES_LEGACY_RLS.md + قرارات 2026-07-06
--           فحص شامل بتاريخ 2026-07-06 كشف 9 جداول (وليس 6 فقط)
--
-- ما يفعله هذا الملف (بالترتيب):
--   ١. توثيق أرشيفي كامل للدالتين + الـ 13 سياسة (تعليق فقط)
--   ٢. حذف شامل ديناميكي: DO block يلتقط كل سياسة تشير للدالتين
--      (ضمانة شاملة — حتى لو وُجدت سياسة فائتة)
--   ٣. DROP صريح بالاسم للـ 12 سياسة المعروفة (طبقة ثانية - IF EXISTS)
--   ٤. استبدال bookings_visitor_select بنسخة بدون is_admin_user()
--   ٥. DROP FUNCTION بدون CASCADE للدالتين
--   ٦. تحقق ختامي + SELECT نهائي
--
-- ما لا يمسّه هذا الملف:
--   - سياسات service_role_all على أي جدول
--   - سياسات deny_anon RESTRICTIVE من migration 010
--   - admin_users_authenticated_select_own (auth.uid() مباشرة)
--   - codes_anon_select_active + أي سياسة anon مستقلة
-- ============================================================
--
-- ⚠️ يُشغَّل يدوياً في Supabase Dashboard > SQL Editor
-- ⚠️ مرة واحدة فقط — IF EXISTS والـ DO block يجعلانه آمن الإعادة
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
  أي مستخدم موجود في admin_users يُعامَل كمدير حتى لو معطَّل —
  SECURITY DEFINER تُعمّق المشكلة.

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
  ║  ARCHIVED POLICIES — الـ 13 سياسة المحذوفة (2026-07-06)    ║
  ╚══════════════════════════════════════════════════════════════╝

  (مستخرجة من Supabase SQL Editor بتاريخ 2026-07-06 بالاستعلام:
   SELECT tablename, policyname, qual, with_check FROM pg_policies
   WHERE schemaname='public' AND (qual LIKE '%get_admin_role%'
   OR qual LIKE '%is_admin_user%' OR ...))

  الجدول                | اسم السياسة                   | CMD  | يعتمد على
  ─────────────────────────────────────────────────────────────────────────
  admin_users           | admin_users_admin_write        | ALL  | is_admin_user()
  admin_users           | admin_users_self_select        | SEL  | is_admin_user() / get_admin_role()
  audit_log             | (سياسة أو أكثر)               | ALL  | is_admin_user()
  blocked_slots         | admin_all                      | ALL  | is_admin_user()
  bookings              | bookings_admin_all             | ALL  | is_admin_user()
  bookings              | bookings_viewer_select         | SEL  | get_admin_role() = 'viewer'
  bookings              | bookings_visitor_select        | SEL  | OR is_admin_user() — مُستبدَلة
  codes                 | codes_admin_write              | ALL  | is_admin_user()
  customer_contact_log  | (سياسة أو أكثر)               | ALL  | is_admin_user()
  customers             | customers_admin_all            | ALL  | is_admin_user()
  payments_legacy       | (سياسة أو أكثر)               | ALL  | is_admin_user()
  settings              | settings_write_admin           | ALL  | get_admin_role()
  suspensions           | suspensions_admin_write        | ALL  | get_admin_role()
  ─────────────────────────────────────────────────────────────────────────
  المجموع: 13 سياسة على 9 جداول

  ── حالة الجداول الجديدة (مكتشفة 2026-07-06) ──────────────────
  payments_legacy     : 0 صف  — مهجور، جاهز للحذف مستقبلاً (migration 006 ينشئه شرطياً)
  suspensions         : 0 صف  — مهجور، أُنشئ مباشرة بالـ Dashboard
  audit_log           : 165 صف — نشط، لكن كل الكود يصل له عبر service_role
  customer_contact_log: 0 صف  — مهجور
  لا كود بـ src/ يصل لأي من هذه الجداول الأربعة عبر browser client مباشر.

  ╔══════════════════════════════════════════════════════════════╗
  ║  PRESERVED POLICIES — لم تُلمس (مستقلة عن الدالتين)        ║
  ╚══════════════════════════════════════════════════════════════╝

  ملاحظة تاريخية: السياسات القديمة (*_anon_select_own، *_anon_insert، إلخ)
  من migration 001 حُذفت بـ migration 010 واستُبدلت بسياسات
  RESTRICTIVE deny_anon تُغلق بوابة anon بالكامل.

  الجدول          | اسم السياسة                         | ملاحظة
  ─────────────────────────────────────────────────────────────────────
  admin_users     | admin_users_authenticated_select_own | auth.uid() مباشرة (محفوظة)
  admin_users     | admin_users_service_role_all         | service_role (محفوظة)
  audit_log       | audit_log_service_role_all           | service_role (محفوظة)
  blocked_slots   | blocked_slots_deny_anon              | RESTRICTIVE — migration 010
  blocked_slots   | blocked_slots_service_role_all       | service_role (محفوظة)
  bookings        | bookings_deny_anon                   | RESTRICTIVE — migration 010
  bookings        | bookings_service_role_all            | service_role (محفوظة)
  codes           | codes_anon_select_active             | is_active=true (محفوظة)
  codes           | codes_deny_anon                      | RESTRICTIVE — migration 010
  codes           | codes_service_role_all               | service_role (محفوظة)
  customers       | customers_deny_anon                  | RESTRICTIVE — migration 010
  customers       | customers_service_role_all           | service_role (محفوظة)
  slot_holds      | slot_holds_deny_anon                 | RESTRICTIVE — migration 010
  slot_holds      | slot_holds_service_role_all          | service_role (محفوظة)
  settings        | settings_anon_select                 | anon SELECT (محفوظة)
  settings        | settings_service_role_all            | service_role (محفوظة)
  ─────────────────────────────────────────────────────────────────────
  ⚠️ الأسماء الدقيقة لبعض السياسات تحتاج تأكيداً من Dashboard
     (migration 010 طُبِّق مباشرة ولم يُحفظ كملف .sql)

  ╔══════════════════════════════════════════════════════════════╗
  ║  سبب الحذف (الخيار ب من NOTES_LEGACY_RLS.md)              ║
  ╚══════════════════════════════════════════════════════════════╝

  ١. requirePermission() في lib/permissions.ts أقوى: يفحص
     is_active + role_id + permission_key
  ٢. لا كود حي يصل للجداول التسعة عبر browser client مع
     authenticated session — مُثبَت بفحص كامل لـ src/
  ٣. الدالتان لا تفحصان is_active — عيب أمني موثَّق
  ٤. طبقتان متناقضتان (نظام جديد + قديم) = خطر تقني مستقبلي
*/


-- ============================================================
-- القسم ٢ — حذف شامل ديناميكي (الضمانة الرئيسية)
-- يلتقط كل سياسة تشير للدالتين في أي جدول — بما فيها أي
-- سياسة غير مُسمَّاة صراحةً في القسم ٣ أدناه
-- bookings_visitor_select مستثناة هنا — تُعالَج في القسم ٤
-- ============================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tablename, policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  policyname != 'bookings_visitor_select'
      AND  (
               qual        LIKE '%get_admin_role%'
            OR qual        LIKE '%is_admin_user%'
            OR with_check  LIKE '%get_admin_role%'
            OR with_check  LIKE '%is_admin_user%'
           )
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.policyname, rec.tablename);
    RAISE NOTICE 'تم حذف السياسة: % على %', rec.policyname, rec.tablename;
  END LOOP;

  RAISE NOTICE '══ DO dynamic drop: اكتمل ══';
END $$;


-- ============================================================
-- القسم ٣ — DROP صريح بالاسم (طبقة ثانية — IF EXISTS آمن)
-- يُكمل القسم ٢ بتوثيق صريح للأسماء المعروفة
-- bookings_visitor_select مدرجة هنا حذفاً فقط، تُعاد بناؤها بالقسم ٤
-- ============================================================

-- ── admin_users ───────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_users_admin_write"  ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_self_select"  ON public.admin_users;

-- ── audit_log ─────────────────────────────────────────────────
-- الأسماء الدقيقة تعتمد على النتيجة الكاملة من SQL Editor
-- القسم ٢ (ديناميكي) يضمن حذفها حتى لو الاسم مختلفاً
DROP POLICY IF EXISTS "audit_log_admin_all"      ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_admin_write"    ON public.audit_log;

-- ── blocked_slots ─────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all"                ON public.blocked_slots;

-- ── bookings ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_admin_all"       ON public.bookings;
DROP POLICY IF EXISTS "bookings_viewer_select"   ON public.bookings;
DROP POLICY IF EXISTS "bookings_visitor_select"  ON public.bookings;   -- تُعاد بناؤها في القسم ٤

-- ── codes ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "codes_admin_write"        ON public.codes;

-- ── customer_contact_log ──────────────────────────────────────
DROP POLICY IF EXISTS "customer_contact_log_admin_all"   ON public.customer_contact_log;
DROP POLICY IF EXISTS "customer_contact_log_admin_write" ON public.customer_contact_log;

-- ── customers ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "customers_admin_all"      ON public.customers;

-- ── payments_legacy ───────────────────────────────────────────
DROP POLICY IF EXISTS "payments_legacy_admin_all"   ON public.payments_legacy;
DROP POLICY IF EXISTS "payments_legacy_admin_write" ON public.payments_legacy;

-- ── settings ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_write_admin"     ON public.settings;

-- ── suspensions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "suspensions_admin_write"  ON public.suspensions;


-- ============================================================
-- القسم ٤ — إعادة بناء bookings_visitor_select بدون is_admin_user()
-- ============================================================
-- الأصلية: SELECT لـ TO public بشرطين:
--            customer_phone = current_setting('app.current_phone', ...) OR is_admin_user()
-- الجديدة:  نفس الدور (TO public) + نفس شرط phone حرفياً بدون OR
-- التحسين:  NULLIF(..., '') يمنع تسرب صفوف عند غياب الـ setting
-- ============================================================
CREATE POLICY "bookings_visitor_select" ON public.bookings
  FOR SELECT
  TO public
  USING (
    customer_phone = NULLIF(current_setting('app.current_phone', TRUE), '')
  );


-- ============================================================
-- القسم ٥ — حذف الدالتين القديمتين
-- بدون CASCADE — أي اعتماد فائت يُولّد خطأ صريح بدل حذف صامت
-- ============================================================
DROP FUNCTION IF EXISTS public.get_admin_role();
DROP FUNCTION IF EXISTS public.is_admin_user();


-- ============================================================
-- القسم ٦ — تحقق ختامي
-- ============================================================

DO $$
DECLARE
  v_func_count   INT;
  v_stale_count  INT;
  v_policy_count INT;
BEGIN

  -- أ: تأكد أن الدالتين محذوفتان
  SELECT COUNT(*) INTO v_func_count
  FROM   pg_proc p
  JOIN   pg_namespace n ON n.oid = p.pronamespace
  WHERE  p.proname IN ('get_admin_role', 'is_admin_user')
    AND  n.nspname = 'public';

  IF v_func_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % دالة قديمة لا تزال موجودة — راجع الاعتماديات', v_func_count;
  ELSE
    RAISE NOTICE '✓ الدالتان القديمتان محذوفتان بالكامل';
  END IF;

  -- ب: تأكد لا سياسة تشير للدالتين (ما عدا bookings_visitor_select الجديدة التي لا تشير)
  SELECT COUNT(*) INTO v_stale_count
  FROM   pg_policies
  WHERE  schemaname = 'public'
    AND  (
             qual        LIKE '%get_admin_role%'
          OR qual        LIKE '%is_admin_user%'
          OR with_check  LIKE '%get_admin_role%'
          OR with_check  LIKE '%is_admin_user%'
         );

  IF v_stale_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % سياسة لا تزال تشير للدالتين — راجع pg_policies', v_stale_count;
  ELSE
    RAISE NOTICE '✓ لا سياسة متبقية تشير للدالتين';
  END IF;

  -- ج: إحصاء السياسات الكلية المتبقية (للتوثيق)
  SELECT COUNT(*) INTO v_policy_count
  FROM   pg_policies
  WHERE  schemaname = 'public';

  RAISE NOTICE '✓ إجمالي السياسات المتبقية على كل الجداول: %', v_policy_count;
  RAISE NOTICE '══ Migration 011 اكتملت بنجاح ══';

END $$;


-- ── عرض نهائي: كل السياسات المتبقية على الجداول التسعة ───────
SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text AS roles
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename IN (
    'admin_users', 'audit_log', 'blocked_slots', 'bookings',
    'codes', 'customer_contact_log', 'customers',
    'payments_legacy', 'settings', 'slot_holds', 'suspensions'
  )
ORDER BY tablename, policyname;
