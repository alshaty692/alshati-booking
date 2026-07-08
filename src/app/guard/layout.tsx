import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'بوابة الحارس — تسجيل الدخول',
  description: 'صفحة دخول الحارس — مركز حي الشاطئ',
  robots: 'noindex, nofollow',
}

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return children
}
