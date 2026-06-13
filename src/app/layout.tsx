import type { Metadata } from 'next'
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
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
