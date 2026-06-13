// ============================================================
// Proxy (Middleware) — حماية مسارات الإدارة
// Next.js 16: middleware اسمه الجديد proxy
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
      return NextResponse.redirect(loginUrl)
    }
  }

  // لو المدير مسجّل دخوله ويحاول فتح /admin/login → يُوجَّه للداشبورد
  if (pathname === '/admin/login' && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/admin'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // فقط مسارات الإدارة — تتجنب الـ loop على /admin/login
    '/admin/:path*',
  ],
}
