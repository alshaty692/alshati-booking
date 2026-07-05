# ملاحظة: نظام RLS قديم موازٍ — يُعالَج لاحقاً

> **تاريخ الاكتشاف:** 2026-07-05  
> **الحالة:** موثَّق، غير معالَج، غير خطِر على التطبيق الحالي

---

## الوصف

يوجد نظام RLS قديم موازٍ على قاعدة البيانات يتكون من:

### الدالتان

| الدالة | السلوك المُلاحَظ | تقرأ من |
|--------|-----------------|---------|
| `get_admin_role()` | ترجع نص دور المستخدم (`"admin"`, `"editor"`, `"viewer"`, `"none"`) | `admin_users.role` (العمود القديم TEXT) |
| `is_admin_user()` | ترجع `true`/`false` | تعتمد على `get_admin_role()` |

- كلتاهما تقرآن `auth.uid()` وتبحثان في `admin_users`
- عندما `auth.uid() = null` (anon / service_role context): ترجعان `"none"` / `false`
- **لا تفحصان `is_active`** (غير مؤكد — تعريف SQL لم يُستخرج بعد، يحتاج SQL Editor)
- **لا تستخدمان `role_id`** (النظام الجديد من migration 008)

### السياسات المرتبطة

سياسات على دور `authenticated` (وربما `public`) تستخدم هاتين الدالتين، من بينها:
- `bookings_viewer_select` — شرط يتضمن `get_admin_role() = 'viewer'`
- `bookings_admin_all` / `customers_admin_all` — شرط `is_admin_user()`
- `codes_read_all` — قراءة مفتوحة
- `blocked_slots_admin_all`
- وسياسات أخرى بنمط `*_visitor_*`, `*_viewer_select`

**هذه السياسات لم تُوثَّق في أي migration (001→010) — أُنشئت مباشرة في Supabase Dashboard قبل نظام migrations الحالي.**

---

## لماذا هي غير خطِرة حالياً

1. **لا يوجد أي كود في التطبيق** يستخدم Supabase browser client (`createBrowserClient`) مع session `authenticated` للوصول المباشر لأي من الجداول الخمسة (`bookings`, `customers`, `slot_holds`, `blocked_slots`, `codes`).
2. **كل API routes** تستخدم `createAdminClient()` (service_role) الذي يتجاوز RLS كلياً — السياسات المذكورة لا تؤثر عليها.
3. **سياسات RESTRICTIVE deny لـ anon** من migration 010 تُغلق بوابة anon بالكامل بغض النظر عن أي سياسة PERMISSIVE موجودة.
4. **الاستغلال يتطلب:** جلسة authenticated صالحة + استدعاء Supabase مباشر من المتصفح — وهذا غير موجود في الكود الحالي.

---

## التحقق المطلوب قبل المعالجة

شغّل هذا الاستعلام في Supabase SQL Editor للحصول على التعريف الكامل:

```sql
-- تعريف الدالتين
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname IN ('get_admin_role', 'is_admin_user')
  AND pronamespace = 'public'::regnamespace;

-- قائمة السياسات الكاملة المرتبطة
SELECT tablename, policyname, cmd, permissive, roles::text, qual, with_check
FROM pg_policies
WHERE tablename IN ('bookings','customers','slot_holds','blocked_slots','codes','admin_users')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## خيارات المعالجة المستقبلية

### الخيار أ — تحديث الدالتين (لو أُريد الإبقاء على نظام RLS للـ authenticated)
- تعديل `get_admin_role()` لتقرأ من `role_id` + `roles.name` بدل `role` القديم
- إضافة فحص `is_active = true` صراحةً
- توثيق الدالتين في migration جديد

### الخيار ب — إزالة كاملة (لو النظام القديم مهجور بالكامل)
- `DROP FUNCTION get_admin_role();`
- `DROP FUNCTION is_admin_user();`
- `DROP POLICY` لكل السياسات المرتبطة
- migration منفصل موثَّق

**القرار يتطلب:** مراجعة تعريف الدالتين الكامل أولاً.

---

> **تنبيه:** لا تعدّل هاتين الدالتين أو سياساتهما قبل الحصول على تعريف SQL الكامل
> ومراجعة أثرهما على أي كود قديم محتمل (خارج نطاق التطبيق الحالي).
