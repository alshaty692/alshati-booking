// ============================================================
// مساعدات المصادقة والصلاحيات — مركز حي الشاطئ
// ============================================================
// requireAdminRole()  — يُستخدم في بداية كل API route إداري
// يتحقق من:
//   1. المستخدم مسجّل دخول (Supabase Auth)
//   2. موجود في جدول admin_users بدور admin أو editor
//
// تحسين الأداء (cache):
//   - بعد أول تحقق ناجح، يُخزَّن الدور في cookie مشفّرة (HMAC-SHA256)
//   - الطلبات التالية خلال 5 دقائق تقرأ الدور من الـ cookie — بدون DB query
//   - لو الـ cookie منتهية أو تالفة أو userId تغيّر → يعود للـ DB تلقائياً
//   - لو الدور تغيّر في DB → يُطبَّق بعد انتهاء الـ cache (5 دقائق)
// ============================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type AdminRole = 'admin' | 'editor' | 'viewer'

export interface AdminSession {
  userId:    string
  userEmail: string
  role:      AdminRole
}

// ── إعدادات Cache ──────────────────────────────────────────
const CACHE_COOKIE  = 'ar_role_cache'   // اسم الـ cookie
const CACHE_TTL_MS  = 5 * 60 * 1000    // 5 دقائق
const CACHE_MAX_AGE = 5 * 60           // ثواني (لـ cookie maxAge)

// ── HMAC Signing ──────────────────────────────────────────
// نستخدم HMAC-SHA256 للتوقيع بدل التشفير الكامل:
// - يمنع تزوير الـ cookie من المتصفح
// - لا يخفي المحتوى (الدور + userId + expiry) لكن لا حاجة لإخفائه
// - المفتاح من متغير البيئة، يسقط تلقائياً لو لم يُعيَّن

async function sign(payload: string): Promise<string> {
  const secret = process.env.COOKIE_SIGN_SECRET ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'fallback-unsigned'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Buffer.from(sig).toString('base64url')
}

async function verify(payload: string, signature: string): Promise<boolean> {
  const expected = await sign(payload)
  return expected === signature
}

// ── صياغة/قراءة Cache Cookie ──────────────────────────────
interface RoleCache {
  userId:  string
  role:    AdminRole
  expiry:  number   // Unix ms
}

async function readRoleCache(userId: string): Promise<AdminRole | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(CACHE_COOKIE)?.value
    if (!raw) return null

    const [data64, sig] = raw.split('.')
    if (!data64 || !sig) return null

    const ok = await verify(data64, sig)
    if (!ok) return null

    const cache: RoleCache = JSON.parse(Buffer.from(data64, 'base64url').toString())
    // تحقق من انتهاء الصلاحية وتطابق المستخدم
    if (cache.userId !== userId || Date.now() > cache.expiry) return null

    return cache.role
  } catch {
    return null
  }
}

async function writeRoleCache(userId: string, role: AdminRole): Promise<void> {
  try {
    const cache: RoleCache = { userId, role, expiry: Date.now() + CACHE_TTL_MS }
    const data64 = Buffer.from(JSON.stringify(cache)).toString('base64url')
    const sig    = await sign(data64)
    const value  = `${data64}.${sig}`

    const cookieStore = await cookies()
    cookieStore.set(CACHE_COOKIE, value, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   CACHE_MAX_AGE,
      path:     '/api/admin',   // مقيّد بمسارات API الإدارية فقط
    })
  } catch {
    // الفشل في الكتابة غير حرج — الطلب التالي سيقرأ من DB
  }
}

// ── الدالة الرئيسية ────────────────────────────────────────

/**
 * يتحقق من صلاحية المستخدم الإداري مع cache الدور لـ 5 دقائق.
 * يُرجع { ok: true, session } عند النجاح أو { ok: false, response } عند الفشل.
 *
 * @param allowedRoles  الأدوار المسموح بها — افتراضي ['admin', 'editor']
 *
 * مثال الاستخدام:
 *   const auth = await requireAdminRole()
 *   if (!auth.ok) return auth.response
 *   const { session } = auth   // session.userId, session.role
 */
export async function requireAdminRole(
  allowedRoles: AdminRole[] = ['admin', 'editor']
): Promise<
  | { ok: true;  session: AdminSession }
  | { ok: false; response: Response }
> {
  // 1. فحص تسجيل الدخول (دائماً — لا cache على JWT)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: Response.json(
        { error: 'غير مسجّل دخول' },
        { status: 401 }
      ),
    }
  }

  // 2. محاولة قراءة الدور من Cache (تتجنب DB query)
  let role = await readRoleCache(user.id)

  if (!role) {
    // Cache miss أو منتهية → استعلام DB
    const adminSupabase = createAdminClient()
    const { data: adminUser, error: roleError } = await adminSupabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !adminUser) {
      return {
        ok: false,
        response: Response.json(
          { error: 'غير مخوّل — الحساب غير موجود في قائمة المشرفين' },
          { status: 403 }
        ),
      }
    }

    role = adminUser.role as AdminRole

    // كتابة الـ cache للطلبات التالية
    await writeRoleCache(user.id, role)
  }

  // 3. فحص أن الدور ضمن الأدوار المسموح بها
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      response: Response.json(
        { error: `غير مخوّل — الدور '${role}' لا يملك هذه الصلاحية` },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    session: {
      userId:    user.id,
      userEmail: user.email ?? '',
      role,
    },
  }
}
