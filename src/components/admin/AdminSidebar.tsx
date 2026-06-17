'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
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

const LS_KEY = 'admin_sidebar_expanded'

export default function AdminSidebar({ role, userName, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const [open, setOpen] = useState(false)                    // mobile drawer
  const [expanded, setExpanded] = useState(false)             // desktop sidebar

  // استرجاع حالة الـ sidebar من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === '1') setExpanded(true)
    } catch {}
  }, [])

  // حفظ حالة الـ sidebar
  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  // أغلق drawer عند تغيير المسار
  useEffect(() => { setOpen(false) }, [pathname])

  // منع تمرير الـ body عند فتح القائمة
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const closeDrawer = useCallback(() => {
    setOpen(false)
    document.body.style.overflow = ''
  }, [])

  const handleNavClick = useCallback((href: string) => {
    closeDrawer()
    router.push(href)
  }, [router, closeDrawer])

  async function handleLogout() {
    closeDrawer()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const visibleNav = NAV.filter(item => item.roles.includes(role))
  const initials = userName.charAt(0).toUpperCase()
  const sidebarWidth = expanded ? 220 : 64

  return (
    <>
      {/* ══ السايدبار — دسكتوب فقط ══ */}
      <nav
        className={`sidebar ${expanded ? 'sidebar-expanded' : ''}`}
        aria-label="قائمة الإدارة"
        style={{ width: sidebarWidth }}
      >
        {/* زر toggle + شعار */}
        <div className="sidebar-logo">
          <button
            className="sidebar-toggle"
            onClick={toggleExpanded}
            aria-label={expanded ? 'طي القائمة' : 'توسيع القائمة'}
            title={expanded ? 'طي القائمة' : 'توسيع القائمة'}
          >
            ☰
          </button>
          {expanded && (
            <span className="sidebar-logo-text">مركز حي الشاطئ</span>
          )}
        </div>

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
                <span className="sidebar-link-icon">{item.icon}</span>
                {expanded && <span className="sidebar-link-label">{item.label}</span>}
              </Link>
            )
          })}
        </div>

        <div className="sidebar-user">
          <div style={{ position:'relative', width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
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
                position:'absolute', left: expanded ? 'auto' : 'calc(100% + 10px)',
                right: expanded ? 0 : 'auto',
                bottom: expanded ? '100%' : 0,
                marginBottom: expanded ? '0.5rem' : 0,
                background:'#1B2A3B', border:'1px solid rgba(201,169,110,.3)',
                borderRadius:'0.625rem', padding:'0.75rem', minWidth:180,
                boxShadow:'0 8px 24px rgba(0,0,0,.4)', zIndex:300,
              }}>
                <div style={{ fontSize:'0.8rem', color:'#C9A96E', fontWeight:700, marginBottom:'0.25rem' }}>{userName}</div>
                <div style={{ fontSize:'0.72rem', color:'#64748b', marginBottom:'0.75rem', direction:'ltr' as const }}>{userEmail}</div>
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
          onClick={() => setOpen(v => !v)}
        >
          {open ? '✕' : '☰'}
        </button>
      </header>

      {/* ══ Overlay ══ */}
      {open && (
        <div
          onClick={closeDrawer}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9998,
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ══ Drawer الجوال ══ */}
      <div
        className="mobile-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: open ? 0 : -300,
          width: 280,
          height: '100dvh',
          background: '#1B2A3B',
          zIndex: 9999,
          transition: 'right 0.28s cubic-bezier(.4,0,.2,1)',
          boxShadow: open ? '-8px 0 32px rgba(0,0,0,.5)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0 1.25rem', borderBottom: '1px solid rgba(201,169,110,.2)',
          fontSize: '1.1rem', flexShrink: 0,
        }}>
          <span>🏟️</span>
          <span style={{ fontWeight:800, color:'#C9A96E', fontFamily:'Tajawal, sans-serif' }}>مركز حي الشاطئ</span>
        </div>

        <nav style={{ padding:'0.75rem 0', overflowY:'auto' }}>
          {visibleNav.map(item => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                style={{
                  display:'flex', alignItems:'center', gap:'0.875rem',
                  width:'100%', padding:'0.875rem 1.25rem',
                  background: isActive ? 'rgba(201,169,110,.15)' : 'transparent',
                  border:'none',
                  borderRight: isActive ? '3px solid #C9A96E' : '3px solid transparent',
                  color: isActive ? '#C9A96E' : 'rgba(255,255,255,.65)',
                  fontFamily:'Tajawal, sans-serif', fontSize:'0.95rem', fontWeight:600,
                  cursor:'pointer', textAlign:'right',
                }}
              >
                <span style={{ fontSize:'1.2rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={{
          padding:'1rem 1.25rem', borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0,
        }}>
          <div style={{ fontSize:'0.8rem', color:'#C9A96E', fontWeight:700, marginBottom:'0.15rem' }}>{userName}</div>
          <div style={{ fontSize:'0.72rem', color:'#64748b', marginBottom:'0.5rem', direction:'ltr' as const }}>{userEmail}</div>
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
