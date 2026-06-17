import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'

export const metadata: Metadata = { title: { default: 'الإدارة', template: '%s | إدارة مركز حي الشاطئ' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // جلب دور المستخدم — نستخدم Admin Client لتجاوز RLS
  const adminSupabase = createAdminClient()
  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // لو لم يُضَف بعد → يعني أول دخول، نضيفه كـ admin
  if (!adminUser) {
    await adminSupabase.from('admin_users').insert({ id: user.id, role: 'admin', full_name: user.email })
  }

  const role = adminUser?.role ?? 'admin'
  const name = adminUser?.full_name ?? user.email ?? 'المدير'

  return (
    <AdminShell role={role} userName={name} userEmail={user.email ?? ''}>
      {children}
    </AdminShell>
  )
}
