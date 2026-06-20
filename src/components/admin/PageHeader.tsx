import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
}

/**
 * رأس الصفحة الموحد — يُستخدم في جميع صفحات الأدمن
 * يدعم: عنوان رئيسي، وصف، زر رجوع، وأزرار الإجراء
 */
export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  action,
}: PageHeaderProps) {
  return (
    <div className="pg-header">
      {backHref && (
        <Link href={backHref} className="pg-back">
          <ArrowRight size={14} strokeWidth={2.5} />
          {backLabel ?? 'رجوع'}
        </Link>
      )}
      <div className="pg-header-main">
        <div className="pg-header-text">
          <h1 className="pg-title">{title}</h1>
          {subtitle && <p className="pg-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="pg-header-action">{action}</div>}
      </div>

      <style>{`
        .pg-header {
          margin-bottom: var(--space-6);
        }
        .pg-back {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          color: var(--color-lime-dim);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          text-decoration: none;
          margin-bottom: var(--space-3);
          transition: color 0.15s ease, gap 0.15s ease;
        }
        .pg-back:hover {
          color: var(--color-lime);
          gap: var(--space-2);
          opacity: 1;
        }
        .pg-header-main {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        .pg-header-text { flex: 1; min-width: 0; }
        .pg-title {
          font-size: var(--text-2xl);
          font-weight: var(--font-black);
          margin: 0 0 var(--space-1);
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .pg-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
          font-weight: var(--font-medium);
        }
        .pg-header-action {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
      `}</style>
    </div>
  )
}
