'use client'
// ============================================================
// Heatmap — خريطة حرارية مع Dropdown لاختيار الملعب
// البيانات مُحسوبة في السيرفر لكل ملعب منفصلاً
// ============================================================
import { useState } from 'react'
import type { ReportHeatmap, HeatGrid } from '@/types/reports'

const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }
const DAY_LABELS:   Record<number, string> = {
  0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء',
  3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت',
}

const COURT_OPTIONS = [
  { id: 'all',        label: 'كل الملاعب',     icon: '🏟️' },
  { id: 'football',   label: 'كرة القدم',      icon: '⚽' },
  { id: 'volleyball', label: 'الكرة الطائرة',  icon: '🏐' },
  { id: 'multi',      label: 'الملعب المتعدد', icon: '🏟️' },
]

function getCellStyle(pct: number): { background: string; color: string } {
  if (pct === 0)    return { background: '#f8fafc', color: '#1B2A3B' }
  if (pct < 25)     return { background: '#d1fae5', color: '#1B2A3B' }
  if (pct < 50)     return { background: '#6ee7b7', color: '#1B2A3B' }
  if (pct < 75)     return { background: '#2D5C4E', color: '#fff'    }
  return              { background: '#1B2A3B', color: '#C9A96E' }
}

interface HeatmapProps {
  data: ReportHeatmap
}

export default function Heatmap({ data }: HeatmapProps) {
  const [selected, setSelected] = useState<'all' | 'football' | 'volleyball' | 'multi'>('all')

  const grid: HeatGrid = data[selected] ?? data.all

  return (
    <div className="heatmap-section rpt-card" style={{ marginBottom: '1.25rem' }}>
      {/* رأس */}
      <div className="heatmap-header">
        <h3 className="rpt-card-title" style={{ margin: 0 }}>🔥 خريطة الإشغال</h3>
        <select
          id="heatmap-court-select"
          className="filter-select heatmap-court-select"
          value={selected}
          onChange={e => setSelected(e.target.value as typeof selected)}
        >
          {COURT_OPTIONS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>

      <p style={{ color:'#94a3b8', fontSize:'0.82rem', margin:'0.5rem 0 1rem' }}>
        توزيع الحجوزات المؤكدة حسب اليوم والفترة — اللون الداكن = إشغال أعلى
      </p>

      {/* الجدول */}
      <div style={{ overflowX: 'auto' }}>
        <table className="heat-table">
          <thead>
            <tr>
              <th className="heat-corner">اليوم / الفترة</th>
              {[1, 2, 3].map(p => (
                <th key={p} className="heat-th">{PERIOD_LABELS[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map(day => (
              <tr key={day}>
                <td className="heat-day-label">{DAY_LABELS[day]}</td>
                {[1, 2, 3].map(period => {
                  const cell = grid[day]?.[period] ?? { booked: 0, total: 0, pct: 0 }
                  const style = getCellStyle(cell.pct)
                  return (
                    <td key={period} className="heat-cell" style={style}>
                      <div className="heat-pct">{cell.pct}%</div>
                      <div className="heat-sub">{cell.booked}/{cell.total}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* مفتاح الألوان */}
      <div className="heat-legend">
        <span>منخفض</span>
        <div className="heat-legend-scale">
          {['#f8fafc', '#d1fae5', '#6ee7b7', '#2D5C4E', '#1B2A3B'].map(c => (
            <div key={c} style={{ width: 28, height: 14, background: c, borderRadius: 3, border: '1px solid #e2e8f0' }} />
          ))}
        </div>
        <span>ممتلئ</span>
      </div>

      <style>{`
        .heatmap-section { padding: 1.25rem; }
        .heatmap-header  { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem; }
        .heatmap-court-select { min-width:150px; font-size:0.82rem; }

        .heat-table      { border-collapse:collapse;width:100%;min-width:300px; }
        .heat-corner     { background:#F5F2EC;padding:0.6rem 1rem;font-size:0.8rem;font-weight:700;color:#1B2A3B;text-align:right;white-space:nowrap; }
        .heat-th         { padding:0.6rem 1rem;background:#1B2A3B;color:#C9A96E;font-size:0.85rem;font-weight:700;text-align:center;white-space:nowrap; }
        .heat-day-label  { padding:0.6rem 1rem;background:#F5F2EC;font-weight:700;font-size:0.85rem;color:#1B2A3B;white-space:nowrap;border-bottom:2px solid #fff; }
        .heat-cell       { padding:0.875rem 0.5rem;text-align:center;border:2px solid #fff;transition:all 0.2s;cursor:default; }
        .heat-cell:hover { transform:scale(1.05);z-index:1;position:relative;border-radius:4px; }
        .heat-pct        { font-weight:800;font-size:0.95rem; }
        .heat-sub        { font-size:0.62rem;opacity:0.7;margin-top:0.15rem; }

        .heat-legend       { display:flex;align-items:center;gap:0.75rem;margin-top:1rem;font-size:0.78rem;color:#94a3b8; }
        .heat-legend-scale { display:flex;gap:3px; }
      `}</style>
    </div>
  )
}
