'use client'
import { Sun, Moon } from 'lucide-react'
import { useGuardTheme } from '@/hooks/useGuardTheme'

/**
 * زر تبديل ثيم بوابة الحارس
 * - يستخدم مفتاح localStorage مستقل (guard-theme)
 * - موضعه ثابت أعلى اليسار (فوق السايدبار — لا يوجد سايدبار هنا)
 * - لا يُعرض قبل الـ hydration لتجنب فلاش المحتوى
 */
export default function GuardThemeToggle() {
  const { theme, toggle, mounted } = useGuardTheme()

  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <button
      id="guard-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className="gtt-btn"
    >
      {isDark
        ? <Sun  size={18} strokeWidth={1.75} />
        : <Moon size={18} strokeWidth={1.75} />
      }

      <style>{`
        .gtt-btn {
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
          transition:
            background     0.2s ease,
            border-color   0.2s ease,
            color          0.2s ease,
            transform      0.15s ease;
        }

        .gtt-btn:hover {
          background:    var(--bg-elevated);
          border-color:  var(--color-lime-dim);
          color:         var(--color-lime);
          transform:     scale(1.06);
        }

        .gtt-btn:active {
          transform: scale(0.97);
        }

        @media (max-width: 540px) {
          .gtt-btn { top: 10px; left: 10px; }
        }
      `}</style>
    </button>
  )
}
