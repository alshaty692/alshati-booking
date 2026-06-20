'use client'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface ThemeToggleProps {
  /** الموضع الافتراضي: ثابت في الزاوية. تمرير className لتجاوزه */
  className?: string
  /** حجم الأيقونة بالبكسل (افتراضي: 18) */
  iconSize?: number
}

/**
 * زر تبديل الثيم (داكن / فاتح)
 * ─ يعتمد على useTheme لإدارة المنطق والتخزين
 * ─ لا يُعرض قبل الـ hydration لتجنب فلاش المحتوى (mounted guard)
 * ─ موضعه الافتراضي: ثابت أعلى اليسار (top-left في RTL = بعيداً عن الـ sidebar)
 */
export default function ThemeToggle({ className, iconSize = 18 }: ThemeToggleProps) {
  const { theme, toggle, mounted } = useTheme()

  // لا تعرض شيئاً قبل التحميل — تجنب flash مختلف عن الـ SSR
  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggle}
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className={className ?? 'theme-toggle-fixed'}
    >
      {isDark ? (
        <Sun size={iconSize} strokeWidth={1.75} />
      ) : (
        <Moon size={iconSize} strokeWidth={1.75} />
      )}

      <style>{`
        .theme-toggle-fixed {
          position: fixed;
          top: 14px;
          left: 14px;
          z-index: 9990;

          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);

          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease,
                      color 0.2s ease, transform 0.15s ease;
        }

        .theme-toggle-fixed:hover {
          background: var(--bg-elevated);
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
          transform: scale(1.06);
        }

        .theme-toggle-fixed:active {
          transform: scale(0.97);
        }

        /* على صفحة الـ admin (السايدبار موجود):
           يعلو فوق المحتوى ولا يتداخل مع السايدبار (الذي هو على اليمين في RTL) */
        @media (max-width: 768px) {
          .theme-toggle-fixed {
            top: 10px;
            left: 10px;
          }
        }
      `}</style>
    </button>
  )
}
