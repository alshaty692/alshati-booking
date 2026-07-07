import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import PageHeader from '@/components/admin/PageHeader'
import CommissionsPageClient from './CommissionsPageClient'

export const metadata: Metadata = { title: 'العمولات' }

export default async function CommissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [canView, canManage] = await Promise.all([
    hasPermission(user.id, 'view_payroll'),
    hasPermission(user.id, 'manage_payroll'),
  ])

  if (!canView && !canManage) {
    redirect('/admin?error=unauthorized')
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader
        title="العمولات"
        subtitle="متابعة العمولات المخصَّصة عبر الحجوزات"
        backHref="/admin/employees"
        backLabel="الموظفون"
      />
      <CommissionsPageClient canManagePayroll={canManage} />
    </div>
  )
}
