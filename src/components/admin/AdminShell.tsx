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

  // مزامنة مع localStorage
  useEffect(() => {
    const handler = () => {
      try {
        setExpanded(localStorage.getItem(LS_KEY) === '1')
      } catch {}
    }
    handler() // initial
    window.addEventListener('storage', handler)
    // نستمع لأي تغيير من الـ sidebar
    const interval = setInterval(handler, 200)
    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  const sidebarWidth = expanded ? 220 : 64

  return (
    <div className="admin-layout">
      <AdminSidebar role={role} userName={userName} userEmail={userEmail} />
      <main
        className="admin-main"
        style={{ marginRight: sidebarWidth }}
      >
        {children}
      </main>
    </div>
  )
}
