'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminRole } from '@/types'
import {
  LayoutDashboard, ClipboardList, PenLine, Users, Tag,
  CalendarDays, BarChart2, Settings2, AlignJustify, X,
  LogOut, ChevronRight, Package, Receipt, ShieldCheck, Briefcase,
  BarChart3, ChevronDown, DollarSign,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

interface Props { role: AdminRole; userName: string; userEmail: string }

// ── روابط عادية ─────────────────────────────────────────────

const NAV = [
  { href: '/admin',               Icon: LayoutDashboard, label: 'الرئيسية',   roles: ['admin','editor','viewer'] },
  { href: '/admin/bookings',      Icon: ClipboardList,   label: 'الحجوزات',   roles: ['admin','editor','viewer'] },
  { href: '/admin/bookings/new',  Icon: PenLine,         label: 'حجز يدوي',   roles: ['admin','editor'] },
  { href: '/admin/batch-booking', Icon: Package,         label: 'حجز متعدد',  roles: ['admin','editor'] },
  { href: '/admin/customers',     Icon: Users,           label: 'العملاء',    roles: ['admin','editor','viewer'] },
  { href: '/admin/codes',         Icon: Tag,             label: 'الأكواد',    roles: ['admin','editor'] },
  { href: '/admin/availability',  Icon: CalendarDays,    label: 'التوافر',    roles: ['admin','editor'] },
  { href: '/admin/reports',       Icon: BarChart2,       label: 'التقارير',   roles: ['admin','editor','viewer'] },
]

// ── روابط مجموعة المحاسبة ───────────────────────────────────

const ACCOUNTING_NAV = [
  { href: '/admin/accounting',    Icon: DollarSign,  label: 'نظرة عامة',          roles: ['admin'] },
  { href: '/admin/invoices',      Icon: Receipt,     label: 'الفواتير',            roles: ['admin','editor','viewer'] },
  { href: '/admin/employees',     Icon: Briefcase,   label: 'الفريق الميداني',    roles: ['admin'] },
  { href: '/admin/commissions',   Icon: BarChart3,   label: 'العمولات',            roles: ['admin'] },
]

// ── روابط الإعدادات ─────────────────────────────────────────

const SETTINGS_NAV = [
  { href: '/admin/users',     Icon: ShieldCheck, label: 'المستخدمون', roles: ['admin'] },
  { href: '/admin/settings',  Icon: Settings2,   label: 'الإعدادات',  roles: ['admin'] },
]

const LS_KEY          = 'admin_sidebar_expanded'
const LS_ACCOUNTING   = 'admin_accounting_group_open'

// ── مسارات المحاسبة لفحص الـ active state ──────────────────

const ACCOUNTING_PATHS = ACCOUNTING_NAV.map(n => n.href)

export default function AdminSidebar({ role, userName, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showLogout,        setShowLogout]       = useState(false)
  const [open,              setOpen]             = useState(false)      // mobile drawer
  const [expanded,          setExpanded]         = useState(false)      // desktop expand/collapse
  const [accountingOpen,    setAccountingOpen]   = useState(false)      // مجموعة المحاسبة

  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY)        === '1') setExpanded(true)
      if (localStorage.getItem(LS_ACCOUNTING) === '1') setAccountingOpen(true)
    } catch {}
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const toggleAccounting = useCallback(() => {
    setAccountingOpen(prev => {
      const next = !prev
      try { localStorage.setItem(LS_ACCOUNTING, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  // افتح مجموعة المحاسبة تلقائياً لو الصفحة الحالية ضمنها
  useEffect(() => {
    if (ACCOUNTING_PATHS.some(p => pathname.startsWith(p))) {
      setAccountingOpen(true)
    }
  }, [pathname])

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

  const visibleNav           = NAV.filter(item => item.roles.includes(role))
  const visibleAccountingNav = ACCOUNTING_NAV.filter(item => item.roles.includes(role))
  const visibleSettingsNav   = SETTINGS_NAV.filter(item => item.roles.includes(role))
  const initials             = userName.charAt(0).toUpperCase()
  const sidebarW             = expanded ? 220 : 64

  // هل أي صفحة محاسبة هي النشطة حالياً؟
  const accountingActive = ACCOUNTING_PATHS.some(p => pathname.startsWith(p))

  // ── مساعد لرسم رابط ناف ─────────────────────────────────────

  const renderNavLink = ({ href, Icon, label }: { href: string; Icon: React.ElementType; label: string }, key: string) => {
    const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
    return (
      <Link
        key={key}
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
  }

  // ── مساعد لرسم زر ناف في الـ drawer ─────────────────────────

  const renderDrawerBtn = ({ href, Icon, label }: { href: string; Icon: React.ElementType; label: string }, key: string) => {
    const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
    return (
      <button
        key={key}
        onClick={() => handleNavClick(href)}
        className={`mb-nav-item ${isActive ? 'mb-nav-item-active' : ''}`}
      >
        <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
        <span>{label}</span>
      </button>
    )
  }

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

        {/* nav items — الروابط العادية */}
        <div className="sb-nav">
          {visibleNav.map(item => renderNavLink(item, item.href))}

          {/* ── مجموعة المحاسبة ── */}
          {visibleAccountingNav.length > 0 && (
            <div className="sb-group">
              <button
                id="sidebar-accounting-toggle"
                className={`sb-group-trigger ${accountingActive ? 'sb-group-trigger-active' : ''}`}
                onClick={toggleAccounting}
                data-tooltip="المحاسبة"
                aria-label="قسم المحاسبة"
                aria-expanded={accountingOpen}
              >
                <DollarSign size={18} strokeWidth={accountingActive ? 2.25 : 1.75} className="sb-link-icon" />
                {expanded && (
                  <>
                    <span className="sb-link-label">المحاسبة</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      className="sb-group-chevron"
                      style={{ transform: accountingOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </>
                )}
              </button>

              {/* روابط المجموعة */}
              {(accountingOpen || !expanded) && (
                <div className={`sb-group-items ${expanded ? 'sb-group-items-expanded' : ''}`}>
                  {visibleAccountingNav.map(item => renderNavLink(item, `acc-${item.href}`))}
                </div>
              )}
            </div>
          )}

          {/* روابط الإعدادات */}
          {visibleSettingsNav.map(item => renderNavLink(item, item.href))}
        </div>

        {/* user + theme */}
        <div className="sb-footer">
          {expanded && (
            <div className="sb-theme-row">
              <ThemeToggle />
            </div>
          )}

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
        <div className="mb-drawer-head">
          <span className="mb-drawer-logo">حي الشاطئ</span>
          <button className="mb-drawer-close" onClick={closeDrawer} aria-label="إغلاق">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <nav className="mb-drawer-nav">
          {/* روابط عادية */}
          {visibleNav.map(item => renderDrawerBtn(item, item.href))}

          {/* مجموعة المحاسبة */}
          {visibleAccountingNav.length > 0 && (
            <>
              <div className="mb-group-label">
                <DollarSign size={13} strokeWidth={2} />
                <span>المحاسبة</span>
              </div>
              <div className="mb-group-items">
                {visibleAccountingNav.map(item => renderDrawerBtn(item, `m-acc-${item.href}`))}
              </div>
            </>
          )}

          {/* روابط الإعدادات */}
          {visibleSettingsNav.map(item => renderDrawerBtn(item, item.href))}
        </nav>

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

      {/* ── Styles لمجموعة المحاسبة ── */}
      <style>{`
        /* مجموعة الناف */
        .sb-group { position: relative; }

        .sb-group-trigger {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: 0.45rem 0.75rem;
          border-radius: var(--radius-md);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          transition: background 0.15s, color 0.15s;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
        }
        .sb-group-trigger:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }
        .sb-group-trigger-active {
          color: var(--color-lime) !important;
          background: var(--color-lime-muted) !important;
        }
        .sb-group-chevron { margin-right: auto; flex-shrink: 0; }

        /* روابط داخل المجموعة */
        .sb-group-items { display: flex; flex-direction: column; gap: 1px; }
        .sb-group-items-expanded .sb-link {
          padding-right: 2rem !important;
          font-size: var(--text-xs) !important;
        }

        /* Mobile group label */
        .mb-group-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4) var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .mb-group-items { margin-bottom: var(--space-2); }
        .mb-group-items .mb-nav-item {
          padding-right: 2.25rem !important;
          font-size: var(--text-sm) !important;
        }
      `}</style>
    </>
  )
}
