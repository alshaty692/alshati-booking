'use client'
// ============================================================
// Error Boundary — المستوى الجذري
// يلتقط أي خطأ غير معالج في أي مسار بالتطبيق
// ============================================================
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // تسجيل الخطأ (يمكن إضافة Sentry هنا لاحقاً)
    console.error('[GlobalError]', error)
  }, [error])

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
      {/* أيقونة */}
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'var(--color-danger-bg)',
        border: '1.5px solid var(--color-danger)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
      }}>
        ⚠️
      </div>

      {/* العنوان */}
      <h1 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        حدث خطأ غير متوقع
      </h1>

      {/* الوصف */}
      <p style={{
        fontSize: 'var(--text-base)',
        color: 'var(--text-secondary)',
        maxWidth: '360px',
        lineHeight: 1.7,
        margin: 0,
      }}>
        نعتذر، حدث خطأ أثناء تحميل الصفحة. يمكنك إعادة المحاولة أو العودة للصفحة الرئيسية.
      </p>

      {/* رمز الخطأ — للتشخيص */}
      {error.digest && (
        <code style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          background: 'var(--bg-surface)',
          padding: '0.25rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontFamily: 'monospace',
        }}>
          {error.digest}
        </code>
      )}

      {/* الأزرار */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-lime)',
            color: 'var(--text-on-lime)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          ↻ إعادة المحاولة
        </button>

        <a
          href="/"
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'border-color 0.15s, color 0.15s',
            display: 'inline-block',
          }}
        >
          ← الصفحة الرئيسية
        </a>
      </div>
    </div>
  )
}
