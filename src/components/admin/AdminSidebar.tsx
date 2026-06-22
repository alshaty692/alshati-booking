'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminRole } from '@/types'
import {
  LayoutDashboard, ClipboardList, PenLine, Users, Tag,
  CalendarDays, BarChart2, Settings2, AlignJustify, X,
  LogOut, ChevronRight, Package,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

interface Props { role: AdminRole; userName: string; userEmail: string }

const NAV = [
  { href: '/admin',                Icon: LayoutDashboard, label: 'الرئيسية',    roles: ['admin','editor','viewer'] },
  { href: '/admin/bookings',       Icon: ClipboardList,   label: 'الحجوزات',    roles: ['admin','editor','viewer'] },
  { href: '/admin/bookings/new',   Icon: PenLine,         label: 'حجز يدوي',    roles: ['admin','editor'] },
  { href: '/admin/batch-booking',  Icon: Package,         label: 'حجز متعدد',   roles: ['admin','editor'] },
  { href: '/admin/customers',      Icon: Users,           label: 'العملاء',     roles: ['admin','editor','viewer'] },
  { href: '/admin/codes',          Icon: Tag,             label: 'الأكواد',     roles: ['admin','editor'] },
  { href: '/admin/availability',   Icon: CalendarDays,    label: 'التوافر',     roles: ['admin','editor'] },
  { href: '/admin/reports',        Icon: BarChart2,       label: 'التقارير',    roles: ['admin','editor','viewer'] },
  { href: '/admin/settings',       Icon: Settings2,       label: 'الإعدادات',   roles: ['admin'] },
]

const LS_KEY = 'admin_sidebar_expanded'

export default function AdminSidebar({ role, userName, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const [open,     setOpen]     = useState(false)      // mobile drawer
  const [expanded, setExpanded] = useState(false)       // desktop

  useEffect(() => {
    try { if (localStorage.getItem(LS_KEY) === '1') setExpanded(true) } catch {}
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
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
  const initials   = userName.charAt(0).toUpperCase()
  const sidebarW   = expanded ? 220 : 64

  return (
    <>
      {/* ══ Desktop Sidebar ══ */}
      <nav
        className={`sb ${expanded ? 'sb-expanded' : ''}`}
        aria-label="قائمة الإدارة"
        style={{ width: sidebarW }}
      >
        {/* toggle + logo */}
        <div className="sb-logo">
          <button
            className="sb-toggle"
            onClick={toggleExpanded}
            aria-label={expanded ? 'طي القائمة' : 'توسيع القائمة'}
          >
            {expanded ? <X size={18} strokeWidth={2} /> : <AlignJustify size={18} strokeWidth={2} />}
          </button>
          {expanded && <span className="sb-logo-text">حي الشاطئ</span>}
        </div>

        {/* nav items */}
        <div className="sb-nav">
          {visibleNav.map(({ href, Icon, label }) => {
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                id={`sidebar-${href.replace(/\//g, '-')}`}
                className={`sb-link ${isActive ? 'sb-link-active' : ''}`}
                data-tooltip={label}
                aria-label={label}
              >
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="sb-link-icon" />
                {expanded && <span className="sb-link-label">{label}</span>}
                {isActive && expanded && <ChevronRight size={14} strokeWidth={2} className="sb-link-chevron" />}
              </Link>
            )
          })}
        </div>

        {/* user + theme */}
        <div className="sb-footer">
          {/* Theme toggle */}
          {expanded && (
            <div className="sb-theme-row">
              <ThemeToggle />
            </div>
          )}

          {/* User avatar */}
          <div className="sb-user-wrap">
            <button
              id="btn-sidebar-user"
              className="sb-avatar"
              onClick={() => setShowLogout(v => !v)}
              title={`${userName} (${userEmail})`}
              aria-label="خيارات المستخدم"
            >
              {initials}
            </button>

            {showLogout && (
              <div className="sb-user-popup">
                <div className="sb-user-popup-name">{userName}</div>
                <div className="sb-user-popup-email">{userEmail}</div>
                <div className="sb-user-popup-divider" />
                <button id="btn-admin-logout" className="sb-logout-btn" onClick={handleLogout}>
                  <LogOut size={13} strokeWidth={2} />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ══ Mobile Header ══ */}
      <header className="mb-header">
        <span className="mb-header-logo">حي الشاطئ</span>
        <div className="mb-header-actions">
          <ThemeToggle />
          <button
            className="mb-hamburger"
            aria-label="القائمة"
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X size={20} strokeWidth={2} /> : <AlignJustify size={20} strokeWidth={2} />}
          </button>
        </div>
      </header>

      {/* ══ Mobile Overlay ══ */}
      {open && (
        <div
          onClick={closeDrawer}
          className="mb-overlay"
          aria-hidden="true"
        />
      )}

      {/* ══ Mobile Drawer ══ */}
      <div className={`mb-drawer ${open ? 'mb-drawer-open' : ''}`} role="dialog" aria-modal="true">
        {/* Drawer header */}
        <div className="mb-drawer-head">
          <span className="mb-drawer-logo">حي الشاطئ</span>
          <button className="mb-drawer-close" onClick={closeDrawer} aria-label="إغلاق">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="mb-drawer-nav">
          {visibleNav.map(({ href, Icon, label }) => {
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => handleNavClick(href)}
                className={`mb-nav-item ${isActive ? 'mb-nav-item-active' : ''}`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Drawer footer */}
        <div className="mb-drawer-footer">
          <div className="mb-user-info">
            <div className="mb-user-name">{userName}</div>
            <div className="mb-user-email">{userEmail}</div>
          </div>
          <button className="mb-logout-btn" onClick={handleLogout}>
            <LogOut size={15} strokeWidth={2} />
            تسجيل الخروج
          </button>
        </div>
      </div>

      <style>{`
        /* ══════════════════════════════════
           Desktop Sidebar
           ══════════════════════════════════ */
        .sb {
          position: fixed;
          top: 0;
          right: 0;
          height: 100dvh;
          background: var(--bg-sidebar);
          border-left: 1px solid var(--border-sidebar);
          display: flex;
          flex-direction: column;
          z-index: 200;
          transition: width 0.25s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
          flex-shrink: 0;
        }
        @media (max-width: 768px) { .sb { display: none; } }

        /* ── شعار + toggle ── */
        .sb-logo {
          height: 64px;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 0 var(--space-4);
          border-bottom: 1px solid var(--border-sidebar);
          flex-shrink: 0;
        }
        .sb-toggle {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-sidebar);
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .sb-toggle:hover { background: var(--bg-elevated); color: var(--color-lime); }
        .sb-logo-text {
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--color-lime-dim);
          white-space: nowrap;
          overflow: hidden;
        }

        /* ── روابط التنقل ── */
        .sb-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: var(--space-2) 0;
          scrollbar-width: none;
        }
        .sb-nav::-webkit-scrollbar { display: none; }

        .sb-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-4);
          margin: 1px var(--space-2);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          text-decoration: none;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          white-space: nowrap;
          transition: background 0.15s, color 0.15s;
          /* tooltip */
        }
        .sb-link:hover { background: var(--bg-elevated); color: var(--text-primary); opacity: 1; }
        .sb-link-active {
          background: var(--color-lime-muted);
          color: var(--color-lime);
        }
        .sb-link-active:hover { background: var(--color-lime-muted); color: var(--color-lime); }
        .sb-link-icon { flex-shrink: 0; }
        .sb-link-label { flex: 1; }
        .sb-link-chevron { margin-right: auto; }

        /* tooltip للوضع المصغّر */
        .sb:not(.sb-expanded) .sb-link::after {
          content: attr(data-tooltip);
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 0.3em 0.65em;
          border-radius: var(--radius-md);
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          box-shadow: var(--shadow-md);
          transition: opacity 0.15s;
        }
        .sb:not(.sb-expanded) .sb-link:hover::after { opacity: 1; }

        /* ── فوتر ── */
        .sb-footer {
          border-top: 1px solid var(--border-sidebar);
          padding: var(--space-3) var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }
        .sb-theme-row {
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .sb-user-wrap { position: relative; }
        .sb-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: var(--color-lime-muted);
          border: 1.5px solid var(--color-lime-dim);
          color: var(--color-lime);
          font-size: var(--text-sm);
          font-weight: var(--font-black);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.15s;
        }
        .sb-avatar:hover { box-shadow: 0 0 0 3px var(--color-lime-glow); }

        /* popup */
        .sb-user-popup {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          right: 0;
          min-width: 190px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          box-shadow: var(--shadow-lg);
          z-index: 300;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        .sb-user-popup-name  { font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--color-lime-dim); }
        .sb-user-popup-email { font-size: var(--text-xs); color: var(--text-muted); direction: ltr; margin-top: 2px; }
        .sb-user-popup-divider { height: 1px; background: var(--border-subtle); margin: var(--space-2) 0; }
        .sb-logout-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          width: 100%;
          background: var(--color-danger-bg);
          border: 1px solid rgba(224,85,85,.25);
          color: var(--color-danger);
          border-radius: var(--radius-md);
          padding: var(--space-1) var(--space-3);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          transition: background 0.15s;
        }
        .sb-logout-btn:hover { background: rgba(224,85,85,.2); }

        /* ══════════════════════════════════
           Mobile Header
           ══════════════════════════════════ */
        .mb-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-sidebar);
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          z-index: 200;
          flex-shrink: 0;
        }
        @media (max-width: 768px) { .mb-header { display: flex; } }

        .mb-header-logo {
          font-size: var(--text-base);
          font-weight: var(--font-black);
          color: var(--color-lime-dim);
        }
        .mb-header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .mb-hamburger {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-sidebar);
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .mb-hamburger:hover { background: var(--bg-elevated); color: var(--color-lime); }

        /* ══════════════════════════════════
           Mobile Overlay
           ══════════════════════════════════ */
        .mb-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(3px);
          z-index: 9998;
        }

        /* ══════════════════════════════════
           Mobile Drawer
           ══════════════════════════════════ */
        .mb-drawer {
          position: fixed;
          top: 0;
          right: -300px;
          width: 280px;
          height: 100dvh;
          background: var(--bg-sidebar);
          border-left: 1px solid var(--border-sidebar);
          z-index: 9999;
          transition: right 0.28s cubic-bezier(.4,0,.2,1);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          box-shadow: none;
        }
        .mb-drawer-open {
          right: 0;
          box-shadow: -8px 0 40px rgba(0,0,0,.4);
        }

        .mb-drawer-head {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          border-bottom: 1px solid var(--border-sidebar);
          flex-shrink: 0;
        }
        .mb-drawer-logo {
          font-size: var(--text-base);
          font-weight: var(--font-black);
          color: var(--color-lime-dim);
        }
        .mb-drawer-close {
          width: 32px; height: 32px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-sidebar);
          background: transparent;
          color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .mb-drawer-close:hover { background: var(--bg-elevated); color: var(--color-lime); }

        .mb-drawer-nav {
          flex: 1;
          padding: var(--space-2) 0;
          overflow-y: auto;
        }

        .mb-nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          border: none;
          border-right: 3px solid transparent;
          background: transparent;
          color: var(--text-muted);
          font-family: 'Tajawal', sans-serif;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          text-align: right;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .mb-nav-item:hover { background: var(--bg-elevated); color: var(--text-primary); }
        .mb-nav-item-active {
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border-right-color: var(--color-lime);
        }
        .mb-nav-item-active:hover { background: var(--color-lime-muted); color: var(--color-lime); }

        .mb-drawer-footer {
          padding: var(--space-4);
          border-top: 1px solid var(--border-sidebar);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .mb-user-info {}
        .mb-user-name  { font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--color-lime-dim); }
        .mb-user-email { font-size: var(--text-xs); color: var(--text-muted); direction: ltr; }
        .mb-logout-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          background: var(--color-danger-bg);
          border: 1px solid rgba(224,85,85,.25);
          color: var(--color-danger);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          justify-content: center;
          transition: background 0.15s;
        }
        .mb-logout-btn:hover { background: rgba(224,85,85,.2); }
      `}</style>
    </>
  )
}
