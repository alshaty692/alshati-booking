-- ============================================================
-- Migration 009: إضافة مفتاح delete_payment (admin فقط)
-- ============================================================
-- السبب: DELETE /api/admin/payments/[id] (حذف دفعة خاطئة)
-- admin فقط، بنفس نمط فصل hard_delete_booking عن
-- soft_delete_booking الموثَّق بمصفوفة migration 008.
--
-- المفاتيح بعد هذا الملف:
--   admin  = 25 (كان 24)
--   editor = 18 (بدون تغيير)
--   viewer = 6  (بدون تغيير)
--
-- ✅ idempotent: ON CONFLICT DO NOTHING
-- ⚠️ لا تلمس migration 008 — هذا ملف مستقل
-- ============================================================

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'delete_payment'
FROM   roles r
WHERE  r.name = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- تحقق ختامي
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM   role_permissions rp
  JOIN   roles r ON r.id = rp.role_id
  WHERE  r.name = 'admin'
    AND  rp.permission_key = 'delete_payment';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ delete_payment مضاف للـ admin (admin=25 مفتاحاً)';
  ELSE
    RAISE WARNING '⚠️ delete_payment لم يُضَف — تحقق من جدول roles';
  END IF;
END $$;
