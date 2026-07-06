'use client'
// ============================================================
// HeaderMenu — قائمة الهيدر المنسدلة لصفحة الحجز
// مستخرج من book/page.tsx — props بالضبط كما كانت
// ============================================================
import { useState, useEffect, useRef } from 'react'
import {
  BookOpen, MapPin, MessageCircle, Phone, MoreHorizontal,
} from 'lucide-react'

interface HeaderMenuProps {
  onMyBookings: () => void
  settings: Record<string, string>
}

export default function HeaderMenu({ onMyBookings, settings }: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // إغلاق عند الضغط خارج القائمة
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const mapUrl       = settings.facility_location || ''
  const whatsappNum  = (settings.whatsapp_number || '').replace(/\D/g, '')
  const phoneNum     = settings.facility_phone || ''

  const items = [
    {
      id: 'my-bookings',
      label: 'حجوزاتي',
      Icon: BookOpen,
      action: () => { setOpen(false); onMyBookings() },
      show: true,
    },
    {
      id: 'map-link',
      label: 'موقعنا على الخريطة',
      Icon: MapPin,
      action: () => { setOpen(false); window.open(mapUrl, '_blank', 'noopener') },
      show: Boolean(mapUrl),
    },
    {
      id: 'whatsapp-link',
      label: 'تواصل عبر واتساب',
      Icon: MessageCircle,
      action: () => { setOpen(false); window.open(`https://wa.me/${whatsappNum}`, '_blank', 'noopener') },
      show: Boolean(whatsappNum),
    },
    {
      id: 'phone-link',
      label: `اتصل بنا${phoneNum ? ` — ${phoneNum}` : ''}`,
      Icon: Phone,
      action: () => { setOpen(false); window.location.href = `tel:${phoneNum}` },
      show: Boolean(phoneNum),
    },
  ].filter(i => i.show)

  return (
    <div className="hdm-wrap" ref={ref}>
      <button
        id="btn-header-menu"
        className="hdm-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="القائمة"
      >
        <MoreHorizontal size={16} strokeWidth={2} />
        <span className="hdm-trigger-label">القائمة</span>
      </button>

      {open && (
        <div className="hdm-dropdown" role="menu">
          {items.map(({ id, label, Icon, action }) => (
            <button
              key={id}
              id={id}
              className="hdm-item"
              role="menuitem"
              onClick={action}
            >
              <Icon size={15} strokeWidth={1.75} className="hdm-item-icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
