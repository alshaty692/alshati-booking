import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { CreditCard } from 'lucide-react'
import PaymentsClient from './PaymentsClient'

export const metadata: Metadata = {
  title:       'الدفعات',
  description: 'عرض جميع الدفعات المسجّلة عبر الفواتير',
}

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const canView = await hasPermission(user.id, 'view_invoices')
  if (!canView) redirect('/admin?error=unauthorized')

  return (
    <div style={{ maxWidth: 1100 }} className="animate-fade-in">
      {/* ── رأس الصفحة ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          <div style={{
            width: 40, height: 40,
            background: 'var(--color-lime-muted)',
            border: '1.5px solid var(--color-lime-dim)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-lime)',
          }}>
            <CreditCard size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
              الدفعات
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              جميع الدفعات المسجّلة عبر كل الفواتير
            </p>
          </div>
        </div>
      </div>

      {/* ── المكوّن التفاعلي ── */}
      <PaymentsClient />
    </div>
  )
}
