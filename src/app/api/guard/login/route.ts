// POST /api/guard/login — تحقق من PIN الحارس وإصدار كوكي جلسة
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// مدة الجلسة: 12 ساعة (تغطي نوبة عمل كاملة)
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pin } = body as { pin?: string }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN مطلوب' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // جلب PIN من settings
    const { data: settingRow, error: settingErr } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'guard_portal_pin')
      .single()

    if (settingErr || !settingRow?.value) {
      console.error('[guard/login] فشل جلب PIN:', settingErr?.message)
      return NextResponse.json(
        { error: 'خطأ في الإعدادات — تواصل مع المدير' },
        { status: 500 }
      )
    }

    const correctPin = settingRow.value.trim()
    const providedPin = pin.trim()

    if (providedPin !== correctPin) {
      return NextResponse.json({ error: 'PIN غير صحيح' }, { status: 401 })
    }

    // بناء الكوكي
    const response = NextResponse.json({ ok: true })

    response.cookies.set('guard_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[guard/login] خطأ غير متوقع:', err)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
