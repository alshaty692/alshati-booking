import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import Link from 'next/link'
import {
  Receipt, DollarSign, Briefcase,
  BarChart3, TrendingUp, Clock, AlertCircle,
  ArrowLeft, FileText, CreditCard, LineChart, Banknote,
} from 'lucide-react'

export const metadata: Metadata = { title: 'المحاسبة — نظرة عامة' }

// ── جلب البيانات الملخّصة ─────────────────────────────────────

async function fetchAccountingSummary() {
  const admin = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // نجري كل الاستعلامات بالتوازي
  const [
    invoicesResult,
    creditNotesResult,
    commissionsResult,
    paymentsResult,
  ] = await Promise.allSettled([
    // فواتير مستحقة (unpaid + partial)
    admin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', ['unpaid', 'partial']),

    // إشعارات ائتمان بانتظار الاعتماد (draft)
    admin
      .from('credit_notes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),

    // عمولات معلّقة (لم تُدرج براتب بعد)
    admin
      .from('commissions')
      .select('id, amount', { count: 'exact' })
      .is('included_in_salary_payment_id', null),

    // تحصيل اليوم: مجموع الدفعات بتاريخ اليوم
    // payment_date هو DATE (ليس TIMESTAMPTZ) — نستخدم .eq() مباشرة
    admin
      .from('payments')
      .select('amount')
      .eq('payment_date', todayStr),
  ])

  const dueInvoicesCount   = invoicesResult.status   === 'fulfilled' ? (invoicesResult.value.count   ?? 0) : 0
  const draftCNCount       = creditNotesResult.status === 'fulfilled' ? (creditNotesResult.value.count ?? 0) : 0
  const pendingCommissions = commissionsResult.status === 'fulfilled' ? (commissionsResult.value.data  ?? []) : []
  const pendingCommCount   = commissionsResult.status === 'fulfilled' ? (commissionsResult.value.count ?? 0) : 0
  const pendingCommTotal   = pendingCommissions.reduce((s, c) => s + Number(c.amount), 0)
  const todayPayments      = paymentsResult.status === 'fulfilled'    ? (paymentsResult.value.data ?? []) : []
  const todayTotal         = todayPayments.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)

  // رواتب لم تُصرف هذا الشهر
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const unpaidPayrollResult = await admin
    .from('compensation_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  const totalActiveProfiles = unpaidPayrollResult.count ?? 0

  const paidThisMonthResult = await admin
    .from('salary_payments')
    .select('id', { count: 'exact', head: true })
    .eq('period_month', currentMonth)

  const paidThisMonth = paidThisMonthResult.count ?? 0
  const unpaidPayrollCount = Math.max(0, totalActiveProfiles - paidThisMonth)

  return {
    todayTotal,
    dueInvoicesCount,
    draftCNCount,
    pendingCommCount,
    pendingCommTotal,
    unpaidPayrollCount,
    currentMonth,
  }
}

// ── الصفحة ───────────────────────────────────────────────────

export default async function AccountingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // التحقق من صلاحية واحدة على الأقل تتعلق بالمحاسبة
  const [canViewInvoices, canViewPayroll] = await Promise.all([
    hasPermission(user.id, 'view_invoices'),
    hasPermission(user.id, 'view_payroll'),
  ])

  if (!canViewInvoices && !canViewPayroll) {
    redirect('/admin?error=unauthorized')
  }

  let summary: Awaited<ReturnType<typeof fetchAccountingSummary>>
  try {
    summary = await fetchAccountingSummary()
  } catch (_err) {
    summary = { todayTotal: 0, dueInvoicesCount: 0, draftCNCount: 0, pendingCommCount: 0, pendingCommTotal: 0, unpaidPayrollCount: 0, currentMonth: '' }
  }

  // ── بطاقات اللوحة ──────────────────────────────────────────

  const cards = [
    {
      id:      'ac-today-collection',
      label:   'تحصيل اليوم',
      value:   `${summary.todayTotal.toLocaleString('ar-SA')} ر.س`,
      sub:     'مجموع الدفعات المسجّلة اليوم',
      icon:    <TrendingUp size={22} />,
      href:    '/admin/payments?period=today',
      color:   'lime' as const,
      visible: canViewInvoices,
    },
    {
      id:      'ac-due-invoices',
      label:   'فواتير مستحقة',
      value:   String(summary.dueInvoicesCount),
      sub:     'بحالة unpaid أو partial',
      icon:    <Receipt size={22} />,
      href:    '/admin/invoices?payment_status=unpaid',
      color:   'warning' as const,
      visible: canViewInvoices,
    },
    {
      id:      'ac-draft-cns',
      label:   'إشعارات ائتمان بانتظار الاعتماد',
      value:   String(summary.draftCNCount),
      sub:     'بحالة draft',
      icon:    <FileText size={22} />,
      href:    '/admin/credit-notes',
      color:   'info' as const,
      visible: canViewInvoices,
    },
    {
      id:      'ac-pending-commissions',
      label:   'عمولات معلّقة',
      value:   String(summary.pendingCommCount),
      sub:     `إجمالي: ${summary.pendingCommTotal.toLocaleString('ar-SA')} ر.س`,
      icon:    <BarChart3 size={22} />,
      href:    '/admin/commissions',
      color:   'purple' as const,
      visible: canViewPayroll,
    },
    {
      id:      'ac-unpaid-payroll',
      label:   'رواتب لم تُصرف',
      value:   String(summary.unpaidPayrollCount),
      sub:     `هذا الشهر — ${summary.unpaidPayrollCount > 0 ? 'يحتاج متابعة' : 'تم الصرف للجميع ✓'}`,
      icon:    <Banknote size={22} />,
      href:    '/admin/payroll',
      color:   summary.unpaidPayrollCount > 0 ? ('warning' as const) : ('lime' as const),
      visible: canViewPayroll,
    },
  ].filter(c => c.visible)

  const colorMap = {
    lime:    { bg: 'var(--color-lime-muted)',    text: 'var(--color-lime)',    border: 'var(--color-lime-dim)' },
    warning: { bg: 'var(--color-warning-bg)',    text: 'var(--color-warning)', border: 'rgba(245,166,35,.3)' },
    info:    { bg: 'rgba(59,130,246,.08)',        text: '#60a5fa',              border: 'rgba(59,130,246,.25)' },
    purple:  { bg: 'rgba(139,92,246,.08)',        text: '#a78bfa',              border: 'rgba(139,92,246,.25)' },
  }

  // ── CSS hover عبر <style> بدلاً من event handlers (Server Component) ──
  const hoverCss = `
    .acct-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .acct-ql:hover   { border-color: var(--color-lime-dim) !important; color: var(--color-lime) !important; }
  `

  return (
    <div style={{ maxWidth: 900 }} className="animate-fade-in">
      <style>{hoverCss}</style>
      {/* ── رأس الصفحة ── */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
          💰 المحاسبة
        </h1>
        <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          نظرة عامة على الوضع المالي الحالي
        </p>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)',
      }}>
        {cards.map(card => {
          const clr = colorMap[card.color]
          return (
            <Link
              key={card.id}
              id={card.id}
              href={card.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="acct-card"
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${clr.border}`,
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 44, height: 44,
                  background: clr.bg,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: clr.text,
                  marginBottom: 'var(--space-4)',
                }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: clr.text, marginBottom: 4 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {card.sub}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── روابط سريعة ── */}
      <div>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          وصول سريع
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          {[
            canViewInvoices && { id: 'ql-invoices',      href: '/admin/invoices',     Icon: Receipt,     label: 'الفواتير' },
            canViewInvoices && { id: 'ql-payments',      href: '/admin/payments',     Icon: CreditCard,  label: 'الدفعات' },
            canViewPayroll  && { id: 'ql-employees',     href: '/admin/employees',    Icon: Briefcase,   label: 'الفريق الميداني' },
            canViewPayroll  && { id: 'ql-commissions',   href: '/admin/commissions',  Icon: BarChart3,   label: 'العمولات' },
            canViewPayroll  && { id: 'ql-payroll',       href: '/admin/payroll',      Icon: Banknote,    label: 'الرواتب الشهرية' },
            (canViewInvoices || canViewPayroll) && {
              id: 'ql-financial-reports',
              href: '/admin/reports?tab=accounting',
              Icon: LineChart,
              label: 'التقارير المالية المتقدمة',
            },
          ].filter(Boolean).map((item) => {
            const { id, href, Icon, label } = item as { id: string; href: string; Icon: import('lucide-react').LucideIcon; label: string }
            return (
              <Link key={id} id={id} href={href} style={{ textDecoration: 'none' }}>
                <div
                  className="acct-ql"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <ArrowLeft size={13} style={{ marginRight: 'auto', opacity: 0.4 }} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── تذييل توضيحي ── */}
      <div style={{
        marginTop: 'var(--space-10)',
        padding: 'var(--space-4)',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
      }}>
        <AlertCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          الأرقام المعروضة تُحسب لحظة فتح الصفحة. أعد تحميل الصفحة للحصول على أحدث البيانات.
          بطاقة "تحصيل اليوم" تشمل جميع الدفعات المسجّلة اليوم ({new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}).
        </p>
      </div>
    </div>
  )
}
