import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import PageHeader from '@/components/admin/PageHeader'
import PayrollClient from './PayrollClient'

export const metadata: Metadata = { title: 'الرواتب الشهرية' }

export default async function PayrollPage() {
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
    <div style={{ maxWidth: 1040 }}>
      <PageHeader
        title="الرواتب الشهرية 💵"
        subtitle="تشغيل دورة الرواتب وإصدار كشوف الرواتب"
        backHref="/admin/accounting"
        backLabel="المحاسبة"
      />
      <PayrollClient canManagePayroll={canManage} />
    </div>
  )
}
