// ============================================================
// 404 Not Found — المستوى الجذري
// يُعرض عند أي مسار غير موجود في التطبيق
// ============================================================
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — الصفحة غير موجودة',
}

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '2rem',
      background: 'var(--bg-base)',
      fontFamily: "'Tajawal', system-ui, sans-serif",
      direction: 'rtl',
      textAlign: 'center',
    }}>
      {/* الرقم الكبير */}
      <div style={{
        fontSize: '6rem',
        fontWeight: 900,
        lineHeight: 1,
        color: 'var(--color-lime)',
        letterSpacing: '-0.05em',
        fontFamily: "'Tajawal', system-ui, sans-serif",
        userSelect: 'none',
      }}>
        404
      </div>

      {/* العنوان */}
      <h1 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        الصفحة غير موجودة
      </h1>

      {/* الوصف */}
      <p style={{
        fontSize: 'var(--text-base)',
        color: 'var(--text-secondary)',
        maxWidth: '360px',
        lineHeight: 1.7,
        margin: 0,
      }}>
        يبدو أن الصفحة التي تبحث عنها غير موجودة أو قد تم نقلها.
      </p>

      {/* حاجز خفيف */}
      <div style={{
        width: '48px',
        height: '2px',
        background: 'var(--border-color)',
        borderRadius: '2px',
      }} />

      {/* الروابط */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <a
          href="/book"
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-lime)',
            color: 'var(--text-on-lime)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            fontFamily: 'inherit',
            textDecoration: 'none',
            display: 'inline-block',
            transition: 'opacity 0.15s',
          }}
        >
          📅 احجز الآن
        </a>

        <a
          href="/admin"
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            fontFamily: 'inherit',
            textDecoration: 'none',
            display: 'inline-block',
            transition: 'border-color 0.15s',
          }}
        >
          ← لوحة التحكم
        </a>
      </div>
    </div>
  )
}
