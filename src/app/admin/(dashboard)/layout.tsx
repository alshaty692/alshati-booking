import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'

export const metadata: Metadata = { title: { default: 'الإدارة', template: '%s | إدارة مركز حي الشاطئ' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // جلب دور المستخدم من جدول admin_users — نستخدم Admin Client لتجاوز RLS
  const adminSupabase = createAdminClient()
  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // ⛔ SEC-FIX: لا يُنشأ أي صف تلقائياً — فقط المستخدمون المضافون يدوياً في admin_users مسموح لهم
  // لو المستخدم غير موجود في الجدول → رفض الوصول فوراً
  if (!adminUser) {
    redirect('/admin/login?error=unauthorized')
  }

  const role = adminUser.role
  const name = adminUser.full_name ?? user.email ?? 'المدير'

  return (
    <AdminShell role={role} userName={name} userEmail={user.email ?? ''}>
      {children}
    </AdminShell>
  )
}
