'use client'
// ============================================================
// Error Boundary — صفحة الحجز /book
// ============================================================
import { useEffect } from 'react'

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[BookError]', error)
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
        📅
      </div>

      <h1 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        تعذّر تحميل صفحة الحجز
      </h1>

      <p style={{
        fontSize: 'var(--text-base)',
        color: 'var(--text-secondary)',
        maxWidth: '340px',
        lineHeight: 1.7,
        margin: 0,
      }}>
        حدث خطأ أثناء تحميل المواعيد المتاحة. تحقق من اتصالك بالإنترنت وأعد المحاولة.
      </p>

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

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.7rem 1.75rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-lime)',
            color: 'var(--text-on-lime)',
            fontSize: 'var(--text-base)',
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
      </div>
    </div>
  )
}
