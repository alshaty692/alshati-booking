// ============================================================
// دوال مساعدة — مركز حي الشاطئ
// ============================================================
import { type ClassValue, clsx } from 'clsx'

// دمج Tailwind classes بأمان
export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

// تنسيق التاريخ بالعربي
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// تنسيق التاريخ المختصر
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ar-SA', {
    month: 'short',
    day: 'numeric',
  })
}

// تنسيق الوقت بالعربي
export function formatDateTime(isoStr: string): string {
  const date = new Date(isoStr)
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// تنسيق المبلغ
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// تحويل Date لنص YYYY-MM-DD بالتوقيت المحلي (بدل UTC)
// مهم جداً: toISOString() يُرجع UTC ويسبب فرق يوم في المنطقة الزمنية +3
export function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// الحصول على أيام الأسبوع القادمة
export function getNextDays(count: number = 7): string[] {
  const days: string[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    days.push(localDateStr(date))
  }
  return days
}

// التحقق من صحة رقم الجوال السعودي
export function isValidSaudiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s|-/g, '')
  return /^(05\d{8}|5\d{8}|\+9665\d{8})$/.test(cleaned)
}

// تنظيف رقم الجوال
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s|-|\+966/g, '')
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    return '0' + cleaned
  }
  return cleaned
}

// لون حالة الحجز
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-800',
    uploaded:  'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    rejected:  'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
    expired:   'bg-gray-100 text-gray-500',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-600'
}

// لون تصنيف العميل
export function getClassificationColor(classification: string): string {
  const colors: Record<string, string> = {
    gold:     'bg-amber-100 text-amber-800',
    regular:  'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-500',
    new:      'bg-emerald-100 text-emerald-800',
  }
  return colors[classification] ?? 'bg-gray-100 text-gray-600'
}

// توليد كود عشوائي
export function generateCode(prefix: string = 'C', length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// اسم الملعب بالعربي
export function getCourtName(courtId: string): string {
  const names: Record<string, string> = {
    football:   'كرة القدم',
    volleyball: 'الكرة الطائرة',
    multi:      'الملعب المتعدد',
  }
  return names[courtId] ?? courtId
}

// اسم الفترة بالعربي
export function getPeriodName(period: number): string {
  const names: Record<number, string> = {
    1: '5–7م',
    2: '7–9م',
    3: '9–11م',
  }
  return names[period] ?? `الفترة ${period}`
}

// فرق من الآن بالعربي (منذ / خلال)
export function timeAgo(isoStr: string): string {
  const now = new Date()
  const date = new Date(isoStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'الآن'
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`
  if (diffHours < 24) return `منذ ${diffHours} ساعة`
  if (diffDays < 30) return `منذ ${diffDays} يوم`
  return formatDateShort(isoStr)
}
