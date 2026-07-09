'use client'
/**
 * FilterBar — شريط فلتر موحّد
 * ───────────────────────────────────────────────────────────────
 * يُستخدم في: credit-notes، payments، وأي صفحة مستقبلية
 *
 * Props:
 *  - tabs:      مجموعة أزرار Pill (اختياري)
 *  - selects:   قوائم dropdown (اختياري)
 *  - onRefresh: callback زر التحديث (اختياري)
 *  - refreshing: حالة التحديث
 */
import { RefreshCw } from 'lucide-react'

export interface FilterTab<T extends string = string> {
  value:    T
  label:    string
  icon?:    React.ReactNode
  count?:   number   // عدد اختياري يظهر كـ badge
}

export interface FilterSelect {
  id:       string
  label?:   string
  value:    string
  options:  { value: string; label: string }[]
  onChange: (v: string) => void
}

export interface FilterBarProps {
  /** مجموعات tabs — كل مجموعة تُعرض كأزرار Pill مجتمعة */
  tabGroups?:  {
    value:    string
    onChange: (v: string) => void
    tabs:     FilterTab[]
  }[]
  /** قوائم dropdown (للفلاتر ذات قيم كثيرة) */
  selects?:    FilterSelect[]
  /** زر تحديث */
  onRefresh?:  () => void
  refreshing?: boolean
  /** محتوى إضافي يُعرض بعد الفلاتر */
  children?:   React.ReactNode
}

export default function FilterBar({
  tabGroups  = [],
  selects    = [],
  onRefresh,
  refreshing = false,
  children,
}: FilterBarProps) {
  return (
    <div className="fb-bar">
      <div className="fb-left">
        {/* ── مجموعات الـ Pills ── */}
        {tabGroups.map((group, gi) => (
          <div key={gi} className="fb-pill-group" role="group">
            {group.tabs.map(tab => {
              const isActive = group.value === tab.value
              return (
                <button
                  key={tab.value}
                  className={`fb-pill ${isActive ? 'fb-pill-active' : ''}`}
                  onClick={() => group.onChange(tab.value)}
                  aria-pressed={isActive}
                  type="button"
                >
                  {tab.icon && <span className="fb-pill-icon">{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`fb-pill-badge ${isActive ? 'fb-pill-badge-active' : ''}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* فاصل بين groups والـ selects إذا كلاهما موجود */}
        {tabGroups.length > 0 && selects.length > 0 && (
          <div className="fb-divider" aria-hidden="true" />
        )}

        {/* ── الـ Dropdowns ── */}
        {selects.map(sel => (
          <div key={sel.id} className="fb-select-wrap">
            {sel.label && (
              <label htmlFor={sel.id} className="fb-select-label">{sel.label}</label>
            )}
            <select
              id={sel.id}
              className="fb-select"
              value={sel.value}
              onChange={e => sel.onChange(e.target.value)}
            >
              {sel.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}

        {/* slot للمحتوى الإضافي */}
        {children}
      </div>

      {/* ── زر التحديث — دائماً في أقصى اليسار ── */}
      {onRefresh && (
        <button
          className="fb-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          title="تحديث البيانات"
          type="button"
          aria-label="تحديث"
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={refreshing ? 'fb-spin' : ''}
          />
        </button>
      )}

      <style>{`
        /* ════════════════════════════════════════════════
           FilterBar — تصميم موحّد للفلاتر
        ════════════════════════════════════════════════ */

        .fb-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          flex-wrap: wrap;
          margin-bottom: var(--space-5);
        }

        .fb-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
          flex: 1;
          min-width: 0;
        }

        /* ── Pill Group ── */
        .fb-pill-group {
          display: flex;
          align-items: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 2px;
          gap: 2px;
          flex-shrink: 0;
        }

        .fb-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.7rem;
          border-radius: calc(var(--radius-md) - 2px);
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
          white-space: nowrap;
          line-height: 1.4;
        }
        .fb-pill:hover {
          background: var(--bg-surface);
          color: var(--text-primary);
        }
        .fb-pill-active {
          background: var(--bg-surface) !important;
          color: var(--text-primary) !important;
          font-weight: var(--font-semibold);
          box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 0 0 1px var(--border-color);
        }

        .fb-pill-icon {
          display: flex;
          align-items: center;
          opacity: 0.75;
        }
        .fb-pill-active .fb-pill-icon { opacity: 1; }

        /* Badge عداد */
        .fb-pill-badge {
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: var(--radius-full);
          background: var(--bg-base);
          color: var(--text-muted);
          font-size: 10px;
          font-weight: var(--font-bold);
          line-height: 18px;
          text-align: center;
        }
        .fb-pill-badge-active {
          background: var(--color-lime-muted);
          color: var(--color-lime);
        }
        [data-theme="light"] .fb-pill-badge-active {
          background: rgba(74,124,0,.1);
          color: #2D5A00;
        }

        /* ── فاصل عمودي ── */
        .fb-divider {
          width: 1px;
          height: 20px;
          background: var(--border-color);
          flex-shrink: 0;
        }

        /* ── Select Dropdown ── */
        .fb-select-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .fb-select-label {
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .fb-select {
          height: 32px;
          padding: 0 var(--space-3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s;
          min-width: 110px;
        }
        .fb-select:focus { border-color: var(--color-lime-dim); }

        /* ── زر التحديث ── */
        .fb-refresh {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .fb-refresh:hover:not(:disabled) {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
        }
        [data-theme="light"] .fb-refresh:hover:not(:disabled) {
          color: #2D5A00;
        }
        .fb-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes fb-spin { to { transform: rotate(360deg); } }
        .fb-spin { animation: fb-spin 0.7s linear infinite; }

        /* ── Mobile ── */
        @media (max-width: 540px) {
          .fb-bar    { padding: var(--space-2) var(--space-3); gap: var(--space-2); }
          .fb-left   { gap: var(--space-2); }
          .fb-pill   { padding: 0.25rem 0.5rem; font-size: var(--text-xs); }
          .fb-select { min-width: 90px; font-size: var(--text-xs); }
          .fb-divider { display: none; }
        }
        @media (max-width: 380px) {
          /* إخفاء النص وإبقاء الأيقونة فقط في الـ pills بالشاشات الصغيرة جداً */
          .fb-pill span:not(.fb-pill-icon):not(.fb-pill-badge) { display: none; }
          .fb-pill-icon { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
