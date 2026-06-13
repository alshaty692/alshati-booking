// ============================================================
// API Route — رفع الإيصال
// ============================================================
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const phone = cookieStore.get('booking_phone')?.value

    if (!phone) {
      return Response.json({ error: 'انتهت جلستك' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('receipt') as File | null
    const bookingId = formData.get('booking_id') as string

    if (!file || !bookingId) {
      return Response.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    // التحقق من أن الحجز لهذا الجوال وما زال pending
    const supabase = createAdminClient()
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, status, customer_phone')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) {
      return Response.json({ error: 'الحجز غير موجود' }, { status: 404 })
    }
    if (booking.customer_phone !== phone) {
      return Response.json({ error: 'غير مصرّح' }, { status: 403 })
    }
    if (!['pending', 'uploaded'].includes(booking.status)) {
      return Response.json({ error: 'لا يمكن رفع إيصال لهذا الحجز' }, { status: 400 })
    }

    // رفع الملف إلى Supabase Storage
    const ext = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${phone}/${bookingId}.${ext}`
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadErr) throw uploadErr

    // الحصول على الرابط (Signed URL لأن الـ bucket خاص)
    const { data: signedUrl } = await supabase.storage
      .from('receipts')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7) // صالح 7 أيام

    // تحديث الحجز → status: uploaded (لا يُؤكَّد تلقائياً — ينتظر الإدارة)
    await supabase
      .from('bookings')
      .update({
        status: 'uploaded',
        receipt_url: signedUrl?.signedUrl ?? fileName,
        receipt_uploaded_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    // audit_log
    await supabase.from('audit_log').insert({
      table_name: 'bookings',
      record_id: bookingId,
      action: 'update',
      notes: `رُفع الإيصال بواسطة ${phone}`,
    })

    return Response.json({ success: true, message: 'تم رفع الإيصال بنجاح، سيتم مراجعته من الإدارة' })
  } catch (err) {
    console.error('[upload-receipt]', err)
    return Response.json({ error: 'فشل رفع الإيصال، حاول مرة أخرى' }, { status: 500 })
  }
}
