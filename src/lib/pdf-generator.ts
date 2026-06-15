// ============================================================
// مولّد PDF احترافي — jsPDF + AutoTable + خط عربي
// ============================================================
'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  bookings: {
    customer_name: string
    customer_phone: string
    court: string
    period: string
    booking_date: string
    final_price: number
    discount_amount: number
    status: string
  }[]
}

const STATUS_AR: Record<string, string> = {
  confirmed: 'مؤكد',
  pending: 'بانتظار إيصال',
  uploaded: 'قيد المراجعة',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
  expired: 'منتهي',
}

function fmt(n: number): string {
  return n.toLocaleString('ar-SA') + ' ر.س'
}

async function loadArabicFont(doc: jsPDF): Promise<void> {
  try {
    // Fetch Amiri font from Google Fonts CDN
    const res = await fetch('https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.ttf')
    if (!res.ok) throw new Error('Font fetch failed')
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    doc.addFileToVFS('Amiri-Regular.ttf', base64)
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
    doc.setFont('Amiri')
  } catch {
    // Fallback: use Helvetica (won't render Arabic perfectly but won't crash)
    console.warn('Could not load Arabic font, using default')
    doc.setFont('Helvetica')
  }
}

export async function generateReport(data: PDFReportData): Promise<void> {
  const btn = document.getElementById('btn-export-pdf') as HTMLButtonElement | null
  const originalText = btn?.innerHTML ?? ''
  if (btn) { btn.innerHTML = '⏳ جاري التحضير...'; btn.disabled = true }

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    await loadArabicFont(doc)

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 15
    let y = margin

    // ============================================================
    // هيدر التقرير
    // ============================================================
    doc.setFillColor(27, 42, 59) // navy
    doc.rect(0, 0, pageW, 45, 'F')

    doc.setTextColor(201, 169, 110) // gold
    doc.setFontSize(22)
    doc.text(data.centerName, pageW / 2, 16, { align: 'center' })

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.text('التقرير المالي', pageW / 2, 26, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(200, 200, 200)
    doc.text(`الفترة: من ${data.from} إلى ${data.to}`, pageW / 2, 34, { align: 'center' })
    doc.text(`تم الإنشاء: ${new Date().toLocaleString('ar-SA')}`, pageW / 2, 40, { align: 'center' })

    y = 55

    // ============================================================
    // ملخص تنفيذي
    // ============================================================
    doc.setFillColor(245, 242, 236) // beige
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 3, 3, 'F')

    doc.setTextColor(27, 42, 59)
    doc.setFontSize(12)
    doc.text('ملخص تنفيذي', pageW / 2, y + 8, { align: 'center' })

    doc.setFontSize(9)
    const summaryItems = [
      `إجمالي الحجوزات: ${data.summary.total_bookings}`,
      `الحجوزات المؤكدة: ${data.summary.confirmed_bookings}`,
      `إجمالي الإيرادات: ${fmt(data.summary.total_revenue)}`,
      `إجمالي الخصومات: ${fmt(data.summary.total_discount)}`,
    ]
    const colW = (pageW - margin * 2) / 2
    summaryItems.forEach((item, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = margin + colW * col + colW / 2
      doc.text(item, x, y + 16 + row * 7, { align: 'center' })
    })

    y += 40

    // ============================================================
    // الإيرادات حسب الملعب
    // ============================================================
    doc.setFontSize(12)
    doc.setTextColor(45, 92, 78) // green
    doc.text('الإيرادات حسب الملعب', pageW - margin, y, { align: 'right' })
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['الملعب', 'عدد الحجوزات', 'الإيرادات']],
      body: data.revenueByCourt.map(c => [
        c.court,
        String(c.count),
        fmt(c.revenue),
      ]),
      styles: {
        font: 'Amiri',
        halign: 'right',
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [27, 42, 59],
        textColor: [201, 169, 110],
        halign: 'right',
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 245, 240] },
      margin: { left: margin, right: margin },
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // ============================================================
    // توزيع الحالات
    // ============================================================
    doc.setFontSize(12)
    doc.setTextColor(45, 92, 78)
    doc.text('توزيع الحالات', pageW - margin, y, { align: 'right' })
    y += 4

    const statusEntries = Object.entries(data.summary.status_count)
      .sort((a, b) => b[1] - a[1])

    autoTable(doc, {
      startY: y,
      head: [['الحالة', 'العدد', 'النسبة']],
      body: statusEntries.map(([status, count]) => [
        STATUS_AR[status] ?? status,
        String(count),
        data.summary.total_bookings > 0
          ? Math.round((count / data.summary.total_bookings) * 100) + '%'
          : '0%',
      ]),
      styles: {
        font: 'Amiri',
        halign: 'right',
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [27, 42, 59],
        textColor: [201, 169, 110],
        halign: 'right',
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 245, 240] },
      margin: { left: margin, right: margin },
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // ============================================================
    // جدول تفاصيل الحجوزات
    // ============================================================
    if (y > pageH - 40) { doc.addPage(); y = margin }

    doc.setFontSize(12)
    doc.setTextColor(45, 92, 78)
    doc.text(`جدول تفاصيل الحجوزات (${data.bookings.length})`, pageW - margin, y, { align: 'right' })
    y += 4

    const STATUS_COLORS: Record<string, [number, number, number]> = {
      confirmed: [220, 252, 231],
      pending: [254, 249, 195],
      uploaded: [219, 234, 254],
      rejected: [254, 226, 226],
      cancelled: [241, 245, 249],
      expired: [241, 245, 249],
    }

    autoTable(doc, {
      startY: y,
      head: [['الاسم', 'الجوال', 'الملعب', 'الفترة', 'التاريخ', 'المبلغ', 'الحالة']],
      body: data.bookings.map(b => [
        b.customer_name,
        b.customer_phone,
        b.court,
        b.period,
        b.booking_date,
        fmt(b.final_price),
        STATUS_AR[b.status] ?? b.status,
      ]),
      styles: {
        font: 'Amiri',
        halign: 'right',
        fontSize: 8,
        cellPadding: 2.5,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [27, 42, 59],
        textColor: [201, 169, 110],
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 9,
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const status = data.bookings[hookData.row.index]?.status
          if (status && STATUS_COLORS[status]) {
            hookData.cell.styles.fillColor = STATUS_COLORS[status]
          }
        }
      },
      margin: { left: margin, right: margin },
    })

    // ============================================================
    // Footer
    // ============================================================
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        'النظام الداخلي لمركز حي الشاطئ',
        pageW / 2,
        pageH - 8,
        { align: 'center' }
      )
      doc.text(
        `صفحة ${i} من ${totalPages}`,
        margin,
        pageH - 8,
      )
    }

    // حفظ
    const filename = `${data.centerName}-التقرير-المالي-${data.from}-${data.to}.pdf`
    doc.save(filename)
  } finally {
    if (btn) { btn.innerHTML = originalText; btn.disabled = false }
  }
}
