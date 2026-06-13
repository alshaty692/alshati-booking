import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatDateTime, formatAmount } from '@/lib/utils'
import Link from 'next/link'

export const metadata: Metadata = { title: 'الأكواد' }

async function toggleCode(formData: FormData) {
  'use server'
  const supabase = createAdminClient()
  const id = formData.get('code_id') as string
  const current = formData.get('current_active') === 'true'
  await supabase.from('codes').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/codes')
}

export default async function CodesPage() {
  const supabase = createAdminClient()
  const { data: codes } = await supabase.from('codes').select('*').order('created_at', { ascending: false })

  const TYPE_LABELS: Record<string, string> = {
    permanent:'دائم', charity:'خيري', free:'مجاني', custom:'خاص',
  }
  const DISCOUNT_LABELS = (c: { discount_type: string; discount_value: number }) => {
    if (c.discount_type === 'free') return 'مجاني 100%'
    if (c.discount_type === 'percent') return `${c.discount_value}%`
    return formatAmount(c.discount_value)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">الأكواد</h1>
          <p className="page-subtitle">{codes?.length ?? 0} كود</p>
        </div>
        <Link href="/admin/codes/new" className="btn btn-primary">+ كود جديد</Link>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>الكود</th><th>النوع</th><th>الخصم</th><th>الملعب</th>
                <th>الاستخدام</th><th>الإيرادات</th><th>الانتهاء</th><th>الحالة</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).map(c => (
                <tr key={c.id}>
                  <td><strong style={{ fontSize:'1.05rem', letterSpacing:'0.05em' }}>{c.code}</strong></td>
                  <td><span className={`badge ${c.code_type === 'permanent' ? 'badge-confirmed' : c.code_type === 'charity' ? 'badge-gold' : c.code_type === 'free' ? 'badge-uploaded' : 'badge-regular'}`}>{TYPE_LABELS[c.code_type] ?? c.code_type}</span></td>
                  <td style={{ fontWeight:700, color:'var(--color-success)' }}>{DISCOUNT_LABELS(c)}</td>
                  <td>{c.court_id ? ({ football:'⚽ القدم', volleyball:'🏐 الطائرة', multi:'🏅 المتعدد' } as Record<string,string>)[c.court_id as string] ?? c.court_id : 'الكل'}</td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontWeight:700 }}>{c.used_count}</span>
                    {c.max_uses && <span style={{ color:'var(--text-muted)' }}> / {c.max_uses}</span>}
                  </td>
                  <td style={{ fontWeight:700, color:'var(--color-primary)' }}>{formatAmount(c.total_revenue)}</td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{c.expires_at ?? '—'}</td>
                  <td>
                    <form action={toggleCode} style={{ display:'inline' }}>
                      <input type="hidden" name="code_id" value={c.id} />
                      <input type="hidden" name="current_active" value={String(c.is_active)} />
                      <button type="submit" className={`btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-success'}`}>
                        {c.is_active ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </form>
                  </td>
                  <td>
                    <Link href={`/admin/codes/${c.id}`} className="btn btn-secondary btn-sm">تفاصيل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
        .page-title  { font-size:1.6rem; margin:0 0 0.2rem; }
        .page-subtitle { color:var(--text-muted); font-size:0.875rem; margin:0; }
      `}</style>
    </div>
  )
}
