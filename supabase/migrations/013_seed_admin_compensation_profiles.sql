-- ============================================================
-- Migration 013: Seed compensation_profiles للمستخدمين الإداريين
-- ============================================================
-- يُنشئ ملف تعويض افتراضي لكل admin_user حالي ليس له ملف بعد.
-- النتيجة: كل مستخدم إداري يظهر بقسم المحاسبة لضبط راتبه.
--
-- الإعدادات الافتراضية:
--   base_salary      = 0   (يُعدَّل لاحقاً)
--   commission_type  = 'none'
--   commission_value = 0
--   is_active        = true
--
-- ✅ idempotent: ON CONFLICT (beneficiary_type, beneficiary_id) DO NOTHING
-- ⚠️  يُشغَّل يدوياً في Supabase Dashboard > SQL Editor
-- ============================================================

INSERT INTO public.compensation_profiles
  (beneficiary_type, beneficiary_id, base_salary, commission_type, commission_value, is_active)
SELECT
  'admin_user',
  au.id,
  0,
  'none',
  0,
  true
FROM public.admin_users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.compensation_profiles cp
  WHERE  cp.beneficiary_type = 'admin_user'
    AND  cp.beneficiary_id   = au.id
)
ON CONFLICT (beneficiary_type, beneficiary_id) DO NOTHING;


-- ── تحقق ختامي ───────────────────────────────────────────────

DO $$
DECLARE
  v_total_admins   INT;
  v_total_profiles INT;
BEGIN
  SELECT COUNT(*) INTO v_total_admins   FROM public.admin_users;
  SELECT COUNT(*) INTO v_total_profiles
  FROM   public.compensation_profiles
  WHERE  beneficiary_type = 'admin_user';

  RAISE NOTICE '✓ المستخدمون الإداريون: % — ملفات التعويض: %', v_total_admins, v_total_profiles;

  IF v_total_profiles < v_total_admins THEN
    RAISE WARNING '⚠️ % مستخدم بدون ملف تعويض — قد يكون الجدول مفقوداً', (v_total_admins - v_total_profiles);
  ELSE
    RAISE NOTICE '✓ كل المستخدمين الإداريين لديهم ملفات تعويض';
    RAISE NOTICE '══ Migration 013 اكتملت بنجاح ══';
  END IF;
END $$;
