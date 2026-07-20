// GET /api/settings — جلب الإعدادات العامة (للعميل)
import { createClient } from '@/lib/supabase/server'

// force-dynamic: يمنع Next.js من تحويل الـ route لـ static
export const dynamic = 'force-dynamic'

const PUBLIC_KEYS = [
  'facility_name', 'facility_phone', 'whatsapp_number', 'facility_location',
  'bank_name', 'bank_account_name', 'bank_iban', 'bank_account_number',
  'closure_active', 'closure_message', 'closure_return_date', 'closure_reason',
  'closure_full_active', 'closure_full_start', 'closure_full_title', 'closure_full_message',
  'price_football_normal', 'price_volleyball_normal', 'price_multi_normal',
  'booking_window_days', 'max_pending_bookings', 'pending_expiry_hours',
  'water_price_per_carton', 'water_max_cartons', 'water_stock_available', 'water_stock_enabled',
  'venue_1_name', 'venue_2_name', 'venue_3_name',
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('settings').select('key, value').in('key', PUBLIC_KEYS)
    const settings: Record<string, string> = {}
    data?.forEach(r => { if (r.key && r.value !== null) settings[r.key] = r.value })
    return Response.json(
      { settings },
      // no-store: يمنع المتصفح وأي CDN/Edge من تخزين الإعدادات — تُقرأ Fresh بكل طلب
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return Response.json({ settings: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

