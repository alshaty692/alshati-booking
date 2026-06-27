import type { Metadata } from 'next'
import { Tajawal, IBM_Plex_Sans_Arabic } from 'next/font/google'

// ── تحميل الخطوط عبر next/font (self-hosted على Vercel CDN) ─────────
// يُلغي الطلب الخارجي لـ fonts.googleapis.com ويحذف render-blocking
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
  preload: true,
})

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm',
  display: 'swap',
  preload: false, // الخط الثانوي — لا داعي لـ preload
})

// سكريبت الثيم — يُحقن بشكل inline قبل أي CSS أو React hydration
// يمنع فلاش الثيم الخاطئ عند التحميل الأول
function ThemeInitScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('alshati-theme');
        var theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'مركز حي الشاطئ — حجز الملاعب',
    template: '%s | مركز حي الشاطئ',
  },
  description: 'احجز ملاعب كرة القدم والكرة الطائرة والملعب المتعدد في مركز حي الشاطئ بجدة بكل سهولة',
  keywords: ['حجز ملاعب', 'جدة', 'حي الشاطئ', 'كرة القدم', 'الكرة الطائرة', 'رياضة'],
  authors: [{ name: 'مركز حي الشاطئ' }],
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    title: 'مركز حي الشاطئ — حجز الملاعب',
    description: 'احجز ملاعبك الآن',
    siteName: 'مركز حي الشاطئ',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${tajawal.variable} ${ibmPlexSansArabic.variable}`}
    >
      <head>
        <ThemeInitScript />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
