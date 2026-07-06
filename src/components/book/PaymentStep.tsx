'use client'
// ============================================================
// PaymentStep — خطوة الدفع بالتحويل البنكي (خطوة 3)
// مستخرج من book/page.tsx
// Props:
//   totalAmount    — (price.final_price ?? 0) + waterTotal (محسوبة في الأب)
//   settings       — بيانات البنك من /api/settings
//   uploadFile     — الملف المختار حالياً (state من الأب)
//   uploading      — حالة الرفع (state من الأب)
//   error          — رسالة خطأ (state من الأب)
//   onFileChange   — يُحدّث uploadFile في الأب
//   onUpload       — uploadReceipt من الأب (لا تُكرَّر هنا)
// ============================================================
import { Upload, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { formatAmount } from '@/lib/utils'

interface PaymentStepProps {
  totalAmount:  number
  settings:     Record<string, string>
  uploadFile:   File | null
  uploading:    boolean
  error:        string
  onFileChange: (file: File | null) => void
  onUpload:     () => void
}

export default function PaymentStep({
  totalAmount,
  settings,
  uploadFile,
  uploading,
  error,
  onFileChange,
  onUpload,
}: PaymentStepProps) {
  return (
    <div className="book-step animate-slide-up">
      <h2 className="step-title">ادفع بالتحويل البنكي</h2>
      <p className="step-desc">حوّل المبلغ ثم ارفع صورة الإيصال</p>

      {/* بيانات البنك */}
      <div className="bank-card">
        <div className="bank-amount">{formatAmount(totalAmount)}</div>
        {[
          ['البنك',        settings.bank_name         || '—'],
          ['اسم الحساب',  settings.bank_account_name  || '—'],
          ['رقم الآيبان', settings.bank_iban           || '—'],
          ['رقم الحساب',  settings.bank_account_number || '—'],
        ].map(([label, value]) => (
          <div key={label} className="bank-detail">
            <span>{label}</span>
            <strong className="bank-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* رفع الإيصال */}
      <div className="upload-section">
        <h3>
          <Upload size={16} strokeWidth={2} />
          ارفع صورة الإيصال
        </h3>
        <div
          className="upload-area"
          onClick={() => document.getElementById('receipt-file')?.click()}
        >
          {uploadFile ? (
            <div className="upload-selected">
              <Upload size={18} strokeWidth={1.75} className="upload-file-icon" />
              <span>{uploadFile.name}</span>
              <span className="upload-size">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon-wrap">
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <p>اضغط لاختيار صورة الإيصال</p>
              <small>JPG, PNG, PDF — حد 5MB</small>
            </div>
          )}
        </div>
        {/* input خفي — id ثابت لضمان عمل onClick أعلاه */}
        <input
          id="receipt-file"
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={e => onFileChange(e.target.files?.[0] ?? null)}
        />
        {error && (
          <div className="bk-error bk-error-bar">
            <AlertTriangle size={14} strokeWidth={2} />
            {error}
          </div>
        )}
        <button
          id="btn-upload-receipt"
          className="btn-step-next"
          style={{ marginTop: '1rem' }}
          disabled={!uploadFile || uploading}
          onClick={onUpload}
        >
          {uploading
            ? <><Loader2 size={16} strokeWidth={2} className="bk-spin" />جاري الرفع...</>
            : <>رفع الإيصال<ArrowLeft size={16} strokeWidth={2.5} /></>
          }
        </button>
      </div>
    </div>
  )
}
