// ============================================================
// API Route — التحقق من OTP
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json()

    if (!phone || !otp) {
      return Response.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    const validOtp = process.env.DEV_OTP ?? '4444'

    if (otp !== validOtp) {
      return Response.json({ error: 'رمز التحقق غير صحيح' }, { status: 401 })
    }

    // نحفظ الجوال في cookie مشفّرة (صالحة لساعة واحدة)
    const cookieStore = await cookies()
    cookieStore.set('booking_phone', phone, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // ساعة واحدة
      path: '/',
    })

    return Response.json({ success: true, phone })
  } catch {
    return Response.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 })
  }
}
