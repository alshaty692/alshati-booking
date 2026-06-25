// ============================================================
// Loading — صفحة الفواتير /admin/invoices
// يظهر أثناء جلب بيانات الفواتير من السيرفر
// ============================================================
import { SkeletonLine, SkeletonStyles } from '@/components/ui/Skeleton'

export default function InvoicesLoading() {
  return (
    <div style={{
      padding: 'var(--space-8)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      fontFamily: "'Tajawal', system-ui, sans-serif",
      direction: 'rtl',
    }}>
      <SkeletonStyles />

      {/* هيدر + فلتر الشهر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <SkeletonLine width="160px" height="1.75rem" radius="var(--radius-md)" />
        <SkeletonLine width="160px" height="2.25rem" radius="var(--radius-md)" />
      </div>

      {/* بطاقات إحصائية — 3 بطاقات */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
            <SkeletonLine width="55%" height="0.75rem" />
            <SkeletonLine width="70%" height="1.5rem" radius="var(--radius-sm)" />
          </div>
        ))}
      </div>

      {/* قائمة الفواتير — 6 صفوف */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* هيدر الجدول */}
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: 'var(--space-5)',
        }}>
          {['12%', '20%', '15%', '12%', '10%'].map((w, i) => (
            <SkeletonLine key={i} width={w} height="0.7rem" />
          ))}
        </div>

        {/* صفوف البيانات */}
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 'var(--space-5)',
            alignItems: 'center',
          }}>
            {['12%', '20%', '15%', '12%', '10%'].map((w, j) => (
              <SkeletonLine key={j} width={w} height="0.7rem" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
