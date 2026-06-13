// ============================================================
// API Route — تصدير Excel للحجوزات
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getCourtName, getPeriodName, formatAmount } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    // التحقق من صلاحية الإدارة
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('غير مصرّح', { status: 401 })

    // جلب كل الحجوزات
    const admin = createAdminClient()
    const { data: bookings } = await admin
      .from('bookings')
      .select('booking_date,court_id,period_number,customer_name,customer_phone,status,code_used,base_price,discount_amount,final_price,is_manual,confirmed_at,created_at')
      .order('created_at', { ascending: false })

    // تحويل للـ Excel
    const STATUS_LABELS: Record<string, string> = {
      pending:'بانتظار الإيصال', uploaded:'قيد المراجعة', confirmed:'مؤكد',
      rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي',
    }

    const rows = (bookings ?? []).map(b => ({
      'التاريخ':        b.booking_date,
      'الملعب':         getCourtName(b.court_id),
      'الفترة':         getPeriodName(b.period_number),
      'الاسم':          b.customer_name,
      'الجوال':         b.customer_phone,
      'الحالة':         STATUS_LABELS[b.status] ?? b.status,
      'الكود':          b.code_used ?? '',
      'السعر الأصلي':   b.base_price,
      'الخصم':          b.discount_amount,
      'المبلغ النهائي': b.final_price,
      'يدوي':           b.is_manual ? 'نعم' : 'لا',
      'تاريخ الحجز':    b.created_at?.split('T')[0] ?? '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'الحجوزات')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `alshati-bookings-${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[export-excel]', err)
    return new Response('فشل التصدير', { status: 500 })
  }
}
