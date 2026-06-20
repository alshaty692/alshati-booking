'use client'
// ============================================================
// FilterBar — شريط الفلتر الموحّد (sticky)
// يتحكم بكل الصفحة: الفترة الزمنية + الملعب + الحالة
// ============================================================
import { useState, useCallback } from 'react'
import type { FilterState, TimePreset, CourtFilter, StatusFilter } from '@/types/reports'

// ── ثوابت ──
const PRESETS: { key: TimePreset; label: string }[] = [
  { key: 'today',  label: 'اليوم'  },
  { key: 'week',   label: 'أسبوع'  },
  { key: 'month',  label: 'شهر'    },
  { key: 'year',   label: 'سنة'    },
  { key: 'custom', label: 'مخصص ▾' },
]

const COURTS: { id: CourtFilter; label: string; icon: string }[] = [
  { id: 'all',        label: 'كل الملاعب',     icon: '🏟️' },
  { id: 'football',   label: 'كرة القدم',      icon: '⚽' },
  { id: 'volleyball', label: 'الكرة الطائرة',  icon: '🏐' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏟️' },
]

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'all',       label: 'كل الحالات' },
  { id: 'confirmed', label: 'مؤكد'       },
  { id: 'pending',   label: 'بانتظار'    },
  { id: 'uploaded',  label: 'قيد المراجعة' },
  { id: 'cancelled', label: 'ملغى'       },
]

// ── دالة حساب التاريخ حسب الـ preset ──
export function getDateRange(preset: TimePreset): { from: string; to: string } {
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  const now   = new Date()
  const today = fmt(now)
  switch (preset) {
    case 'today':  return { from: today, to: today }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      return { from: fmt(d), to: today }
    }
    case 'month': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return { from: fmt(d), to: today }
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return { from: fmt(d), to: today }
    }
    default: return { from: today, to: today }
  }
}

// ── Props ──
interface FilterBarProps {
  filter:   FilterState
  loading:  boolean
  onChange: (f: FilterState) => void
}

export default function FilterBar({ filter, loading, onChange }: FilterBarProps) {
  const [customFrom, setCustomFrom] = useState(filter.from)
  const [customTo,   setCustomTo]   = useState(filter.to)

  const applyPreset = useCallback((preset: TimePreset) => {
    if (preset === 'custom') {
      onChange({ ...filter, preset, from: customFrom || filter.from, to: customTo || filter.to })
    } else {
      const { from, to } = getDateRange(preset)
      onChange({ ...filter, preset, from, to })
    }
  }, [filter, customFrom, customTo, onChange])

  const applyCustom = useCallback(() => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ ...filter, preset: 'custom', from: customFrom, to: customTo })
    }
  }, [filter, customFrom, customTo, onChange])

  return (
    <div className="filter-bar">
      {/* الفترة الزمنية */}
      <div className="filter-presets">
        {PRESETS.map(p => (
          <button
            key={p.key}
            id={`preset-${p.key}`}
            className={`filter-preset-btn${filter.preset === p.key ? ' active' : ''}`}
            onClick={() => applyPreset(p.key)}
            disabled={loading}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* مدة مخصصة */}
      {filter.preset === 'custom' && (
        <div className="filter-custom-range">
          <label>من</label>
          <input
            type="date"
            className="filter-date-input"
            value={customFrom}
            max={customTo || undefined}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <label>إلى</label>
          <input
            type="date"
            className="filter-date-input"
            value={customTo}
            min={customFrom || undefined}
            onChange={e => setCustomTo(e.target.value)}
          />
          <button className="filter-apply-btn" onClick={applyCustom}>تطبيق</button>
        </div>
      )}

      {/* فاصل */}
      <div className="filter-divider" />

      {/* الملعب */}
      <select
        id="filter-court"
        className="filter-select"
        value={filter.court}
        onChange={e => onChange({ ...filter, court: e.target.value as CourtFilter })}
        disabled={loading}
      >
        {COURTS.map(c => (
          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
        ))}
      </select>

      {/* الحالة */}
      <select
        id="filter-status"
        className="filter-select"
        value={filter.status}
        onChange={e => onChange({ ...filter, status: e.target.value as StatusFilter })}
        disabled={loading}
      >
        {STATUSES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {/* مؤشر التحميل */}
      {loading && <div className="filter-spinner" />}

      <style>{`
        .filter-bar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2);
          background: var(--bg-elevated);
          border-radius: var(--radius-xl);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-subtle);
        }
        .filter-presets { display:flex;gap:var(--space-1);flex-wrap:wrap; }
        .filter-preset-btn {
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-family: 'Tajawal', sans-serif;
          transition: all 0.15s;
        }
        .filter-preset-btn.active  { background: var(--color-lime-muted); color: var(--color-lime); border-color: var(--color-lime-dim); }
        .filter-preset-btn:hover:not(.active):not(:disabled) { background: var(--bg-base); color: var(--text-primary); }
        .filter-preset-btn:disabled { opacity:0.5; cursor:not-allowed; }

        .filter-custom-range {
          display:flex;align-items:center;gap:var(--space-2);
          font-size:var(--text-sm);font-weight:var(--font-semibold);color:var(--text-secondary);
          font-family:'Tajawal',sans-serif;
        }
        .filter-date-input {
          padding:var(--space-1) var(--space-2);border-radius:var(--radius-md);
          border:1px solid var(--border-color);
          background: var(--bg-surface); color: var(--text-primary);
          font-size:var(--text-sm);font-family:'Tajawal',sans-serif;
          width:140px;
        }
        .filter-apply-btn {
          padding:var(--space-1) var(--space-3);border-radius:var(--radius-md);
          background:var(--color-lime);color:var(--text-on-lime);border:none;
          font-size:var(--text-sm);font-weight:var(--font-bold);cursor:pointer;
          font-family:'Tajawal',sans-serif;transition:all 0.15s;
        }
        .filter-apply-btn:hover { opacity:.9; }

        .filter-divider { width:1px;height:24px;background:var(--border-color); margin:0 var(--space-1); }

        .filter-select {
          padding:var(--space-1) var(--space-3);border-radius:var(--radius-md);
          font-size:var(--text-sm);font-weight:var(--font-semibold);
          border:1px solid var(--border-color);
          background:var(--bg-surface);color:var(--text-primary);
          font-family:'Tajawal',sans-serif;cursor:pointer;
          min-width:130px;appearance:auto;
        }
        .filter-select:focus { outline:none;border-color:var(--border-active);box-shadow:0 0 0 3px var(--color-lime-glow); }
        .filter-select:disabled { opacity:0.5;cursor:not-allowed; }

        .filter-spinner {
          width:18px;height:18px;border-radius:50%;
          border:2.5px solid var(--border-color);
          border-top-color:var(--color-lime);
          animation:spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        @media (max-width:768px) {
          .filter-bar { flex-direction:column;align-items:stretch; }
          .filter-presets { justify-content:center; }
          .filter-custom-range { flex-wrap:wrap;justify-content:center; }
          .filter-date-input { width:100%; }
          .filter-select { width:100%; }
          .filter-divider { display:none; }
        }
      `}</style>
    </div>
  )
}
