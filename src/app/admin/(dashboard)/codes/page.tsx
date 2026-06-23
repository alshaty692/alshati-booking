import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatDateTime, formatAmount } from '@/lib/utils'
import { fetchCourtNames } from '@/hooks/useCourtNames'
import Link from 'next/link'
import { Plus, ToggleLeft, ToggleRight, Tag, Percent, Coins } from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'

export const metadata: Metadata = { title: 'الأكواد' }

async function toggleCode(formData: FormData) {
  'use server'
  const supabase = createAdminClient()
  const id = formData.get('code_id') as string
  const current = formData.get('current_active') === 'true'
  await supabase.from('codes').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/codes')
}

const TYPE_LABELS: Record<string, string> = {
  permanent: 'دائم', charity: 'خيري', free: 'مجاني', custom: 'خاص',
}
const TYPE_BADGE: Record<string, string> = {
  permanent: 'badge-confirmed', charity: 'badge-gold', free: 'badge-uploaded', custom: 'badge-regular',
}

function DiscountDisplay({ discountType, discountValue }: { discountType: string; discountValue: number }) {
  if (discountType === 'free') return <span style={{ color: 'var(--color-lime)', fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'] }}>مجاني 100%</span>
  if (discountType === 'percent') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--color-lime)', fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'] }}>
      <Percent size={12} strokeWidth={2.5} />{discountValue}%
    </span>
  )
  return <span style={{ color: 'var(--color-lime)', fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'] }}>{formatAmount(discountValue)}</span>
}

export default async function CodesPage() {
  const supabase = createAdminClient()
  const [{ data: codes }, courtMap] = await Promise.all([
    supabase.from('codes').select('*').order('created_at', { ascending: false }),
    fetchCourtNames(supabase),
  ])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="الأكواد"
        subtitle={`${codes?.length ?? 0} كود`}
        action={
          <Link href="/admin/codes/new" className="btn btn-primary">
            <Plus size={16} strokeWidth={2.5} />
            كود جديد
          </Link>
        }
      />

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>النوع</th>
                <th>الخصم</th>
                <th>الملعب</th>
                <th style={{ textAlign: 'center' }}>الاستخدام</th>
                <th>الإيرادات</th>
                <th>الانتهاء</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    لا توجد أكواد
                  </td>
                </tr>
              )}
              {(codes ?? []).map(c => (
                <tr key={c.id}>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 'var(--font-black)' as React.CSSProperties['fontWeight'],
                      fontSize: 'var(--text-base)',
                      letterSpacing: '0.06em',
                      color: 'var(--text-primary)',
                    }}>
                      {c.code}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[c.code_type] ?? 'badge-regular'}`}>
                      {TYPE_LABELS[c.code_type] ?? c.code_type}
                    </span>
                  </td>
                  <td><DiscountDisplay discountType={c.discount_type} discountValue={c.discount_value} /></td>
                  <td>
                    {c.court_id
                      ? <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{courtMap[c.court_id as string] ?? c.court_id}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>الكل</span>
                    }
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'] }}>{c.used_count}</span>
                    {c.max_uses && <span style={{ color: 'var(--text-muted)' }}> / {c.max_uses}</span>}
                  </td>
                  <td style={{ fontWeight: 'var(--font-bold)' as React.CSSProperties['fontWeight'], color: 'var(--color-lime)' }}>
                    {formatAmount(c.total_revenue)}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {c.expires_at ?? <span>—</span>}
                  </td>
                  <td>
                    <form action={toggleCode} style={{ display: 'inline' }}>
                      <input type="hidden" name="code_id" value={c.id} />
                      <input type="hidden" name="current_active" value={String(c.is_active)} />
                      <button
                        type="submit"
                        className={`btn btn-sm co-toggle ${c.is_active ? 'co-toggle-off' : 'co-toggle-on'}`}
                        title={c.is_active ? 'إيقاف الكود' : 'تفعيل الكود'}
                      >
                        {c.is_active
                          ? <><ToggleRight size={14} strokeWidth={2} /> نشط</>
                          : <><ToggleLeft size={14} strokeWidth={2} /> موقوف</>
                        }
                      </button>
                    </form>
                  </td>
                  <td>
                    <Link href={`/admin/codes/${c.id}`} className="btn btn-secondary btn-sm">تعديل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .co-toggle {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          border: 1.5px solid;
          background: transparent;
        }
        .co-toggle-on {
          color: var(--color-lime);
          border-color: var(--color-lime-dim);
        }
        .co-toggle-on:hover {
          background: var(--color-lime-muted);
        }
        .co-toggle-off {
          color: var(--text-muted);
          border-color: var(--border-color);
        }
        .co-toggle-off:hover {
          color: var(--color-danger);
          border-color: var(--color-danger);
          background: var(--color-danger-bg);
        }
      `}</style>
    </div>
  )
}
