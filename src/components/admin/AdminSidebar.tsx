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
          <ThemeToggle className="mb-theme-btn" iconSize={16} />
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

    </>
  )
}
