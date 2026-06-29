'use client'
// ============================================================
// Error Boundary — مسارات لوحة التحكم /admin
// يلتقط أخطاء الـ Server/Client Components داخل /admin
// ============================================================
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1.25rem',
      padding: '4rem 2rem',
      textAlign: 'center',
      fontFamily: "'Tajawal', system-ui, sans-serif",
      direction: 'rtl',
      minHeight: '60vh',
    }}>
      {/* أيقونة */}
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'var(--color-danger-bg)',
        border: '1.5px solid var(--color-danger)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.75rem',
      }}>
        ⚠️
      </div>

      <h2 style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        خطأ في تحميل الصفحة
      </h2>

      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
        maxWidth: '320px',
        lineHeight: 1.7,
        margin: 0,
      }}>
        حدث خطأ غير متوقع في هذا القسم. يمكنك إعادة المحاولة أو الرجوع للوحة التحكم.
      </p>

      {/* ── DEBUG TEMP: يُحذف بعد التشخيص ── */}
      <details style={{ maxWidth: '600px', textAlign: 'left', direction: 'ltr' }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          تفاصيل الخطأ (للمطور)
        </summary>
        <pre style={{
          fontSize: '0.7rem', color: 'var(--color-danger)', background: 'var(--bg-elevated)',
          padding: '0.75rem', borderRadius: 'var(--radius-sm)', overflow: 'auto',
          border: '1px solid var(--color-danger)', marginTop: '0.5rem', maxHeight: '200px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {error.message}{'\n\n'}{error.stack}
        </pre>
      </details>

      {error.digest && (
        <code style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          padding: '0.2rem 0.6rem',
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
            padding: '0.5rem 1.25rem',
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
          href="/admin"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            fontFamily: 'inherit',
            cursor: 'pointer',
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
