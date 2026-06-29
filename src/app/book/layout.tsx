// ============================================================
// /book/layout.tsx — حماية صفحة الحجز
// 1. التحقق من جلسة العميل (cookie)
// 2. التحقق من الإغلاق الكامل للمنشأة
// ============================================================
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getClosureState } from '@/lib/closure'
import { createAdminClient } from '@/lib/supabase/server'
import FullClosurePage from '@/components/FullClosurePage'

export const metadata: Metadata = {
  title: 'احجز ملعبك',
  description: 'احجز الآن في مركز حي الشاطئ',
}

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  // 1. التحقق من الجلسة
  const cookieStore = await cookies()
  const phone = cookieStore.get('booking_phone')?.value
  if (!phone) redirect('/login')

  // 2. التحقق من الإغلاق الكامل
  const closure = await getClosureState()
  if (closure.isFullyClosedNow) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'facility_phone')
      .single()

    return (
      <FullClosurePage
        title={closure.title}
        message={closure.message}
        phone={data?.value ?? ''}
      />
    )
  }

  return <>{children}</>
}
