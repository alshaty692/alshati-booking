'use client'
// ============================================================
// WaterStockToggle — زر تبديل تتبع مخزون المياه (Client Component)
// يُستخدم داخل نموذج الإعدادات — يرسل قيمة وحدة فقط لـ water_stock_enabled
// السلوك البصري فوري (لحظة الضغط) — الحفظ يصل للسرفير عبر نموذج الأب
// ============================================================
import { useState } from 'react'
import { Droplets } from 'lucide-react'

interface Props {
  initialEnabled: boolean
}

export default function WaterStockToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)

  return (
    <div
      className="wst-row"
      onClick={() => setEnabled(v => !v)}
      role="switch"
      aria-checked={enabled}
      tabIndex={0}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setEnabled(v => !v) } }}
    >
      {/* الأيقونة */}
      <span className="wst-icon">
        <Droplets
          size={18}
          strokeWidth={1.75}
          style={{
            color: enabled ? 'var(--color-lime)' : 'var(--text-muted)',
            transition: 'color 0.2s',
          }}
        />
      </span>

      {/* النص */}
      <span className="wst-text">
        <strong>تتبع مخزون المياه</strong>
        <span className="wst-desc">
          {enabled
            ? 'مفعَّل — الحجز بالمياه يخصم من المخزون عند التأكيد'
            : 'موقوف — الحجز بالمياه يشتغل عادي بدون خصم من المخزون'}
        </span>
      </span>

      {/* بادج الحالة */}
      <span
        className="wst-badge"
        style={{
          background: enabled ? 'var(--color-lime-muted)' : 'var(--color-danger-bg, rgba(224,85,85,.1))',
          color:      enabled ? 'var(--color-lime)' : 'var(--color-danger, #e05555)',
          borderColor: enabled ? 'rgba(200,255,62,.2)' : 'rgba(224,85,85,.2)',
        }}
      >
        {enabled ? 'مفعَّل' : 'موقوف'}
      </span>

      {/* الـ Pill/Toggle المتحرك */}
      <div
        className="wst-pill"
        style={{ background: enabled ? 'var(--color-lime)' : 'var(--border-default, #444)' }}
      >
        <div
          className="wst-dot"
          style={{ right: enabled ? '3px' : 'calc(100% - 21px)' }}
        />
      </div>

      {/* الحقل المخفي — يرسل قيمة وحدة بدون تكرار */}
      <input
        type="hidden"
        name="water_stock_enabled"
        value={enabled ? 'true' : 'false'}
      />

      <style>{`
        .wst-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          margin-top: var(--space-4);
          background: var(--bg-card, var(--color-surface));
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          user-select: none;
          outline: none;
        }
        .wst-row:focus-visible {
          box-shadow: 0 0 0 3px var(--color-lime-glow);
        }
        .wst-icon { display: flex; flex-shrink: 0; }
        .wst-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .wst-text strong {
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .wst-desc {
          font-size: var(--text-xs);
          color: var(--text-muted);
          transition: color 0.2s;
        }
        .wst-badge {
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 0.2em 0.6em;
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          white-space: nowrap;
          transition: background 0.2s, color 0.2s;
        }
        /* الـ Pill */
        .wst-pill {
          width: 42px;
          height: 24px;
          border-radius: 999px;
          position: relative;
          transition: background 0.25s;
          flex-shrink: 0;
        }
        .wst-dot {
          position: absolute;
          top: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: right 0.25s cubic-bezier(.4,0,.2,1);
        }
      `}</style>
    </div>
  )
}
