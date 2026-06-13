// ============================================================
// أنواع TypeScript لكل الجداول — مركز حي الشاطئ
// ============================================================

export type Court = 'football' | 'volleyball' | 'multi'
export type Period = 1 | 2 | 3
export type BookingStatus = 'pending' | 'uploaded' | 'confirmed' | 'rejected' | 'cancelled' | 'expired'
export type AdminRole = 'admin' | 'editor' | 'viewer'
export type CustomerClassification = 'gold' | 'regular' | 'inactive' | 'new'
export type CodeType = 'permanent' | 'charity' | 'free' | 'custom'
export type DiscountType = 'percent' | 'fixed' | 'free'
export type ContactType = 'whatsapp' | 'call' | 'sms' | 'other'
export type SuspendType = 'manual' | 'holiday' | 'maintenance' | 'event'

// أسماء الملاعب بالعربي
export const COURT_LABELS: Record<Court, string> = {
  football: 'كرة القدم',
  volleyball: 'الكرة الطائرة',
  multi: 'الملعب المتعدد',
}

// أسماء الفترات
export const PERIOD_LABELS: Record<Period, string> = {
  1: '5–7م',
  2: '7–9م',
  3: '9–11م',
}

// ألوان حالات الحجز
export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'بانتظار الإيصال',
  uploaded: 'بانتظار الاعتماد',
  confirmed: 'مؤكد',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
  expired: 'منتهية المهلة',
}

export const CLASSIFICATION_LABELS: Record<CustomerClassification, string> = {
  gold: 'ذهبي ⭐',
  regular: 'منتظم',
  inactive: 'غير نشط',
  new: 'جديد',
}

// ============================================================
// Database Types (مطابقة لجداول Supabase)
// ============================================================

export interface Setting {
  id: string
  key: string
  value: string | null
  label: string | null
  group_name: string | null
  updated_at: string
}

export interface Booking {
  id: string
  booking_date: string          // YYYY-MM-DD
  court_id: Court
  period_number: Period
  customer_phone: string
  customer_name: string
  code_used: string | null
  base_price: number
  discount_amount: number
  final_price: number
  status: BookingStatus
  receipt_url: string | null
  receipt_uploaded_at: string | null
  rejection_reason: string | null
  internal_note: string | null
  is_manual: boolean
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  phone: string
  name: string
  total_bookings: number
  total_paid: number
  first_booking_at: string | null
  last_booking_at: string | null
  preferred_court: Court | null
  preferred_period: string | null
  preferred_code_type: CodeType | null
  classification: CustomerClassification
  is_vip: boolean
  is_suspended: boolean
  suspension_reason: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface Code {
  id: string
  code: string
  code_type: CodeType
  discount_type: DiscountType
  discount_value: number
  court_id: Court | null
  max_uses: number | null
  used_count: number
  total_revenue: number
  is_active: boolean
  expires_at: string | null
  customer_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Suspension {
  id: string
  court_id: Court | null
  suspend_date: string
  period_number: Period | null
  reason: string
  suspend_type: SuspendType
  created_by: string | null
  created_at: string
}

export interface CustomerContactLog {
  id: string
  customer_phone: string
  contacted_at: string
  contact_type: ContactType
  offer_sent: string | null
  notes: string | null
  created_by: string | null
}

export interface Payment {
  id: string
  customer_phone: string
  booking_id: string | null
  amount_paid: number
  payment_date: string
  payment_method: string
  outstanding_balance: number
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string | null
  action: 'insert' | 'update' | 'delete' | 'login' | 'export'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  performed_by: string | null
  performed_at: string
  ip_address: string | null
  notes: string | null
}

export interface AdminUser {
  id: string
  role: AdminRole
  full_name: string | null
  created_at: string
}

// ============================================================
// View Types
// ============================================================

export interface AvailableSlot {
  day_date: string
  court_id: Court
  period_number: Period
  is_available: boolean
}

export interface DashboardStats {
  revenue_this_week: number
  revenue_this_month: number
  bookings_today: number
  pending_approval: number
  top_court_this_month: Court | null
}

// ============================================================
// API Response Types
// ============================================================

export interface PriceCalculation {
  base_price: number
  discount_amount: number
  final_price: number
  code_type?: CodeType
  error?: string
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

// ============================================================
// Settings Keys (للاستخدام الآمن)
// ============================================================

export type SettingKey =
  | 'facility_name' | 'facility_city' | 'whatsapp_number' | 'booking_window_days'
  | 'bank_name' | 'bank_account_name' | 'bank_iban' | 'bank_account_number'
  | 'receipt_timeout_hours' | 'max_pending_per_phone'
  | 'gold_min_bookings' | 'gold_min_days' | 'inactive_days'
  | 'period_1_label' | 'period_1_start' | 'period_1_end'
  | 'period_2_label' | 'period_2_start' | 'period_2_end'
  | 'period_3_label' | 'period_3_start' | 'period_3_end'
  | 'price_football_normal' | 'price_football_permanent' | 'price_football_charity'
  | 'price_volleyball_normal' | 'price_volleyball_permanent' | 'price_volleyball_charity'
  | 'price_multi_normal' | 'price_multi_permanent' | 'price_multi_charity'
