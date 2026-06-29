// ============================================================
// /my-bookings/layout.tsx — حماية صفحة حجوزاتي
// إغلاق كامل → صفحة إغلاق بدل الصفحة
// ============================================================
import { getClosureState } from '@/lib/closure'
import { createAdminClient } from '@/lib/supabase/server'
import FullClosurePage from '@/components/FullClosurePage'

export default async function MyBookingsLayout({ children }: { children: React.ReactNode }) {
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
