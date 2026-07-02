// ============================================================
// API Route — إدارة إيقافات الملاعب (admin/editor فقط)
// GET: جلب الإيقافات النشطة
// POST: إضافة إيقاف جديد
// DELETE: حذف إيقاف
// ============================================================
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function GET() {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const { data: closures, error } = await supabase
      .from('venue_closures')
      .select('*')
      .order('start_date', { ascending: false })

    if (error) throw error
    return Response.json({ closures: closures ?? [] })
  } catch (err) {
    console.error('[venue-closures GET]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const { court_id, start_date, end_date, reason } = await request.json()

    if (!court_id || !start_date || !end_date) {
      return Response.json({ error: 'يرجى إكمال جميع الحقول' }, { status: 400 })
    }

    if (new Date(end_date) < new Date(start_date)) {
      return Response.json({ error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('venue_closures')
      .insert({
        court_id,
        start_date,
        end_date,
        reason: reason || 'صيانة',
        created_by: auth.session.userId,
      })
      .select()
      .single()

    if (error) throw error

    // تسجيل في audit_log
    await supabase.from('audit_log').insert({
      table_name: 'venue_closures',
      record_id: data.id,
      action: 'insert',
      performed_by: auth.session.userId,
      notes: `إيقاف ملعب ${court_id} من ${start_date} إلى ${end_date}: ${reason}`,
    })

    return Response.json({ success: true, closure: data })
  } catch (err) {
    console.error('[venue-closures POST]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_availability')
    if (!auth.ok) return auth.response

    const { id } = await request.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createAdminClient()
    await supabase.from('venue_closures').delete().eq('id', id)

    await supabase.from('audit_log').insert({
      table_name: 'venue_closures',
      record_id: id,
      action: 'delete',
      performed_by: auth.session.userId,
      notes: 'حذف إيقاف ملعب',
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[venue-closures DELETE]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
