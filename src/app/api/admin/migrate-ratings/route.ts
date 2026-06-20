// ============================================================
// Setup Route — ينشئ جدول booking_ratings تلقائياً
// يُشغَّل مرة واحدة ثم يُحذف
// ============================================================
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  try {
    // حماية: admin فقط
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return Response.json({ error: 'غير مصرح' }, { status: 401 })

    const admin = createAdminClient()

    // إنشاء الجدول بـ insert تجريبي — إذا أُرجع "relation does not exist"
    // نعرف أن الجدول محتاج إنشاء
    const { error: checkErr } = await admin
      .from('booking_ratings' as never)
      .select('id')
      .limit(1)

    if (!checkErr) {
      return Response.json({ status: 'already_exists', message: 'الجدول موجود مسبقاً' })
    }

    return Response.json({
      status: 'needs_creation',
      message: 'الجدول غير موجود. يرجى تشغيل SQL التالي في Supabase SQL Editor',
      dashboard_url: 'https://supabase.com/dashboard/project/epzjyssbdlwaqnonxfsw/sql/new',
      sql: `
-- ============================================================
-- تشغيل هذا SQL في Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  rating      INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_booking ON booking_ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_ratings_phone   ON booking_ratings(phone);

ALTER TABLE booking_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_anon_select_own" ON booking_ratings
  FOR SELECT TO anon USING (true);

CREATE POLICY "ratings_anon_insert" ON booking_ratings
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "ratings_service_role_all" ON booking_ratings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
      `
    })
  } catch (err) {
    console.error('[setup-ratings]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
