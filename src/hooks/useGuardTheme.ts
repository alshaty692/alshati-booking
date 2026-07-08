'use client'
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

// مفتاح منفصل عن الأدمن — لا تعارض
const GUARD_STORAGE_KEY = 'guard-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useGuardTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted]  = useState(false)

  useEffect(() => {
    // قراءة guard-theme أولاً، ثم alshati-theme كـ fallback، ثم النظام
    const stored =
      (localStorage.getItem(GUARD_STORAGE_KEY) as Theme | null) ??
      (localStorage.getItem('alshati-theme')   as Theme | null) ??
      getSystemTheme()

    setThemeState(stored)
    applyTheme(stored)
    setMounted(true)

    // مراقبة تغيير تفضيل النظام — فقط لو لم يختر الحارس يدوياً
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(GUARD_STORAGE_KEY)) {
        const next: Theme = e.matches ? 'light' : 'dark'
        setThemeState(next)
        applyTheme(next)
      }
    }

    mq.addEventListener('change', handleSystemChange)
    return () => mq.removeEventListener('change', handleSystemChange)
  }, [])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    localStorage.setItem(GUARD_STORAGE_KEY, next)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return { theme, toggle, mounted }
}
