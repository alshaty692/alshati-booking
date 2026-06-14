'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminRole } from '@/types'

interface Props { role: AdminRole; userName: string; userEmail: string }

const NAV = [
  { href:'/admin',              icon:'📊', label:'الرئيسية',   roles:['admin','editor','viewer'] },
  { href:'/admin/bookings',     icon:'📋', label:'الحجوزات',   roles:['admin','editor','viewer'] },
  { href:'/admin/bookings/new', icon:'✏️', label:'حجز يدوي',   roles:['admin','editor'] },
  { href:'/admin/customers',    icon:'👥', label:'العملاء',    roles:['admin','editor','viewer'] },
  { href:'/admin/codes',        icon:'🏷️', label:'الأكواد',    roles:['admin','editor'] },
  { href:'/admin/availability', icon:'🔒', label:'التوافر',    roles:['admin','editor'] },
  { href:'/admin/reports',      icon:'📈', label:'التقارير',   roles:['admin','editor','viewer'] },
  { href:'/admin/settings',     icon:'⚙️', label:'الإعدادات',  roles:['admin'] },
]

export default function AdminSidebar({ role, userName, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // أغلق الـ drawer عند تغيير المسار
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // أغلق الـ drawer عند الضغط خارجه
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.mobile-drawer') && !target.closest('.hamburger-btn')) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [drawerOpen])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const visibleNav = NAV.filter(item => item.roles.includes(role))
  const initials = userName.charAt(0).toUpperCase()

  return (
    <>
      {/* ── السايدبار الدسكتوب ── */}
      <nav className="sidebar" aria-label="قائمة الإدارة">

        {/* شعار */}
        <div className="sidebar-logo" title="مركز حي الشاطئ">
          <span className="sidebar-logo-icon">🏟️</span>
        </div>

        {/* روابط */}
        <div className="sidebar-nav">
          {visibleNav.map(item => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`sidebar-${item.href.replace(/\//g,'-')}`}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                data-tooltip={item.label}
                aria-label={item.label}
              >
                <span style={{ fontSize:'1.3rem', lineHeight:1 }}>{item.icon}</span>
              </Link>
            )
          })}
        </div>

        {/* المستخدم */}
        <div className="sidebar-user">
          <div style={{ position:'relative' }}>
            <button
              id="btn-sidebar-user"
              className="sidebar-user-btn"
              onClick={() => setShowLogout(v => !v)}
              title={`${userName} (${userEmail})`}
              aria-label="خيارات المستخدم"
            >
              {initials}
            </button>

            {showLogout && (
              <div style={{
                position:'absolute', left:'calc(100% + 10px)', bottom:0,
                background:'#1B2A3B', border:'1px solid rgba(201,169,110,.3)',
                borderRadius:'0.625rem', padding:'0.75rem', minWidth:180,
                boxShadow:'0 8px 24px rgba(0,0,0,.4)', zIndex:300,
              }}>
                <div style={{ fontSize:'0.8rem', color:'#C9A96E', fontWeight:700, marginBottom:'0.25rem' }}>{userName}</div>
                <div style={{ fontSize:'0.72rem', color:'#64748b', marginBottom:'0.75rem', direction:'ltr' }}>{userEmail}</div>
                <button
                  id="btn-admin-logout"
                  onClick={handleLogout}
                  style={{
                    width:'100%', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)',
                    color:'#fca5a5', borderRadius:'0.4rem', padding:'0.4rem 0.75rem',
                    fontSize:'0.82rem', fontWeight:700, cursor:'pointer',
                    fontFamily:'Tajawal, sans-serif',
                  }}
                >
                  🚪 تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ══ هيدر الجوال ══ */}
      <header className="mobile-header">
        <span className="mobile-header-logo">🏟️ مركز حي الشاطئ</span>
        <button
          className="hamburger-btn"
          aria-label="القائمة"
          onClick={() => setDrawerOpen(v => !v)}
        >
          {drawerOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ══ Drawer الجوال ══ */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <span>🏟️</span>
          <span style={{ fontWeight:800, color:'#C9A96E' }}>مركز حي الشاطئ</span>
        </div>

        <nav className="mobile-drawer-nav">
          {visibleNav.map(item => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-drawer-link ${isActive ? 'active' : ''}`}
                onClick={() => setDrawerOpen(false)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mobile-drawer-footer">
          <div style={{ fontSize:'0.8rem', color:'#C9A96E', fontWeight:700 }}>{userName}</div>
          <div style={{ fontSize:'0.72rem', color:'#64748b', marginBottom:'0.5rem' }}>{userEmail}</div>
          <button
            onClick={handleLogout}
            style={{
              width:'100%', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)',
              color:'#fca5a5', borderRadius:'0.5rem', padding:'0.5rem',
              fontSize:'0.85rem', fontWeight:700, cursor:'pointer',
              fontFamily:'Tajawal, sans-serif',
            }}
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    </>
  )
}
