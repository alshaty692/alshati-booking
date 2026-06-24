// ============================================================
// src/lib/customers.ts
// دالة مشتركة لإيجاد أو إنشاء عميل بناءً على رقم الجوال
// تُستخدم في كل APIs الحجز (يدوي، متعدد، عام)
// ============================================================
import { createAdminClient } from '@/lib/supabase/server'

export interface CustomerRecord {
  id:            string
  customer_code: string
  name:          string
  phone:         string
}

/**
 * يبحث عن عميل بالجوال — إذا لم يوجد ينشئه مع كود CUST-XXXX
 * Race-safe: يستخدم UPSERT مع ON CONFLICT (phone)
 */
export async function findOrCreateCustomer(
  phone: string,
  name:  string,
  adminClient?: ReturnType<typeof createAdminClient>
): Promise<CustomerRecord> {
  const admin = adminClient ?? createAdminClient()
  const cleanPhone = phone.trim()
  const cleanName  = name.trim()

  // ١. بحث أولاً
  const { data: existing } = await admin
    .from('customers')
    .select('id, customer_code, name, phone')
    .eq('phone', cleanPhone)
    .maybeSingle()

  if (existing) return existing as CustomerRecord

  // ٢. إنشاء عميل جديد — customer_code يُولَّد تلقائياً بـ trg_auto_customer_code
  const { data: created, error } = await admin
    .from('customers')
    .upsert(
      { phone: cleanPhone, name: cleanName },
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id, customer_code, name, phone')
    .single()

  if (error || !created) {
    // fallback: قد يكون UPSERT أرجع الصف الموجود بدون returning — نُعيد البحث
    const { data: fallback, error: fetchErr } = await admin
      .from('customers')
      .select('id, customer_code, name, phone')
      .eq('phone', cleanPhone)
      .single()

    if (fetchErr || !fallback) {
      throw new Error(`[findOrCreateCustomer] فشل إنشاء العميل: ${error?.message ?? fetchErr?.message}`)
    }
    return fallback as CustomerRecord
  }

  return created as CustomerRecord
}
