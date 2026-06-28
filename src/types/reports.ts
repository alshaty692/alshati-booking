// ============================================================
// أنواع TypeScript لقسم التقارير — النسخة الجديدة
// مصدر الحقيقة الوحيد: هذا الملف
// ============================================================

// ── الفلاتر ──────────────────────────────────────────────────
export type TimePreset = 'today' | 'week' | 'month' | 'year' | 'custom'
export type CourtFilter = 'all' | 'football' | 'volleyball' | 'multi'
export type StatusFilter = 'all' | 'confirmed' | 'pending' | 'uploaded' | 'cancelled' | 'rejected' | 'expired'

export interface FilterState {
  preset:     TimePreset
  from:       string
  to:         string
  court:      CourtFilter
  status:     StatusFilter
}

// ── بيانات الحجز الخام (للجداول) ────────────────────────────
export interface BookingRow {
  id:               string
  booking_date:     string
  court_id:         string
  period_number:    number
  customer_phone:   string
  customer_name:    string
  code_used:        string | null
  base_price:       number
  discount_amount:  number
  final_price:      number
  water_quantity:   number
  status:           string
  is_manual:        boolean
  confirmed_at:     string | null
  created_at:       string
}

// ── بيانات الـ API Response ──────────────────────────────────
export interface ReportMeta {
  from:                  string
  to:                    string
  generated_at:          string
  water_price_per_carton: number
  court_filter:          CourtFilter
  status_filter:         StatusFilter
}

export interface ReportKpis {
  total_revenue:          number   // SUM(final_price) confirmed — المُفوتَر
  total_discount:         number   // SUM(discount_amount) confirmed
  total_base:             number   // SUM(base_price) confirmed
  water_revenue:          number   // SUM(water_quantity) * price
  confirmed_count:        number
  total_count:            number
  avg_booking_value:      number
  cancellation_rate:      number   // نسبة مئوية 0-100
  // حقول التحصيل الفعلي — من جداول payments + invoices
  total_collected:        number   // SUM(payments.amount) في الفترة — المحصّل فعلياً
  total_balance_due:      number   // مجموع المتبقي من فواتير غير مكتملة السداد
  partial_invoices_count: number   // عدد الفواتير بحالة partial
}

export interface CourtFinancial {
  court_id:      string
  name:          string
  count:         number
  base:          number
  discount:      number
  revenue:       number
  water_revenue: number
}

export interface DayRevenue {
  date:    string
  revenue: number
  count:   number
}

export interface StatusBreakdown {
  confirmed:  number
  pending:    number
  uploaded:   number
  cancelled:  number
  rejected:   number
  expired:    number
}

export interface ReportFinancial {
  by_court:         CourtFinancial[]
  by_day:           DayRevenue[]
  status_breakdown: StatusBreakdown
}

export interface ReportBookings {
  total:         number
  by_period:     Record<string, number>   // "1" | "2" | "3"
  manual_count:  number
  online_count:  number
  details:       BookingRow[]
}

export interface CustomerEntry {
  phone:              string
  name:               string
  count:              number
  revenue:            number
  classification:     string | null   // new | regular | gold | inactive | null
  is_vip:             boolean
  preferred_court:    string | null
  first_booking_at:   string | null   // من جدول customers (حقيقي)
}

export interface ReportCustomers {
  total_unique:      number
  new_customers:     number   // first_booking_at >= from (حقيقي)
  repeat_customers:  number
  repeat_rate:       number   // نسبة مئوية
  avg_rating:        number | null   // AVG(rating) من booking_ratings للفترة
  top_list:          CustomerEntry[]
}

export interface CodeEntry {
  code:           string
  count:          number
  total_discount: number
  total_revenue:  number
  max_uses:       number | null
  is_active:      boolean
  discount_type:  string | null
  discount_value: number | null
}

export interface ReportCodes {
  unique_codes_used:  number
  total_uses:         number
  total_discount:     number
  usage_rate:         number   // نسبة من المؤكدة
  details:            CodeEntry[]
}

// خلية في الخريطة الحرارية
export interface HeatCell {
  booked: number
  total:  number
  pct:    number
}

// هيكل الخريطة: يوم (0-6) → فترة (1-3) → خلية
export type HeatGrid = Record<number, Record<number, HeatCell>>

export interface ReportHeatmap {
  all:        HeatGrid
  football:   HeatGrid
  volleyball: HeatGrid
  multi:      HeatGrid
}

export interface ReportOperations {
  occupancy_rate:            number   // % الإشغال الكلي
  top_day:                   { date: string; count: number } | null
  top_period:                { period: number; count: number } | null
  top_court:                 { court_id: string; count: number } | null
  avg_confirmation_minutes:  number
}

// الـ Response الكامل
export interface ReportData {
  meta:            ReportMeta
  kpis:            ReportKpis
  financial:       ReportFinancial
  bookings_report: ReportBookings
  customers:       ReportCustomers
  codes:           ReportCodes
  heatmap:         ReportHeatmap
  operations:      ReportOperations
}
