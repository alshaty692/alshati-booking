import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'احجز ملعبك',
  description: 'احجز الآن في مركز حي الشاطئ',
}

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const phone = cookieStore.get('booking_phone')?.value

  if (!phone) redirect('/login')

  return children
}
