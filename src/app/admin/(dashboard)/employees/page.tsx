import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import PageHeader from '@/components/admin/PageHeader'
import EmployeesClient from './EmployeesClient'

export const metadata: Metadata = { title: 'الموظفون' }

export default async function EmployeesPage() {
  // تحقق من تسجيل الدخول
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // فحص الصلاحيات — يجب أن يملك على الأقل إحدى الصلاحيتين
  const [canView, canManageEmployees, canManagePayroll] = await Promise.all([
    hasPermission(user.id, 'view_payroll'),
    hasPermission(user.id, 'manage_employees'),
    hasPermission(user.id, 'manage_payroll'),
  ])

  // لو لا يملك أي صلاحية للعرض → رفض الوصول
  if (!canView && !canManageEmployees && !canManagePayroll) {
    redirect('/admin?error=unauthorized')
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader
        title="الفريق الميداني"
        subtitle="إدارة الموظفين وإعدادات الرواتب والعمولات"
      />
      <EmployeesClient
        canManageEmployees={canManageEmployees}
        canManagePayroll={canManagePayroll}
      />
    </div>
  )
}
