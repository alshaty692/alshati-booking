// ============================================================
// الصفحة الرئيسية — تحويل فوري لصفحة تسجيل الدخول
// ============================================================
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function HomePage() {
  const cookieStore = await cookies()
  const phone = cookieStore.get('booking_phone')?.value

  // لو الجوال محفوظ → مباشرة لصفحة الحجز
  if (phone) {
    redirect('/book')
  }

  redirect('/login')
}
