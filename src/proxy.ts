// ============================================================
// Proxy (Middleware) — حماية مسارات الإدارة + Security Headers
// Next.js 16: middleware اسمه الجديد proxy
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Security Headers ─────────────────────────────────────────
// CSP متساهل مقصود: unsafe-inline/unsafe-eval ضروريان حالياً لـ
// Next.js runtime وhtml2canvas وCSS-in-JS — سيُشدَّد تدريجياً لاحقاً
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options':           'SAMEORIGIN',
  'X-Content-Type-Options':    'nosniff',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

/** يُطبّق Security Headers على أي NextResponse */
function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // تحديث الجلسة (ضروري لـ @supabase/ssr)
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // حماية كل مسارات الإدارة عدا صفحة تسجيل الدخول
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      // ملاحظة: فحص الـ role الفعلي (admin/editor) يتم في:
      // - layout.tsx عبر requireAdminRole()
      // - كل API route عبر requireAdminRole()
      // لا نضيفه هنا لتجنب DB query على كل طلب (يُثقّل الـ middleware)
      return applySecurityHeaders(NextResponse.redirect(loginUrl))
    }
  }

  // لو المدير مسجّل دخوله ويحاول فتح /admin/login → يُوجَّه للداشبورد
  if (pathname === '/admin/login' && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/admin'
    return applySecurityHeaders(NextResponse.redirect(dashboardUrl))
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * يُطبَّق على كل المسارات عدا:
     * - _next/static  (ملفات static assets)
     * - _next/image   (ملفات image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
