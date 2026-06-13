// ============================================================
// مولّد PDF باستخدام html2canvas — يحافظ على الخطوط العربية
// يلتقط عنصر HTML بالضبط كما يظهر على الشاشة
// ============================================================
'use client'

interface PDFOptions {
  elementId: string        // id العنصر المراد التقاطه
  filename?: string        // اسم الملف
}

export async function generatePDFFromElement({ elementId, filename = 'report.pdf' }: PDFOptions) {
  // تحميل المكتبات ديناميكياً (client-only)
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const element = document.getElementById(elementId)
  if (!element) { alert('لم يتم العثور على محتوى التقرير'); return }

  // إظهار مؤشر التحميل
  const btn = document.getElementById('btn-export-pdf') as HTMLButtonElement | null
  const originalText = btn?.innerHTML ?? ''
  if (btn) { btn.innerHTML = '⏳ جاري التحضير...'; btn.disabled = true }

  try {
    // انتظر تحميل الخطوط
    await document.fonts.ready

    const canvas = await html2canvas(element, {
      scale: 2,                    // دقة مضاعفة
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#F5F2EC',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        // تأكد الخط محمّل في النسخة المستنسخة
        const style = clonedDoc.createElement('style')
        style.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
          * { font-family: 'Tajawal', 'IBM Plex Sans Arabic', Arial, sans-serif !important; }
        `
        clonedDoc.head.appendChild(style)
      },
    })

    const imgW = 210           // A4 عرض بالـ mm
    const pageH = 297          // A4 ارتفاع بالـ mm
    const imgH = (canvas.height * imgW) / canvas.width
    let heightLeft = imgH
    let position = 0

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // الصفحة الأولى
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH

    // صفحات إضافية لو المحتوى طويل
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }

    pdf.save(filename)
  } finally {
    if (btn) { btn.innerHTML = originalText; btn.disabled = false }
  }
}
