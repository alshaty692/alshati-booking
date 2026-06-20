'use client'
// ============================================================
// ExportAllBar — شريط التصدير الشامل
// يجمع كل الأقسام في ملف PDF أو Excel واحد
// ============================================================
interface Props {
  onExportAllPDF:   () => void
  onExportAllExcel: () => void
  loading:          boolean
}

export default function ExportAllBar({ onExportAllPDF, onExportAllExcel, loading }: Props) {
  return (
    <div className="export-all-bar">
      <span className="export-all-label">📦 تصدير شامل — كل الأقسام</span>
      <div className="export-all-btns">
        <button
          id="btn-all-pdf"
          className="sec-btn sec-btn-pdf"
          onClick={onExportAllPDF}
          disabled={loading}
        >
          📄 تصدير PDF الشامل
        </button>
        <button
          id="btn-all-excel"
          className="sec-btn sec-btn-excel"
          onClick={onExportAllExcel}
          disabled={loading}
        >
          📊 تصدير Excel الشامل
        </button>
      </div>

      <style>{`
        .export-all-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          background: #1B2A3B;
          border-radius: 0.875rem;
          padding: 1rem 1.25rem;
          margin-top: 1.5rem;
        }
        .export-all-label {
          font-size: 0.9rem;
          font-weight: 700;
          color: #C9A96E;
          font-family: 'Tajawal', sans-serif;
        }
        .export-all-btns { display:flex;gap:0.6rem;flex-wrap:wrap; }

        @media (max-width:600px) {
          .export-all-bar { flex-direction:column;align-items:stretch; }
          .export-all-btns { flex-direction:column; }
          .export-all-btns .sec-btn { width:100%;justify-content:center; }
        }
      `}</style>
    </div>
  )
}
