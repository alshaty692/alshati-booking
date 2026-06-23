'use client'
import { useState, useEffect } from 'react'
import AdminSidebar from './AdminSidebar'
import type { AdminRole } from '@/types'

const LS_KEY = 'admin_sidebar_expanded'

interface Props {
  role: AdminRole
  userName: string
  userEmail: string
  children: React.ReactNode
}

export default function AdminShell({ role, userName, userEmail, children }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // كشف حجم الشاشة — يُصفّر الـ margin على الجوال
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const mqHandler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', mqHandler)

    // مزامنة expanded مع localStorage
    const handler = () => {
      try { setExpanded(localStorage.getItem(LS_KEY) === '1') } catch {}
    }
    handler()
    window.addEventListener('storage', handler)
    const interval = setInterval(handler, 200)

    return () => {
      mq.removeEventListener('change', mqHandler)
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  // على الجوال لا margin (الـ sidebar مخفي ويُعوّض بـ mobile header)
  const marginRight = isMobile ? 0 : (expanded ? 220 : 64)

  return (
    <div className="admin-layout">
      <AdminSidebar role={role} userName={userName} userEmail={userEmail} />
      <main className="admin-main" style={{ marginRight }}>
        {children}
      </main>
    </div>
  )
}
