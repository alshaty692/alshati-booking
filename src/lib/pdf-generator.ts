// ============================================================
// مولّد PDF — html2canvas + jsPDF
// يبني تقرير HTML كامل → يلتقطه كصورة → يحوّله لـ PDF
// هذا الأسلوب يضمن عرض العربي بشكل صحيح
// ============================================================
'use client'

import jsPDF from 'jspdf'

export interface PDFReportData {
  centerName: string
  from: string
  to: string
  summary: {
    total_bookings: number
    confirmed_bookings: number
    total_revenue: number
    total_discount: number
    avg_booking_value: number
    status_count: Record<string, number>
  }
  revenueByCourt: { court: string; count: number; revenue: number }[]
  customers: { name: string; phone: string; count: number; revenue: number }[]
  heatmap: Record<number, Record<number, { booked: number; total: number }>>
  codeStats: { code: string; count: number; discount: number; revenue: number }[]
  bookings: {
    customer_name: string; customer_phone: string
    court: string; period: string; booking_date: string
    final_price: number; discount_amount: number; status: string
  }[]
}

const STATUS_AR: Record<string, string> = {
  confirmed:'مؤكد', pending:'بانتظار إيصال', uploaded:'قيد المراجعة',
  rejected:'مرفوض', cancelled:'ملغى', expired:'منتهي',
}
const DAY_LABELS: Record<number,string> = {
  0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'
}
const PERIOD_LABELS: Record<number,string> = { 1:'5–7م', 2:'7–9م', 3:'9–11م' }

function fmt(n: number): string {
  return n.toLocaleString('ar-SA') + ' ر.س'
}

function statusColor(s: string): string {
  const map: Record<string,string> = {
    confirmed:'#dcfce7', pending:'#fef9c3', uploaded:'#dbeafe',
    rejected:'#fee2e2', cancelled:'#f1f5f9', expired:'#f1f5f9',
  }
  return map[s] ?? '#fff'
}

// ============================================================
// بناء HTML التقرير الكامل
// ============================================================
function buildReportHTML(data: PDFReportData): string {
  const navy = '#1B2A3B', gold = '#C9A96E', green = '#2D5C4E'

  const css = `
    * { box-sizing:border-box; margin:0; padding:0; }
    body, div, td, th, p, span, h1, h2, h3 {
      font-family: 'Tajawal', 'IBM Plex Sans Arabic', Arial, sans-serif;
      direction: rtl;
    }
    .report { width:760px; padding:20px; background:#fff; color:#1B2A3B; }
    .header { background:${navy}; color:#fff; padding:20px 24px; border-radius:12px; text-align:center; margin-bottom:20px; }
    .header h1 { color:${gold}; font-size:22px; font-weight:800; margin-bottom:6px; }
    .header h2 { font-size:14px; font-weight:500; color:#e2e8f0; margin-bottom:4px; }
    .header p { font-size:11px; color:#94a3b8; }
    .section { margin-bottom:24px; page-break-inside:avoid; }
    .section-title { font-size:16px; font-weight:800; color:${green}; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid ${gold}; }
    .stats-row { display:flex; gap:12px; margin-bottom:16px; }
    .stat-box { flex:1; background:#f8f5ef; border-radius:10px; padding:14px; text-align:center; }
    .stat-value { font-size:18px; font-weight:800; color:${navy}; }
    .stat-label { font-size:11px; color:#94a3b8; margin-top:3px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { background:${navy}; color:${gold}; padding:8px 10px; text-align:right; font-weight:700; }
    td { padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:right; }
    tr:nth-child(even) td { background:#f8f5ef; }
    .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; }
    .page-break { page-break-before:always; margin-top:32px; padding-top:16px; border-top:3px solid ${gold}; }
    .footer { text-align:center; color:#94a3b8; font-size:10px; margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0; }
    .heatmap-grid { display:grid; grid-template-columns:80px repeat(3,1fr); gap:2px; }
    .heatmap-cell { text-align:center; padding:10px 4px; border-radius:6px; font-size:11px; font-weight:700; }
  `

  // ── الهيدر ──
  let html = `<style>${css}</style><div class="report">`
  html += `<div class="header">
    <h1>${data.centerName}</h1>
    <h2>التقرير الشامل</h2>
    <p>الفترة: من ${data.from} إلى ${data.to} · تم الإنشاء: ${new Date().toLocaleString('ar-SA')}</p>
  </div>`

  // ── الملخص التنفيذي ──
  html += `<div class="section">
    <div class="section-title">📋 ملخص تنفيذي</div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-value">${data.summary.total_bookings}</div><div class="stat-label">إجمالي الحجوزات</div></div>
      <div class="stat-box"><div class="stat-value">${data.summary.confirmed_bookings}</div><div class="stat-label">المؤكدة</div></div>
      <div class="stat-box"><div class="stat-value">${fmt(data.summary.total_revenue)}</div><div class="stat-label">الإيرادات</div></div>
      <div class="stat-box"><div class="stat-value">${fmt(data.summary.total_discount)}</div><div class="stat-label">الخصومات</div></div>
      <div class="stat-box"><div class="stat-value">${fmt(data.summary.avg_booking_value)}</div><div class="stat-label">المتوسط</div></div>
    </div>
  </div>`

  // ══════════════════════════════════════════════
  // القسم ١: التقرير المالي
  // ══════════════════════════════════════════════
  html += `<div class="section">
    <div class="section-title">💰 التقرير المالي</div>
    <table>
      <thead><tr><th>الملعب</th><th>عدد الحجوزات</th><th>الإيرادات</th></tr></thead>
      <tbody>${data.revenueByCourt.map(c =>
        `<tr><td style="font-weight:700">${c.court}</td><td>${c.count}</td><td style="color:${green};font-weight:700">${fmt(c.revenue)}</td></tr>`
      ).join('')}</tbody>
    </table>
  </div>`

  // توزيع الحالات
  html += `<div class="section">
    <div class="section-title">📊 توزيع الحالات</div>
    <table>
      <thead><tr><th>الحالة</th><th>العدد</th><th>النسبة</th></tr></thead>
      <tbody>${Object.entries(data.summary.status_count)
        .sort((a,b) => b[1]-a[1])
        .map(([status,count]) => {
          const pct = data.summary.total_bookings > 0 ? Math.round(count/data.summary.total_bookings*100) : 0
          return `<tr><td><span class="badge" style="background:${statusColor(status)}">${STATUS_AR[status]??status}</span></td><td>${count}</td><td>${pct}%</td></tr>`
        }).join('')}
      </tbody>
    </table>
  </div>`

  // ══════════════════════════════════════════════
  // القسم ٢: تقرير العملاء
  // ══════════════════════════════════════════════
  html += `<div class="section page-break">
    <div class="section-title">👥 تقرير العملاء</div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-value">${data.customers.length}</div><div class="stat-label">إجمالي العملاء</div></div>
      <div class="stat-box"><div class="stat-value">${data.customers.filter(c=>c.count===1).length}</div><div class="stat-label">عملاء جدد</div></div>
      <div class="stat-box"><div class="stat-value">${data.customers.filter(c=>c.count>1).length}</div><div class="stat-label">عملاء متكررون</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>الحجوزات</th><th>الإيرادات</th></tr></thead>
      <tbody>${data.customers.slice(0,20).map((c,i) =>
        `<tr><td style="color:${gold};font-weight:700">${i+1}</td><td style="font-weight:600">${c.name}</td><td style="direction:ltr;text-align:right;color:#94a3b8">${c.phone}</td><td style="text-align:center;font-weight:700">${c.count}</td><td style="font-weight:700;color:${green}">${fmt(c.revenue)}</td></tr>`
      ).join('')}</tbody>
    </table>
  </div>`

  // ══════════════════════════════════════════════
  // القسم ٣: خريطة الإشغال
  // ══════════════════════════════════════════════
  html += `<div class="section page-break">
    <div class="section-title">🔥 خريطة حرارة الإشغال</div>
    <table>
      <thead><tr><th>اليوم</th><th>5–7م</th><th>7–9م</th><th>9–11م</th><th>الإجمالي</th></tr></thead>
      <tbody>${[0,1,2,3,4,5,6].map(day => {
        const cells = [1,2,3].map(p => {
          const cell = data.heatmap[day]?.[p] ?? { booked:0, total:0 }
          const pct = cell.total > 0 ? Math.round(cell.booked/cell.total*100) : 0
          const bg = pct === 0 ? '#f8fafc' : pct < 25 ? '#d1fae5' : pct < 50 ? '#6ee7b7' : pct < 75 ? '#2D5C4E' : '#1B2A3B'
          const color = pct >= 50 ? '#fff' : '#1B2A3B'
          return `<td style="background:${bg};color:${color};text-align:center;font-weight:700">${pct}% <span style="font-size:9px;opacity:0.7">(${cell.booked}/${cell.total})</span></td>`
        }).join('')
        const dayTotal = [1,2,3].reduce((s,p) => s+(data.heatmap[day]?.[p]?.booked??0),0)
        return `<tr><td style="font-weight:700">${DAY_LABELS[day]}</td>${cells}<td style="text-align:center;font-weight:700">${dayTotal}</td></tr>`
      }).join('')}</tbody>
    </table>
  </div>`

  // ══════════════════════════════════════════════
  // القسم ٤: تقرير الأكواد
  // ══════════════════════════════════════════════
  html += `<div class="section page-break">
    <div class="section-title">🏷️ تقرير الأكواد</div>`
  if (data.codeStats.length === 0) {
    html += `<p style="color:#94a3b8;text-align:center;padding:20px">لا توجد أكواد مستخدمة في هذه الفترة</p>`
  } else {
    html += `<table>
      <thead><tr><th>الكود</th><th>الاستخدامات</th><th>إجمالي الخصم</th><th>إجمالي الإيرادات</th></tr></thead>
      <tbody>${data.codeStats.map(c =>
        `<tr><td style="font-weight:800;letter-spacing:0.05em;font-size:13px">${c.code}</td><td style="text-align:center;font-weight:700">${c.count}</td><td style="color:#ef4444;font-weight:600">${fmt(c.discount)}</td><td style="font-weight:700;color:${green}">${fmt(c.revenue)}</td></tr>`
      ).join('')}</tbody>
    </table>`
  }
  html += `</div>`

  // ══════════════════════════════════════════════
  // جدول تفاصيل الحجوزات
  // ══════════════════════════════════════════════
  html += `<div class="section page-break">
    <div class="section-title">📋 جدول تفاصيل الحجوزات (${data.bookings.length})</div>
    <table>
      <thead><tr><th>الاسم</th><th>الجوال</th><th>الملعب</th><th>الفترة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead>
      <tbody>${data.bookings.map(b =>
        `<tr style="background:${statusColor(b.status)}"><td style="font-weight:600">${b.customer_name}</td><td style="direction:ltr;text-align:right;color:#64748b;font-size:11px">${b.customer_phone}</td><td>${b.court}</td><td>${b.period}</td><td>${b.booking_date}</td><td style="font-weight:700">${fmt(b.final_price)}</td><td><span class="badge" style="background:${statusColor(b.status)}">${STATUS_AR[b.status]??b.status}</span></td></tr>`
      ).join('')}</tbody>
    </table>
  </div>`

  // ── Footer ──
  html += `<div class="footer">النظام الداخلي لمركز حي الشاطئ · تم إنشاء التقرير آلياً</div>`
  html += `</div>`

  return html
}

// ============================================================
// توليد PDF
// ============================================================
export async function generateReport(data: PDFReportData): Promise<void> {
  const btn = document.getElementById('btn-export-pdf') as HTMLButtonElement | null
  const originalText = btn?.innerHTML ?? ''
  if (btn) { btn.innerHTML = '⏳ جاري التحضير...'; btn.disabled = true }

  try {
    // Dynamic import html2canvas
    const { default: html2canvas } = await import('html2canvas')

    // إنشاء حاوية مؤقتة
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-9999;'
    container.innerHTML = buildReportHTML(data)
    document.body.appendChild(container)

    // انتظار الخطوط
    await document.fonts.ready
    // انتظار إضافي للتأكد من التحميل
    await new Promise(r => setTimeout(r, 300))

    const reportEl = container.querySelector('.report') as HTMLElement
    if (!reportEl) { alert('خطأ في بناء التقرير'); return }

    // التقاط بـ html2canvas
    const canvas = await html2canvas(reportEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 800,
    })

    // إزالة الحاوية المؤقتة
    document.body.removeChild(container)

    // إنشاء PDF
    const imgW = 210  // A4 mm
    const pageH = 297
    const imgH = (canvas.height * imgW) / canvas.width
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    let heightLeft = imgH
    let position = 0

    // الصفحة الأولى
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH

    // صفحات إضافية
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }

    pdf.save(`${data.centerName}-التقرير-الشامل-${data.from}-${data.to}.pdf`)
  } catch (err) {
    console.error('PDF generation error:', err)
    alert('حدث خطأ أثناء إنشاء التقرير')
  } finally {
    if (btn) { btn.innerHTML = originalText; btn.disabled = false }
  }
}
