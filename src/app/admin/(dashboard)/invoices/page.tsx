'use client'
// ============================================================
// /admin/invoices — صفحة قائمة الفواتير
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Receipt, Search, X, ChevronRight, ChevronLeft, FileText, Download } from 'lucide-react'

/* ── أنواع ──────────────────────────────────────────────────── */
interface Customer { id: string; name: string; phone: string; customer_code: string }
interface Booking  { id: string; booking_date: string; court_id: string; period_number: number }

interface Invoice {
  id:                  string
  invoice_number:      string
  status:              'issued' | 'cancelled'
  payment_status:      'unpaid' | 'partial' | 'paid'
  issued_at:           string
  cancelled_at:        string | null
  total_amount:        number
  court_amount:        number
  base_price:          number
  discount_amount:     number
  discount_code:       string | null
  discount_percentage: number
  water_quantity:      number
  water_unit_price:    number
  water_total:         number
  batch_id:            string | null
  booking_id:          string | null
  customer_id:         string
  customers:           Customer | null
  bookings:            Booking | null
}

const COURT_LABELS: Record<string, string> = {
  football:   '⚽ كرة القدم',
  volleyball: '🏐 الكرة الطائرة',
  multi:      '🏀 الملعب المتعدد',
}
const PERIOD_LABELS: Record<number, string> = { 1: '5–7م', 2: '7–9م', 3: '9–11م' }

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  // BUG-02: استخدام السنة الحالية بدلاً من القيمة الثابتة 2025
  const d = new Date(new Date().getFullYear(), i, 1)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    // BUG-03: u-ca-gregory يضمن عرض الأشهر ميلادية على iOS
    label: d.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' }),
  }
}).reverse()

/* ── Modal تفاصيل الفاتورة ────────────────────────────────── */
function InvoiceModal({
  invoice,
  onClose,
  onCancel,
}: {
  invoice: Invoice
  onClose: () => void
  onCancel: (id: string) => Promise<void>
}) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)

  // ── حالة الدفعات ──────────────────────────────────────────
  const [payments, setPayments] = useState<{
    id: string; amount: number; payment_method: string;
    payment_method_label: string; payment_date: string;
    reference_number: string | null; notes: string | null;
  }[]>([])
  const [balance, setBalance] = useState<{
    total_amount: number; approved_cn_total: number;
    net_amount: number; paid_amount: number;
    balance_due: number; payment_status: string;
  } | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // ── حالة إشعارات الائتمان ─────────────────────────────────
  const [creditNotes, setCreditNotes] = useState<{
    id: string; credit_note_number: string; amount: number;
    reason: string; type: string; status: string;
    created_at: string;
  }[]>([])
  const [showCNForm, setShowCNForm] = useState(false)
  const [newCN, setNewCN] = useState({ amount: '', reason: '', type: 'price_adjustment', items: '' })
  const [savingCN, setSavingCN] = useState(false)
  const [cnError, setCNError] = useState('')

  const cust = invoice.customers
  const bk   = invoice.bookings

  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  // جلب الدفعات وإشعارات الائتمان
  useEffect(() => {
    if (invoice.status !== 'issued') return
    setPaymentsLoading(true)
    Promise.all([
      fetch(`/api/admin/payments?invoice_id=${invoice.id}`).then(r => r.json()),
      fetch(`/api/admin/credit-notes?invoice_id=${invoice.id}`).then(r => r.json()),
    ]).then(([pData, cnData]) => {
      setPayments(pData.payments ?? [])
      setBalance(pData.balance ?? null)
      setCreditNotes(cnData.credit_notes ?? [])
    }).finally(() => setPaymentsLoading(false))
  }, [invoice.id, invoice.status])

  async function handleCancel() {
    setCancelling(true)
    await onCancel(invoice.id)
    setCancelling(false)
    onClose()
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    setPaymentError('')
    setSavingPayment(true)
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id:      invoice.id,
          amount:          Number(newPayment.amount),
          payment_method:  newPayment.method,
          reference_number: newPayment.reference || undefined,
          notes:           newPayment.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setPaymentError(data.error); return }
      // تحديث البيانات
      setPayments(prev => [...prev, { id: data.payment_id, amount: Number(newPayment.amount), payment_method: newPayment.method, payment_method_label: newPayment.method, payment_date: new Date().toISOString().split('T')[0], reference_number: newPayment.reference || null, notes: newPayment.notes || null }])
      setBalance(data.balance)
      setNewPayment({ amount: '', method: 'bank_transfer', reference: '', notes: '' })
    } catch { setPaymentError('حدث خطأ') }
    finally { setSavingPayment(false) }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('حذف هذه الدفعة؟')) return
    const res = await fetch(`/api/admin/payments/${paymentId}`, { method: 'DELETE' })
    if (res.ok) {
      setPayments(prev => prev.filter(p => p.id !== paymentId))
      // إعادة تحميل الرصيد
      fetch(`/api/admin/payments?invoice_id=${invoice.id}`).then(r => r.json()).then(d => setBalance(d.balance))
    }
  }

  async function handleCreateCN(e: React.FormEvent) {
    e.preventDefault()
    setCNError('')
    setSavingCN(true)
    try {
      const res = await fetch('/api/admin/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id, amount: Number(newCN.amount), reason: newCN.reason, type: newCN.type, items: newCN.items || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setCNError(data.error); return }
      setCreditNotes(prev => [{ id: data.id, credit_note_number: data.credit_note_number, amount: Number(newCN.amount), reason: newCN.reason, type: newCN.type, status: 'draft', created_at: new Date().toISOString() }, ...prev])
      setNewCN({ amount: '', reason: '', type: 'price_adjustment', items: '' })
      setShowCNForm(false)
    } catch { setCNError('حدث خطأ') }
    finally { setSavingCN(false) }
  }

  async function handleApproveCN(cnId: string) {
    if (!confirm('اعتماد هذا الإشعار؟ لا يمكن التراجع عنه.')) return
    const res = await fetch(`/api/admin/credit-notes/${cnId}/approve`, { method: 'PATCH' })
    if (res.ok) {
      setCreditNotes(prev => prev.map(cn => cn.id === cnId ? { ...cn, status: 'approved' } : cn))
      fetch(`/api/admin/payments?invoice_id=${invoice.id}`).then(r => r.json()).then(d => setBalance(d.balance))
    }
  }

  async function handleCancelCN(cnId: string) {
    const reason = prompt('سبب الإلغاء (اختياري):')
    if (reason === null) return // ضغط Cancel في prompt
    const res = await fetch(`/api/admin/credit-notes/${cnId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_reason: reason }),
    })
    if (res.ok) {
      setCreditNotes(prev => prev.map(cn => cn.id === cnId ? { ...cn, status: 'cancelled' } : cn))
    }
  }

  const CN_TYPE_LABELS: Record<string, string> = {
    price_adjustment: 'تعديل سعر',
    partial_refund:   'استرداد جزئي',
    error_correction: 'تصحيح خطأ',
  }

  // ── تصدير PDF — نفس نهج التقارير (off-screen HTML string) ────
  async function handleExportPDF() {
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      // تحميل خط Tajawal قبل الرسم
      const FONT_URL = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=block'
      if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'; link.href = FONT_URL
        document.head.appendChild(link)
      }
      await document.fonts.ready
      await Promise.allSettled([
        document.fonts.load('700 20px Tajawal', 'فاتورة'),
        document.fonts.load('400 14px Tajawal', 'فاتورة'),
      ])

      // بناء HTML الفاتورة
      const discountRow = invoice.discount_amount > 0
        ? `<tr style="color:#d97706;border-bottom:1px solid #eee"><td style="padding:.4rem .6rem">خصم${invoice.discount_code ? ` (${invoice.discount_code})` : ''}${invoice.discount_percentage > 0 ? ` — ${invoice.discount_percentage}%` : ''}</td><td style="padding:.4rem .6rem;text-align:left;direction:ltr">−${fmt(invoice.discount_amount)} ر</td></tr>` : ''

      const waterRow = invoice.water_quantity > 0
        ? `<tr style="border-bottom:1px solid #eee"><td style="padding:.4rem .6rem">مياه (${invoice.water_quantity} كرتون × ${fmt(invoice.water_unit_price)} ر)</td><td style="padding:.4rem .6rem;text-align:left;direction:ltr">${fmt(invoice.water_total)} ر</td></tr>` : ''

      const bookingSection = bk
        ? `<div class="section"><div class="section-title">تفاصيل الحجز</div><div class="grid"><div class="field"><span class="label">الملعب</span><strong>${COURT_LABELS[bk.court_id] ?? bk.court_id}</strong></div><div class="field"><span class="label">الفترة</span><strong>${PERIOD_LABELS[bk.period_number] ?? bk.period_number}</strong></div><div class="field" style="grid-column:1/-1"><span class="label">التاريخ</span><strong>${new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</strong></div></div></div>`
        : invoice.batch_id ? `<div class="section"><div class="section-title">باقة</div><p>فاتورة مجمّعة للباقة</p></div>` : ''

      const approvedCNs = creditNotes.filter(cn => cn.status !== 'cancelled')
      const cnSection = approvedCNs.length > 0
        ? `<div class="section"><div class="section-title">إشعارات الائتمان</div>${approvedCNs.map(cn => `<div style="display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid #eee;font-size:11px"><span>${cn.credit_note_number} — ${cn.reason}</span><span style="color:#ef4444">−${fmt(cn.amount)} ر (${cn.status === 'approved' ? 'معتمد' : 'مسودة'})</span></div>`).join('')}</div>` : ''

      const balanceSection = balance
        ? `<div class="section"><div class="section-title">الرصيد المالي</div><div class="balance-row"><span>المُفوتَر</span><span>${fmt(balance.total_amount)} ر</span></div>${balance.approved_cn_total > 0 ? `<div class="balance-row" style="color:#d97706"><span>إشعارات ائتمان</span><span>−${fmt(balance.approved_cn_total)} ر</span></div>` : ''}<div class="balance-row"><span>المدفوع</span><span style="color:#16a34a">${fmt(balance.paid_amount)} ر</span></div><div class="balance-row" style="font-weight:700"><span>المتبقي</span><span style="color:${balance.balance_due > 0 ? '#dc2626' : '#16a34a'}">${fmt(balance.balance_due)} ر</span></div></div>` : ''

      const html = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=block');
          * { box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal',Arial,sans-serif;direction:rtl; }
          .invoice-pdf { width:620px;padding:28px;background:#fff;color:#111; }
          .header { display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #7bba00;margin-bottom:16px; }
          .header-title { font-size:22px;font-weight:800;color:#7bba00; }
          .header-num { font-size:13px;font-weight:700;margin-top:4px; }
          .header-date { font-size:10px;color:#666;margin-top:2px; }
          .section { margin-bottom:12px;padding:10px 12px;background:#f8f9fa;border-radius:6px; }
          .section-title { font-size:9px;text-transform:uppercase;color:#5a8a00;font-weight:700;letter-spacing:.06em;margin-bottom:8px; }
          .grid { display:grid;grid-template-columns:1fr 1fr;gap:5px 12px; }
          .field { display:flex;flex-direction:column;gap:2px; }
          .label { font-size:8px;color:#888;font-weight:600;text-transform:uppercase; }
          .field strong { font-size:12px;font-weight:700; }
          table { width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px; }
          thead tr { background:#1a1a1a; }
          th { padding:.4rem .6rem;text-align:right;font-weight:700;color:#c8ff3e; }
          td { padding:.35rem .6rem;border-bottom:1px solid #eee; }
          .total-row td { background:#f0f0f0;font-weight:700;font-size:13px; }
          .balance-row { display:flex;justify-content:space-between;padding:.3rem 0;font-size:11px;border-bottom:1px solid #eee; }
          .footer { text-align:center;color:#999;font-size:8px;margin-top:14px;padding-top:8px;border-top:1px solid #eee; }
        </style>
        <div class="invoice-pdf">
          <div class="header">
            <div>
              <div class="header-title">فاتورة</div>
              <div class="header-num">${invoice.invoice_number}</div>
              <div class="header-date">تاريخ الإصدار: ${new Date(invoice.issued_at).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric' })}</div>
            </div>
            <div style="text-align:left;font-size:11px;color:#666;font-weight:600">الشاطئ للحجوزات</div>
          </div>
          <div class="section">
            <div class="section-title">بيانات العميل</div>
            <div class="grid">
              <div class="field"><span class="label">الاسم</span><strong>${cust?.name ?? '—'}</strong></div>
              <div class="field"><span class="label">الكود</span><strong>${cust?.customer_code ?? '—'}</strong></div>
              <div class="field" style="direction:ltr"><span class="label" style="direction:rtl">الجوال</span><strong>${cust?.phone ?? '—'}</strong></div>
            </div>
          </div>
          ${bookingSection}
          <table>
            <thead><tr><th>البند</th><th style="text-align:left;direction:ltr">المبلغ</th></tr></thead>
            <tbody>
              <tr style="border-bottom:1px solid #eee"><td>سعر الملعب${invoice.batch_id ? ' (مجموع)' : ''}</td><td style="text-align:left;direction:ltr">${fmt(invoice.base_price)} ر</td></tr>
              ${discountRow}
              ${waterRow}
              <tr class="total-row"><td>الإجمالي</td><td style="text-align:left;direction:ltr">${fmt(invoice.total_amount)} ر</td></tr>
            </tbody>
          </table>
          ${balanceSection}
          ${cnSection}
          <div class="footer">${invoice.invoice_number} · ${new Date(invoice.issued_at).toLocaleDateString('ar-SA-u-ca-gregory')}</div>
        </div>`

      // التقاط off-screen — نفس أسلوب captureChunk بالتقارير
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-9999;'
      container.innerHTML = html
      document.body.appendChild(container)
      await new Promise(r => setTimeout(r, 300))

      // استبدل كل .section-title بصورة canvas — يحل مشكلة بيانات لعمهل / تفصيل لحجز
      const sectionTitles = Array.from(container.querySelectorAll('.section-title'))
      for (const titleEl of sectionTitles) {
        const titleText = (titleEl as HTMLElement).textContent?.trim() ?? ''
        if (!titleText) continue
        const cvs = document.createElement('canvas')
        cvs.width = 580; cvs.height = 22
        const ctx = cvs.getContext('2d')!
        ctx.clearRect(0, 0, 580, 22)
        ctx.font         = '700 11px Tajawal, Arial'
        ctx.fillStyle    = '#5a8a00'
        ctx.textAlign    = 'right'
        ctx.direction    = 'rtl'
        ctx.textBaseline = 'middle'
        ctx.fillText(titleText, 570, 11)
        const img = document.createElement('img')
        img.src = cvs.toDataURL('image/png')
        img.style.cssText = 'display:block;width:580px;height:22px;margin-bottom:8px;'
        ;(titleEl as HTMLElement).replaceWith(img)
      }

      // استبدل .header-title بصورة canvas — نفس مشكلة bold ligatures
      const headerTitle = container.querySelector('.header-title') as HTMLElement | null
      if (headerTitle) {
        const cvs = document.createElement('canvas')
        cvs.width = 200; cvs.height = 36
        const ctx = cvs.getContext('2d')!
        ctx.clearRect(0, 0, 200, 36)
        ctx.font         = '800 22px Tajawal, Arial'
        ctx.fillStyle    = '#7bba00'
        ctx.textAlign    = 'right'
        ctx.direction    = 'rtl'
        ctx.textBaseline = 'middle'
        ctx.fillText('فاتورة', 190, 18)
        const img = document.createElement('img')
        img.src = cvs.toDataURL('image/png')
        img.style.cssText = 'display:block;width:200px;height:36px;'
        headerTitle.replaceWith(img)
      }

      const el = container.querySelector('.invoice-pdf') as HTMLElement | null
      if (!el) { document.body.removeChild(container); return }

      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 680,
      })
      document.body.removeChild(container)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const MARGIN = 10
      const CONT_W = pdf.internal.pageSize.getWidth() - MARGIN * 2
      const imgH = (canvas.height * CONT_W) / canvas.width
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, CONT_W, imgH)
      pdf.save(`${invoice.invoice_number}.pdf`)
    } catch (e) {
      console.error('[PDF]', e)
    }
  }

  return createPortal(
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="inv-number">{invoice.invoice_number}</span>
            <span className={`inv-badge ${invoice.status}`}>
              {invoice.status === 'issued' ? '✅ مُصدرة' : '❌ ملغاة'}
            </span>
            {invoice.status === 'issued' && balance && (
              <span className={`inv-badge inv-pay-${balance.payment_status}`}>
                {balance.payment_status === 'paid' ? '💰 مدفوعة' :
                 balance.payment_status === 'partial' ? '🔶 جزئي' : '⏳ غير مدفوعة'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              id={`btn-pdf-${invoice.id}`}
              className="inv-pdf-btn"
              onClick={handleExportPDF}
              title="تصدير PDF"
            >
              <Download size={14} /> PDF
            </button>
            <button className="inv-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* ── أقسام الـ Modal ── */}

        {/* بيانات العميل */}
        <section className="inv-section">
          <h3 className="inv-section-title">👤 بيانات العميل</h3>
          <div className="inv-grid-2">
            <div className="inv-field">
              <span className="inv-field-label">الاسم</span>
              <strong className="inv-field-val">{cust?.name ?? '—'}</strong>
            </div>
            <div className="inv-field">
              <span className="inv-field-label">الكود</span>
              <strong className="inv-code">{cust?.customer_code ?? '—'}</strong>
            </div>
            <div className="inv-field" style={{ direction: 'ltr' }}>
              <span className="inv-field-label" style={{ direction: 'rtl' }}>الجوال</span>
              <strong className="inv-field-val">{cust?.phone ?? '—'}</strong>
            </div>
          </div>
        </section>

        {/* تفاصيل الحجز */}
        {(bk || invoice.batch_id) && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              🏟️ {invoice.batch_id ? `باقة — ${invoice.batch_id}` : 'تفاصيل الحجز'}
            </h3>
            {bk ? (
              <div className="inv-grid-2">
                <div className="inv-field">
                  <span className="inv-field-label">الملعب</span>
                  <strong className="inv-field-val">{COURT_LABELS[bk.court_id] ?? bk.court_id}</strong>
                </div>
                <div className="inv-field">
                  <span className="inv-field-label">الفترة</span>
                  <strong className="inv-field-val">{PERIOD_LABELS[bk.period_number] ?? bk.period_number}</strong>
                </div>
                <div className="inv-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="inv-field-label">التاريخ</span>
                  <strong className="inv-field-val">{new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>فاتورة مجمّعة للباقة</div>
            )}
          </section>
        )}

        {/* بنود الفاتورة */}
        <section className="inv-section">
          <h3 className="inv-section-title">🧾 بنود الفاتورة</h3>
          <div className="inv-line-items">
            <div className="inv-item">
              <span>سعر الملعب{invoice.batch_id ? ' (مجموع)' : ''}</span>
              <span>{fmt(invoice.base_price)} ر</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="inv-item inv-discount">
                <span>خصم{invoice.discount_code ? ` (${invoice.discount_code})` : ''}{invoice.discount_percentage > 0 ? ` — ${invoice.discount_percentage}%` : ''}</span>
                <span>−{fmt(invoice.discount_amount)} ر</span>
              </div>
            )}
            {invoice.water_quantity > 0 && (
              <div className="inv-item">
                <span>مياه ({invoice.water_quantity} × {fmt(invoice.water_unit_price)} ر)</span>
                <span>{fmt(invoice.water_total)} ر</span>
              </div>
            )}
            <div className="inv-item inv-total">
              <span>الإجمالي</span>
              <span>{fmt(invoice.total_amount)} ر</span>
            </div>
          </div>
        </section>

        {/* الرصيد المالي */}
        {invoice.status === 'issued' && balance && (
          <section className="inv-section">
            <h3 className="inv-section-title">💳 الرصيد المالي</h3>
            <div className="inv-balance-cards">
              <div className="inv-bc">
                <div className="inv-bc-label">المُفوتَر</div>
                <div className="inv-bc-val">{fmt(balance.total_amount)}<span>ر</span></div>
              </div>
              {balance.approved_cn_total > 0 && (
                <div className="inv-bc inv-bc-cn">
                  <div className="inv-bc-label">إشعارات ائتمان</div>
                  <div className="inv-bc-val">−{fmt(balance.approved_cn_total)}<span>ر</span></div>
                </div>
              )}
              <div className="inv-bc inv-bc-paid">
                <div className="inv-bc-label">المدفوع</div>
                <div className="inv-bc-val">{fmt(balance.paid_amount)}<span>ر</span></div>
              </div>
              <div className={`inv-bc ${balance.balance_due > 0 ? 'inv-bc-due' : 'inv-bc-clear'}`}>
                <div className="inv-bc-label">المتبقي</div>
                <div className="inv-bc-val inv-bc-due-val">{fmt(balance.balance_due)}<span>ر</span></div>
              </div>
            </div>
          </section>
        )}

        {/* قسم الدفعات */}
        {invoice.status === 'issued' && (
          <section className="inv-section">
            <h3 className="inv-section-title">💵 الدفعات ({payments.length})</h3>
            {paymentsLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '.85rem', padding: '.5rem 0' }}>جاري التحميل...</div>
            ) : (
              <>
                {payments.length > 0 && (
                  <div className="inv-payments-list">
                    {payments.map(p => (
                      <div key={p.id} className="inv-payment-row">
                        <div className="inv-payment-info">
                          <span className="inv-payment-amount">{fmt(p.amount)} ر</span>
                          <span className="inv-payment-meta">{p.payment_method_label} · {p.payment_date}</span>
                          {p.reference_number && <span className="inv-payment-ref"># {p.reference_number}</span>}
                        </div>
                        <button className="inv-payment-del" onClick={() => handleDeletePayment(p.id)} title="حذف الدفعة">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {balance && balance.balance_due > 0 && (
                  <form className="inv-pay-form" onSubmit={handleRecordPayment}>
                    <div className="inv-pay-form-title">+ تسجيل دفعة</div>
                    <div className="inv-pay-form-row">
                      <input type="number" placeholder={`المبلغ (متبقي: ${fmt(balance.balance_due)} ر)`}
                        value={newPayment.amount} min="0.01" step="0.01" max={balance.balance_due}
                        onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                        className="inv-pay-input" required />
                      <select value={newPayment.method} onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))} className="inv-pay-select">
                        <option value="bank_transfer">تحويل بنكي</option>
                        <option value="cash">نقداً</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                    <input type="text" placeholder="رقم المرجع / التحويل (اختياري)"
                      value={newPayment.reference} onChange={e => setNewPayment(p => ({ ...p, reference: e.target.value }))} className="inv-pay-input" />
                    {paymentError && <div className="inv-pay-error">{paymentError}</div>}
                    <button type="submit" className="inv-pay-submit" disabled={savingPayment}>
                      {savingPayment ? 'جاري الحفظ...' : 'حفظ الدفعة'}
                    </button>
                  </form>
                )}
                {balance && balance.balance_due <= 0 && (
                  <div style={{ color: '#22c55e', fontSize: '.85rem', padding: '.35rem 0' }}>✅ مدفوعة بالكامل</div>
                )}
              </>
            )}
          </section>
        )}

        {/* قسم إشعارات الائتمان */}
        {invoice.status === 'issued' && (
          <section className="inv-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
              <h3 className="inv-section-title" style={{ margin: 0 }}>📋 إشعارات الائتمان ({creditNotes.filter(cn => cn.status !== 'cancelled').length})</h3>
              {!showCNForm && (
                <button className="inv-cn-add-btn" onClick={() => setShowCNForm(true)}>+ إنشاء إشعار</button>
              )}
            </div>
            {creditNotes.length > 0 && (
              <div className="inv-cn-list">
                {creditNotes.map(cn => (
                  <div key={cn.id} className={`inv-cn-row inv-cn-${cn.status}`}>
                    <div className="inv-cn-main">
                      <span className="inv-cn-number">{cn.credit_note_number}</span>
                      <span className="inv-cn-amount">−{fmt(cn.amount)} ر</span>
                      <span className={`inv-cn-status inv-cn-s-${cn.status}`}>
                        {cn.status === 'draft' ? 'مسودة' : cn.status === 'approved' ? '✅ معتمد' : '❌ ملغى'}
                      </span>
                    </div>
                    <div className="inv-cn-reason">{cn.reason} · {CN_TYPE_LABELS[cn.type] ?? cn.type}</div>
                    <div className="inv-cn-actions">
                      {cn.status === 'draft' && (
                        <>
                          <button className="inv-cn-approve" onClick={() => handleApproveCN(cn.id)}>اعتماد</button>
                          <button className="inv-cn-cancel-btn" onClick={() => handleCancelCN(cn.id)}>إلغاء</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showCNForm && (
              <form className="inv-cn-form" onSubmit={handleCreateCN}>
                <div className="inv-pay-form-title">إشعار ائتمان جديد</div>
                <div className="inv-pay-form-row">
                  <input type="number" placeholder="المبلغ" value={newCN.amount} min="0.01" step="0.01"
                    onChange={e => setNewCN(c => ({ ...c, amount: e.target.value }))} className="inv-pay-input" required />
                  <select value={newCN.type} onChange={e => setNewCN(c => ({ ...c, type: e.target.value }))} className="inv-pay-select">
                    <option value="price_adjustment">تعديل سعر</option>
                    <option value="partial_refund">استرداد جزئي</option>
                    <option value="error_correction">تصحيح خطأ</option>
                  </select>
                </div>
                <input type="text" placeholder="السبب (مطلوب)" value={newCN.reason}
                  onChange={e => setNewCN(c => ({ ...c, reason: e.target.value }))} className="inv-pay-input" required />
                <input type="text" placeholder="البنود المتأثرة (اختياري)" value={newCN.items}
                  onChange={e => setNewCN(c => ({ ...c, items: e.target.value }))} className="inv-pay-input" />
                {cnError && <div className="inv-pay-error">{cnError}</div>}
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button type="submit" className="inv-pay-submit" disabled={savingCN}>
                    {savingCN ? 'جاري الحفظ...' : 'إنشاء كمسودة'}
                  </button>
                  <button type="button" className="inv-cancel-back" onClick={() => setShowCNForm(false)}>إلغاء</button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* تاريخ الإصدار */}
        <section className="inv-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            📅 تاريخ الإصدار: <strong>{new Date(invoice.issued_at).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
          </div>
          {invoice.cancelled_at && (
            <div style={{ fontSize: '.8rem', color: 'var(--color-danger)' }}>
              ❌ تاريخ الإلغاء: <strong>{new Date(invoice.cancelled_at).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
            </div>
          )}
        </section>

        {/* إلغاء يدوي */}
        {invoice.status === 'issued' && (
          <div className="inv-actions">
            {!showCancelForm ? (
              <button className="inv-cancel-btn" onClick={() => setShowCancelForm(true)}>
                ❌ إلغاء الفاتورة يدوياً
              </button>
            ) : (
              <div className="inv-cancel-form">
                <input className="inv-cancel-input" placeholder="سبب الإلغاء (اختياري)"
                  value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                <div className="inv-cancel-btns">
                  <button className="inv-cancel-confirm" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
                  </button>
                  <button className="inv-cancel-back" onClick={() => setShowCancelForm(false)}>رجوع</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ── الصفحة الرئيسية ─────────────────────────────────────── */
export default function InvoicesPage() {
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [selected,  setSelected]  = useState<Invoice | null>(null)

  // فلاتر
  const [statusFilter,  setStatusFilter]  = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [monthFilter,   setMonthFilter]   = useState('')
  const [search,        setSearch]        = useState('')
  const [searchInput,   setSearchInput]   = useState('')

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter)  params.set('status',         statusFilter)
    if (paymentFilter) params.set('payment_status', paymentFilter)
    if (monthFilter)   params.set('month',          monthFilter)
    if (search)        params.set('search',         search)
    params.set('page', String(page))

    const res  = await fetch(`/api/admin/invoices?${params}`)
    const data = await res.json()
    setInvoices(data.invoices ?? [])
    setTotal(data.total ?? 0)
    setPages(data.pages ?? 1)
    setLoading(false)
  }, [statusFilter, paymentFilter, monthFilter, search, page])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  async function handleCancelInvoice(id: string) {
    const reason = (document.querySelector('.inv-cancel-input') as HTMLInputElement)?.value ?? ''
    await fetch(`/api/admin/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_reason: reason }),
    })
    await fetchInvoices()
  }

  const issued    = invoices.filter(i => i.status === 'issued')
  const totalIssued = issued.reduce((s, i) => s + i.total_amount, 0)
  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return (
    <div className="inv-page">
      <style>{`
        .inv-page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
        .inv-page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:.75rem; }
        .inv-page-title { display:flex; align-items:center; gap:.5rem; font-size:1.5rem; font-weight:700; }
        .inv-stats { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.25rem; }
        .inv-stat { background:var(--card); border:1px solid var(--border); border-radius:.75rem; padding:.75rem 1.25rem; flex:1; min-width:140px; }
        .inv-stat-val { font-size:1.4rem; font-weight:700; }
        .inv-stat-lbl { font-size:.8rem; color:var(--text-muted); margin-top:.1rem; }
        .inv-filters { display:flex; gap:.75rem; flex-wrap:wrap; margin-bottom:1.25rem; }
        .inv-select { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.45rem .75rem; font-size:.875rem; color:var(--text); min-width:140px; }
        .inv-search { display:flex; gap:.5rem; flex:1; min-width:200px; }
        .inv-search input { flex:1; background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.45rem .75rem; font-size:.875rem; color:var(--text); }
        .inv-search button { background:var(--primary); color:#fff; border:none; border-radius:.5rem; padding:.45rem .9rem; cursor:pointer; display:flex; align-items:center; gap:.3rem; }
        .inv-table-wrap { overflow-x:auto; border-radius:.75rem; border:1px solid var(--border); background:var(--card); }
        .inv-table { width:100%; border-collapse:collapse; }
        .inv-table th { padding:.75rem 1rem; text-align:right; font-size:.8rem; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap; }
        .inv-table td { padding:.85rem 1rem; border-bottom:1px solid var(--border); font-size:.875rem; vertical-align:middle; }
        .inv-table tr:last-child td { border-bottom:none; }
        .inv-table tr:hover td { background:var(--muted); }
        .inv-table tr { cursor:pointer; }
        .inv-badge { display:inline-flex; align-items:center; gap:.25rem; padding:.2rem .6rem; border-radius:999px; font-size:.75rem; font-weight:600; }
        .inv-badge.issued    { background:#d1fae5; color:#065f46; }
        .inv-badge.cancelled { background:#fee2e2; color:#991b1b; }
        .dark .inv-badge.issued    { background:#064e3b; color:#6ee7b7; }
        .dark .inv-badge.cancelled { background:#7f1d1d; color:#fca5a5; }
        .inv-badge.inv-pay-paid    { background:#d1fae5; color:#065f46; }
        .inv-badge.inv-pay-partial { background:#fef3c7; color:#92400e; }
        .inv-badge.inv-pay-unpaid  { background:#f3f4f6; color:#6b7280; }
        .dark .inv-badge.inv-pay-paid    { background:#064e3b; color:#6ee7b7; }
        .dark .inv-badge.inv-pay-partial { background:#451a03; color:#fcd34d; }
        .dark .inv-badge.inv-pay-unpaid  { background:#1f2937; color:#9ca3af; }
        /* Balance */
        .inv-balance-bar { display:flex; flex-direction:column; gap:.3rem; }
        .inv-balance-item { display:flex; justify-content:space-between; font-size:.875rem; padding:.25rem 0; }
        .inv-balance-label { color:var(--text-muted); }
        .inv-balance-net { font-weight:700; }
        .inv-balance-cn .inv-balance-val { color:#f59e0b; }
        .inv-balance-paid .inv-balance-val { color:#22c55e; }
        .inv-balance-overdue .inv-balance-due-val { color:#ef4444; font-weight:700; }
        .inv-balance-clear .inv-balance-due-val { color:#22c55e; font-weight:700; }
        /* Payments */
        .inv-payments-list { display:flex; flex-direction:column; gap:.3rem; margin-bottom:.75rem; }
        .inv-payment-row { display:flex; justify-content:space-between; align-items:center; gap:.5rem; background:var(--bg-elevated,var(--muted)); border-radius:.5rem; padding:.4rem .6rem; }
        .inv-payment-info { display:flex; flex-direction:column; gap:.1rem; flex:1; }
        .inv-payment-amount { font-weight:700; font-size:.9rem; }
        .inv-payment-meta { font-size:.75rem; color:var(--text-muted); }
        .inv-payment-ref { font-size:.72rem; color:var(--text-muted); font-family:monospace; }
        .inv-payment-del { background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:.9rem; padding:.2rem .4rem; border-radius:.3rem; }
        .inv-payment-del:hover { color:#ef4444; background:#fef2f2; }
        .inv-pay-form { display:flex; flex-direction:column; gap:.5rem; margin-top:.5rem; background:var(--muted); border-radius:.5rem; padding:.75rem; }
        .inv-pay-form-title { font-size:.8rem; font-weight:600; color:var(--text-muted); }
        .inv-pay-form-row { display:flex; gap:.5rem; }
        .inv-pay-input { flex:1; background:var(--card); border:1px solid var(--border); border-radius:.4rem; padding:.4rem .6rem; font-size:.85rem; color:var(--text); }
        .inv-pay-select { background:var(--card); border:1px solid var(--border); border-radius:.4rem; padding:.4rem .6rem; font-size:.85rem; color:var(--text); }
        .inv-pay-submit { background:var(--primary,#7bba00); color:#fff; border:none; border-radius:.4rem; padding:.5rem; cursor:pointer; font-size:.875rem; }
        .inv-pay-submit:disabled { opacity:.6; cursor:not-allowed; }
        .inv-pay-error { color:#ef4444; font-size:.8rem; }
        /* Credit Notes */
        .inv-cn-add-btn { background:transparent; border:1px dashed var(--border); border-radius:.4rem; padding:.25rem .6rem; font-size:.78rem; cursor:pointer; color:var(--text-muted); }
        .inv-cn-add-btn:hover { border-color:var(--primary); color:var(--primary); }
        .inv-cn-list { display:flex; flex-direction:column; gap:.4rem; margin-bottom:.75rem; }
        .inv-cn-row { background:var(--muted); border-radius:.5rem; padding:.5rem .7rem; border-right:3px solid transparent; }
        .inv-cn-approved { border-right-color:#22c55e; }
        .inv-cn-draft { border-right-color:#f59e0b; }
        .inv-cn-cancelled { opacity:.5; }
        .inv-cn-main { display:flex; align-items:center; gap:.5rem; margin-bottom:.2rem; }
        .inv-cn-number { font-size:.8rem; font-family:monospace; font-weight:700; }
        .inv-cn-amount { font-weight:700; color:#ef4444; font-size:.9rem; flex:1; }
        .inv-cn-s-draft { color:#f59e0b; font-size:.75rem; }
        .inv-cn-s-approved { color:#22c55e; font-size:.75rem; }
        .inv-cn-s-cancelled { color:var(--text-muted); font-size:.75rem; }
        .inv-cn-reason { font-size:.78rem; color:var(--text-muted); margin-bottom:.3rem; }
        .inv-cn-actions { display:flex; gap:.4rem; }
        .inv-cn-approve { background:#22c55e; color:#fff; border:none; border-radius:.3rem; padding:.2rem .5rem; font-size:.75rem; cursor:pointer; }
        .inv-cn-cancel-btn { background:transparent; border:1px solid #ef4444; color:#ef4444; border-radius:.3rem; padding:.2rem .5rem; font-size:.75rem; cursor:pointer; }
        .inv-cn-form { background:var(--muted); border-radius:.5rem; padding:.75rem; display:flex; flex-direction:column; gap:.5rem; margin-top:.5rem; }
        .inv-number { font-weight:700; font-size:.875rem; }
        .inv-customer-code { font-size:.75rem; color:var(--text-muted); }
        .inv-amount { font-weight:700; text-align:left; direction:ltr; }
        .inv-pagination { display:flex; align-items:center; justify-content:center; gap:.75rem; margin-top:1.25rem; }
        .inv-pg-btn { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.4rem .8rem; cursor:pointer; color:var(--text); display:flex; align-items:center; }
        .inv-pg-btn:disabled { opacity:.4; cursor:default; }
        .inv-pg-info { font-size:.875rem; color:var(--text-muted); }
        .inv-empty { text-align:center; padding:3rem; color:var(--text-muted); }
        /* PDF btn */
        .inv-pdf-btn { display:inline-flex; align-items:center; gap:.35rem; background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:.5rem; padding:.3rem .7rem; font-size:.78rem; font-weight:600; cursor:pointer; color:var(--text-secondary); transition:all .15s; }
        .inv-pdf-btn:hover { border-color:var(--color-lime); color:var(--color-lime); }
        /* Grid layout for fields */
        .inv-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:.3rem .75rem; }
        .inv-field { display:flex; flex-direction:column; gap:.15rem; padding:.35rem 0; }
        .inv-field-label { font-size:.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
        .inv-field-val { font-size:.9rem; font-weight:600; color:var(--text-primary); }
        /* Balance cards */
        .inv-balance-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(100px,1fr)); gap:.5rem; }
        .inv-bc { background:var(--bg-elevated); border-radius:.6rem; padding:.5rem .65rem; border:1px solid var(--border-subtle); }
        .inv-bc-label { font-size:.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; margin-bottom:.2rem; }
        .inv-bc-val { font-size:1.05rem; font-weight:800; color:var(--text-primary); }
        .inv-bc-val span { font-size:.7rem; margin-right:.1rem; }
        .inv-bc-cn .inv-bc-val { color:#f59e0b; }
        .inv-bc-paid .inv-bc-val { color:#22c55e; }
        .inv-bc-due { border-color:#ef4444; }
        .inv-bc-due .inv-bc-due-val { color:#ef4444; }
        .inv-bc-clear .inv-bc-due-val { color:#22c55e; }
        /* Modal */
        .inv-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(2px); }
        .inv-modal { background:var(--card); border-radius:1rem; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; }
        .inv-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.25rem .75rem; border-bottom:1px solid var(--border); }
        .inv-number { font-size:1rem; font-weight:700; }
        .inv-close-btn { background:none; border:none; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; }
        .inv-section { padding:.85rem 1.25rem; border-bottom:1px solid var(--border); }
        .inv-section:last-child { border-bottom:none; }
        .inv-section-title { font-size:.7rem; text-transform:uppercase; color:var(--color-lime-dim); margin:0 0 .6rem; font-weight:700; letter-spacing:.06em; }
        .inv-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.3rem 0; font-size:.875rem; }
        .inv-row span { color:var(--text-muted); }
        .inv-code { background:var(--muted); padding:.15rem .5rem; border-radius:.375rem; font-size:.8rem; font-weight:700; }
        .inv-line-items { display:flex; flex-direction:column; gap:.35rem; }
        .inv-item { display:flex; justify-content:space-between; font-size:.875rem; padding:.2rem 0; }
        .inv-discount { color:#f59e0b; }
        .inv-total { border-top:1px solid var(--border); padding-top:.5rem; margin-top:.25rem; font-weight:700; font-size:1rem; }
        .inv-actions { padding:1rem 1.25rem; }
        .inv-cancel-btn { width:100%; background:transparent; border:1.5px solid #ef4444; color:#ef4444; border-radius:.5rem; padding:.6rem; cursor:pointer; font-size:.875rem; }
        .inv-cancel-btn:hover { background:#fef2f2; }
        .inv-cancel-form { display:flex; flex-direction:column; gap:.5rem; }
        .inv-cancel-input { background:var(--card); border:1px solid var(--border); border-radius:.5rem; padding:.5rem .75rem; font-size:.875rem; color:var(--text); }
        .inv-cancel-btns { display:flex; gap:.5rem; }
        .inv-cancel-confirm { flex:1; background:#ef4444; color:#fff; border:none; border-radius:.5rem; padding:.55rem; cursor:pointer; }
        .inv-cancel-back { background:var(--muted); border:none; border-radius:.5rem; padding:.55rem 1rem; cursor:pointer; color:var(--text); }
      `}</style>

      {/* Header */}
      <div className="inv-page-header">
        <h1 className="inv-page-title">
          <Receipt size={22} /> الفواتير
        </h1>
      </div>

      {/* Stats */}
      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-val">{total}</div>
          <div className="inv-stat-lbl">إجمالي الفواتير</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{invoices.filter(i => i.status === 'issued').length}</div>
          <div className="inv-stat-lbl">مُصدرة</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{fmt(totalIssued)} ر</div>
          <div className="inv-stat-lbl">مجموع المُصدرة</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-val">{invoices.filter(i => i.status === 'cancelled').length}</div>
          <div className="inv-stat-lbl">ملغاة</div>
        </div>
      </div>

      {/* Filters */}
      <div className="inv-filters">
        <select className="inv-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">الحالة: الكل</option>
          <option value="issued">✅ مُصدرة</option>
          <option value="cancelled">❌ ملغاة</option>
        </select>

        <select className="inv-select" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1) }}>
          <option value="">الدفع: الكل</option>
          <option value="unpaid">⏳ غير مدفوعة</option>
          <option value="partial">🔶 جزئي</option>
          <option value="paid">💰 مدفوعة</option>
        </select>

        <select className="inv-select" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1) }}>
          <option value="">كل الأشهر</option>
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <form className="inv-search" onSubmit={handleSearch}>
          <input
            placeholder="بحث باسم، جوال، أو كود عميل..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button type="submit"><Search size={16} /></button>
        </form>
      </div>

      {/* Table */}
      <div className="inv-table-wrap">
        {loading ? (
          <div className="inv-empty">جاري التحميل...</div>
        ) : invoices.length === 0 ? (
          <div className="inv-empty">
            <FileText size={40} style={{ opacity: .3, marginBottom: '.5rem' }} />
            <div>لا توجد فواتير</div>
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>الحجز</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>الدفع</th>
                <th>تاريخ الإصدار</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const cust = inv.customers
                const bk   = inv.bookings
                return (
                  <tr key={inv.id} onClick={() => setSelected(inv)}>
                    <td>
                      <span className="inv-number">{inv.invoice_number}</span>
                      {inv.batch_id && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>📦 {inv.batch_id}</div>}
                    </td>
                    <td>
                      <div>{cust?.name ?? '—'}</div>
                      <div className="inv-customer-code">{cust?.customer_code ?? ''}</div>
                    </td>
                    <td>
                      {bk ? (
                        <>
                          <div>{COURT_LABELS[bk.court_id] ?? bk.court_id}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                            {new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory')} · {PERIOD_LABELS[bk.period_number]}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>باقة مجمّعة</span>
                      )}
                    </td>
                    <td className="inv-amount">{fmt(inv.total_amount)} ر</td>
                    <td><span className={`inv-badge ${inv.status}`}>{inv.status === 'issued' ? '✅ مُصدرة' : '❌ ملغاة'}</span></td>
                    <td>
                      {inv.status === 'issued' ? (
                        <span className={`inv-badge inv-pay-${inv.payment_status}`}>
                          {inv.payment_status === 'paid'    ? '💰 مدفوعة' :
                           inv.payment_status === 'partial' ? '🔶 جزئي'   : '⏳ معلّقة'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                      {new Date(inv.issued_at).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="inv-pagination">
          <button className="inv-pg-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
            <ChevronRight size={16} />
          </button>
          <span className="inv-pg-info">صفحة {page} من {pages}</span>
          <button className="inv-pg-btn" onClick={() => setPage(p => p + 1)} disabled={page >= pages}>
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <InvoiceModal
          invoice={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancelInvoice}
        />
      )}
    </div>
  )
}
