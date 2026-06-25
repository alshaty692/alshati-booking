// ============================================================
// Loading — صفحة التقارير /admin/reports
// يظهر أثناء جلب بيانات التقارير من السيرفر
// ============================================================
import { SkeletonCard, SkeletonLine, SkeletonStyles } from '@/components/ui/Skeleton'

export default function ReportsLoading() {
  return (
    <div style={{
      padding: 'var(--space-8)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-8)',
      fontFamily: "'Tajawal', system-ui, sans-serif",
      direction: 'rtl',
    }}>
      <SkeletonStyles />

      {/* هيدر + فلاتر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <SkeletonLine width="180px" height="1.75rem" radius="var(--radius-md)" />
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <SkeletonLine width="100px" height="2.25rem" radius="var(--radius-md)" />
          <SkeletonLine width="100px" height="2.25rem" radius="var(--radius-md)" />
          <SkeletonLine width="80px" height="2.25rem" radius="var(--radius-md)" />
        </div>
      </div>

      {/* بطاقات إحصائية — صف أول */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {[1, 2, 3, 4].map(i => (
          <SkeletonCard key={i} lines={2} height="90px" />
        ))}
      </div>

      {/* قسمان جانبيان */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        <SkeletonCard lines={4} height="180px" />
        <SkeletonCard lines={4} height="180px" />
      </div>

      {/* جدول تفصيلي */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        <SkeletonLine width="160px" height="1rem" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <SkeletonLine width="8%"  height="0.7rem" />
            <SkeletonLine width="22%" height="0.7rem" />
            <SkeletonLine width="18%" height="0.7rem" />
            <SkeletonLine width="12%" height="0.7rem" />
            <SkeletonLine width="15%" height="0.7rem" />
          </div>
        ))}
      </div>
    </div>
  )
}
