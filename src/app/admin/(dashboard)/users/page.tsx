// ============================================================
// /admin/users — صفحة إدارة المستخدمين (Server wrapper)
// تجلب user.id الحالي وتمرره للـ Client Component
// ============================================================
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export const metadata: Metadata = { title: 'المستخدمون والصلاحيات' }

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <UsersClient currentUserId={user.id} />
}
