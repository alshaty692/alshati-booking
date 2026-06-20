'use client'
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'alshati-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // قراءة الثيم المحفوظ، أو التفضيل من النظام كـ fallback
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const resolved: Theme = stored ?? getSystemTheme()

    setThemeState(resolved)
    applyTheme(resolved)
    setMounted(true)

    // مراقبة تغيير تفضيل النظام — تنفّذ فقط إذا لم يكن هناك اختيار يدوي محفوظ
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
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
    localStorage.setItem(STORAGE_KEY, next)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, toggle, mounted }
}
