// ============================================================
// مكوّن Skeleton مشترك — يُستخدم في كل ملفات loading.tsx
// ============================================================

/** خط skeleton واحد بطول وارتفاع مخصصَين */
export function SkeletonLine({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-sm)',
}: {
  width?: string
  height?: string
  radius?: string
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--bg-elevated)',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

/** بطاقة skeleton كاملة */
export function SkeletonCard({
  lines = 3,
  height = '120px',
}: {
  lines?: number
  height?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      minHeight: height,
    }}>
      <SkeletonLine width="40%" height="0.875rem" />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? '75%' : '55%'} />
      ))}
    </div>
  )
}

/** CSS animation — تُحقن مرة واحدة */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.45; }
      }
    `}</style>
  )
}
