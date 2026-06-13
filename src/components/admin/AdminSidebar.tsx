'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const visibleNav = NAV.filter(item => item.roles.includes(role))

  // أول حرف من الاسم لأيقونة المستخدم
  const initials = userName.charAt(0).toUpperCase()

  return (
    <nav className="sidebar" aria-label="قائمة الإدارة">

      {/* ── شعار المركز ── */}
      <div className="sidebar-logo" title="مركز حي الشاطئ">
        <span className="sidebar-logo-icon">🏟️</span>
      </div>

      {/* ── روابط التنقل ── */}
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

      {/* ── زر المستخدم / تسجيل الخروج ── */}
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

          {/* Popover خروج */}
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
                  fontSize:'0.82rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
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
  )
}
