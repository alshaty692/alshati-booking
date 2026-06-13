import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'أدخل رقم جوالك للحجز في مركز حي الشاطئ',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
