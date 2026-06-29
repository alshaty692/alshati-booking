'use client'
// ============================================================
// FullClosurePage — صفحة إغلاق كامل للمنشأة
// تصميم: Lime Neon × Dark/Light mode
// ============================================================
import { useEffect, useState } from 'react'

interface Props {
  title:   string
  message: string
  phone?:  string
}

export default function FullClosurePage({ title, message, phone }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // اقرأ الثيم الحالي من <html>
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'light') setTheme('light')

    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme')
      setTheme(t === 'light' ? 'light' : 'dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const isDark = theme === 'dark'

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark
        ? 'linear-gradient(135deg, #0d0f0e 0%, #111612 50%, #0a0c0b 100%)'
        : 'linear-gradient(135deg, #f0f4f0 0%, #e8f0ea 50%, #f5f7f5 100%)',
      fontFamily: 'var(--font-tajawal, Tajawal, sans-serif)',
      direction: 'rtl',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* خلفية Lime زجاجية */}
      <div style={{
        position: 'absolute',
        top: '15%', right: '10%',
        width: '280px', height: '280px',
        background: 'radial-gradient(circle, rgba(163,230,53,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%', left: '5%',
        width: '200px', height: '200px',
        background: 'radial-gradient(circle, rgba(163,230,53,0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* البطاقة */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: isDark
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isDark ? 'rgba(163,230,53,0.15)' : 'rgba(74,124,0,0.2)'}`,
        borderRadius: '1.5rem',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        boxShadow: isDark
          ? '0 0 40px rgba(163,230,53,0.08), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* أيقونة */}
        <div style={{
          width: '72px', height: '72px',
          borderRadius: '50%',
          background: isDark ? 'rgba(163,230,53,0.1)' : 'rgba(74,124,0,0.1)',
          border: `2px solid ${isDark ? 'rgba(163,230,53,0.3)' : 'rgba(74,124,0,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '2rem',
        }}>
          🔒
        </div>

        {/* العنوان */}
        <h1 style={{
          fontSize: 'clamp(1.3rem, 4vw, 1.7rem)',
          fontWeight: 800,
          color: isDark ? 'rgba(163,230,53,0.95)' : '#2D5A00',
          margin: '0 0 1rem',
          lineHeight: 1.3,
        }}>
          {title}
        </h1>

        {/* الرسالة */}
        <p style={{
          fontSize: '1rem',
          color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
          lineHeight: 1.7,
          margin: '0 0 2rem',
        }}>
          {message}
        </p>

        {/* فاصل */}
        <div style={{
          height: '1px',
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          margin: '0 0 1.5rem',
        }} />

        {/* التواصل */}
        {phone && (
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{
              fontSize: '0.85rem',
              color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              margin: '0 0 0.5rem',
            }}>
              للاستفسار
            </p>
            <a
              href={`tel:${phone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: isDark ? 'rgba(163,230,53,0.9)' : '#2D5A00',
                textDecoration: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.75rem',
                background: isDark ? 'rgba(163,230,53,0.08)' : 'rgba(74,124,0,0.08)',
                border: `1px solid ${isDark ? 'rgba(163,230,53,0.2)' : 'rgba(74,124,0,0.2)'}`,
                transition: 'all 0.15s ease',
                direction: 'ltr',
              }}
            >
              📞 {phone}
            </a>
          </div>
        )}

        {/* شارة الحالة */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.85rem',
          borderRadius: '999px',
          background: isDark ? 'rgba(255,80,80,0.1)' : 'rgba(255,80,80,0.08)',
          border: '1px solid rgba(255,80,80,0.2)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#ff5050',
          marginTop: '0.5rem',
        }}>
          <span style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: '#ff5050',
            animation: 'pulse-red 2s infinite',
          }} />
          مغلق مؤقتاً
        </div>
      </div>

      <style>{`
        @keyframes pulse-red {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
