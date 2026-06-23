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

  useEffect(() => {
    const handler = () => {
      try { setExpanded(localStorage.getItem(LS_KEY) === '1') } catch {}
    }
    handler()
    window.addEventListener('storage', handler)
    const interval = setInterval(handler, 200)
    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="admin-layout">
      <AdminSidebar role={role} userName={userName} userEmail={userEmail} />
      {/*
        marginRight يتحكم فيه CSS فقط:
        - globals.css → .admin-main { margin-right: 64px }  (≥769px)
        - globals.css → @media(max-width:768px) { .admin-main { margin-right: 0 !important } }
        - عند التوسيع نضيف class sb-expanded لـ body
      */}
      <main
        className={`admin-main${expanded ? ' admin-main--expanded' : ''}`}
      >
        {children}
      </main>
    </div>
  )
}

