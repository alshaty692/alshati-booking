'use client'
import { useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'

interface LinkItem {
  label: string
  description: string
  path: string
}

const LINKS: LinkItem[] = [
  {
    label:       'واجهة العميل',
    description: 'الرابط اللي يستخدمه العميل للحجز',
    path:        '/',
  },
  {
    label:       'شاشة الملاعب',
    description: 'الرابط الخاص بشاشة الحارس لعرض حجوزات اليوم',
    path:        '/guard/login',
  },
]

function CopyField({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  // window.location.origin — يعمل صح على أي بيئة (إنتاج / preview / dev)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}${path}`
    : path

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback للمتصفحات القديمة
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity  = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="ql-field-wrap">
      <input
        type="text"
        readOnly
        value={url}
        className="input ql-url-input"
        aria-label={`رابط ${path}`}
        dir="ltr"
        onClick={e => (e.target as HTMLInputElement).select()}
      />
      <button
        type="button"
        className={`ql-copy-btn ${copied ? 'ql-copied' : ''}`}
        onClick={handleCopy}
        aria-label="نسخ الرابط"
        title="نسخ الرابط"
      >
        {copied
          ? <><Check size={14} strokeWidth={2.5} /> تم النسخ ✓</>
          : <><Copy size={14} strokeWidth={2} /> نسخ</>
        }
      </button>
    </div>
  )
}

export default function QuickLinks() {
  return (
    <div className="s-section card ql-section">
      <div className="s-section-head">
        <Link2 size={18} strokeWidth={1.75} />
        <h2>🔗 الروابط السريعة</h2>
      </div>

      <div className="ql-grid">
        {LINKS.map(item => (
          <div key={item.path} className="ql-item">
            <div className="ql-item-label">{item.label}</div>
            <p className="ql-item-desc">{item.description}</p>
            <CopyField path={item.path} />
          </div>
        ))}
      </div>

      <style>{`
        .ql-section { margin-bottom: var(--space-5); }

        .ql-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        @media (max-width: 540px) {
          .ql-grid { grid-template-columns: 1fr; }
        }

        .ql-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .ql-item-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }

        .ql-item-desc {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0 0 var(--space-2);
          line-height: 1.5;
        }

        .ql-field-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .ql-url-input {
          flex: 1;
          font-family: monospace;
          font-size: var(--text-xs);
          color: var(--text-secondary);
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ql-copy-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          white-space: nowrap;
          flex-shrink: 0;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 0.35em 0.75em;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .ql-copy-btn:hover {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
        }
        [data-theme="light"] .ql-copy-btn:hover {
          color: #2D5A00;
        }

        /* حالة "تم النسخ" */
        .ql-copied {
          background: var(--color-lime-muted) !important;
          border-color: var(--color-lime-dim) !important;
          color: var(--color-lime) !important;
        }
        [data-theme="light"] .ql-copied {
          color: #2D5A00 !important;
        }
      `}</style>
    </div>
  )
}
