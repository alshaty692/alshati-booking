// ============================================================
// Loading — لوحة التحكم /admin
// يظهر أثناء تحميل Server Components في الداشبورد
// ============================================================
import { SkeletonCard, SkeletonLine, SkeletonStyles } from '@/components/ui/Skeleton'

export default function AdminLoading() {
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

      {/* عنوان الصفحة */}
      <SkeletonLine width="200px" height="1.75rem" radius="var(--radius-md)" />

      {/* شبكة الإحصائيات — 4 بطاقات */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-5)',
      }}>
        {[1, 2, 3, 4].map(i => (
          <SkeletonCard key={i} lines={2} height="100px" />
        ))}
      </div>

      {/* جدول أو قائمة */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        <SkeletonLine width="150px" height="1rem" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <SkeletonLine width="10%" height="0.75rem" />
            <SkeletonLine width="25%" height="0.75rem" />
            <SkeletonLine width="20%" height="0.75rem" />
            <SkeletonLine width="15%" height="0.75rem" />
          </div>
        ))}
      </div>
    </div>
  )
}
