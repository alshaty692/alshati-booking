// ============================================================
// API Route — إرسال OTP (ثابت 4444 للتطوير)
// TODO: Phase 2 — استبدال بـ SMS (Twilio/Unifonic)
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone || !/^05\d{8}$/.test(phone)) {
      return Response.json({ error: 'رقم الجوال غير صحيح' }, { status: 400 })
    }

    // في وضع التطوير: OTP ثابت 4444
    // TODO: Phase 2 — أرسل SMS حقيقي هنا
    const otp = process.env.DEV_OTP ?? '4444'

    // نخزّن الـ OTP مؤقتاً في Supabase (جدول مؤقت في session أو cookie)
    // لأغراض التطوير: نعيد الـ OTP في الـ response (لا تفعل هذا في production)
    console.log(`[DEV] OTP for ${phone}: ${otp}`)

    return Response.json({
      success: true,
      message: 'تم إرسال رمز التحقق',
      // في التطوير فقط — احذف هذا السطر في production
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    })
  } catch {
    return Response.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 })
  }
}
