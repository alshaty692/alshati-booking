import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'بوابة الحارس',
  description: 'بوابة الحارس — مركز حي الشاطئ',
  robots: 'noindex, nofollow',
}

/**
 * سكريبت inline يُحقن قبل أي CSS أو React hydration
 * يقرأ guard-theme من localStorage ليُطبَّق على <html> فوراً
 * — يمنع الفلاش (FOUC) عند التحميل الأول
 *
 * أولوية القراءة:
 *   1. guard-theme    (اختيار الحارس المحفوظ)
 *   2. alshati-theme  (اختيار الأدمن كـ fallback)
 *   3. prefers-color-scheme (تفضيل النظام)
 */
function GuardThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('guard-theme')
               || localStorage.getItem('alshati-theme')
               || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', t);
      } catch(e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuardThemeScript />
      {children}
    </>
  )
}
