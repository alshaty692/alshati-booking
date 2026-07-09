import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { FileText } from 'lucide-react'
import CreditNotesClient from './CreditNotesClient'

export const metadata: Metadata = {
  title:       'إشعارات الائتمان',
  description: 'اعتماد وإلغاء إشعارات الائتمان المعلّقة',
}

export default async function CreditNotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // التحقق من الصلاحيات بالتوازي
  const [canViewInvoices, canApprove, canManage] = await Promise.all([
    hasPermission(user.id, 'view_invoices'),
    hasPermission(user.id, 'approve_credit_note'),
    hasPermission(user.id, 'manage_credit_notes'),
  ])

  if (!canViewInvoices) redirect('/admin?error=unauthorized')

  return (
    <div style={{ maxWidth: 1100 }} className="animate-fade-in">
      {/* ── رأس الصفحة ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          <div style={{
            width: 40, height: 40,
            background: 'rgba(59,130,246,.1)',
            border: '1px solid rgba(59,130,246,.25)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#60a5fa',
          }}>
            <FileText size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
              إشعارات الائتمان
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {canApprove
                ? 'راجع إشعارات الائتمان المعلّقة واعتمدها أو ألغِها'
                : 'عرض إشعارات الائتمان'}
            </p>
          </div>
        </div>
      </div>

      {/* ── المكوّن التفاعلي ── */}
      <CreditNotesClient
        canApprove={canApprove}
        canManage={canManage}
      />
    </div>
  )
}
