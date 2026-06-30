// ============================================================
// src/components/admin/InvoicePDFDocument.tsx
// مكوّن فاتورة PDF بـ @react-pdf/renderer
// خط Tajawal محلي — نص عربي حقيقي بدون عكس حروف
// ============================================================
import React from 'react'
import {
  Document, Page, View, Text, StyleSheet, Font,
} from '@react-pdf/renderer'

// ── تسجيل خط Tajawal ──────────────────────────────────────────
// يُستدعى عند أول توليد PDF فقط (lazy) لضمان وجود window.location
let fontsRegistered = false
export function registerTajawalFonts() {
  if (fontsRegistered) return
  fontsRegistered = true
  // نستخدم URL مطلق لأن @react-pdf/renderer يحتاجه في بيئة المتصفح
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  Font.register({
    family: 'Tajawal',
    fonts: [
      { src: base + '/fonts/Tajawal-Regular.ttf', fontWeight: 400 },
      { src: base + '/fonts/Tajawal-Bold.ttf',    fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
}

/* ── أنواع ──────────────────────────────────────────────────── */
interface Customer { name: string; phone: string; customer_code: string }
interface Booking  { booking_date: string; court_id: string; period_number: number }

interface InvoiceData {
  invoice_number:      string
  issued_at:           string
  status:              string
  total_amount:        number
  base_price:          number
  discount_amount:     number
  discount_code:       string | null
  discount_percentage: number
  water_quantity:      number
  water_unit_price:    number
  water_total:         number
  batch_id:            string | null
  booking_id:          string | null
  customers:           Customer | null
  bookings:            Booking  | null
}

interface CreditNoteItem {
  id:                 string
  credit_note_number: string
  amount:             number
  reason:             string
  type:               string
  status:             string
}

export interface InvoicePDFProps {
  invoice:     InvoiceData
  creditNotes: CreditNoteItem[]   // فقط approved — المصفّاة مسبقاً
  balance?: {
    total_amount:      number
    approved_cn_total: number
    net_amount:        number
    paid_amount:       number
    balance_due:       number
  } | null
}

/* ── ثوابت ───────────────────────────────────────────────────── */
const C = {
  green:       '#3B6D11',
  greenBorder: '#639922',
  red:         '#A32D2D',
  gold:        '#b8860b',
  goldBorder:  '#e0c98a',
  goldBg:      '#fdf8ed',
  gray:        '#4a4a4a',
  grayLight:   '#f5f5f5',
  grayBorder:  '#d0d0d0',
  black:       '#111111',
  white:       '#ffffff',
  muted:       '#888888',
} as const

const COURT_LABELS: Record<string, string> = {
  football:   'كرة القدم',
  volleyball: 'الكرة الطائرة',
  multi:      'الملعب المتعدد',
}

const PERIOD_LABELS: Record<number, string> = {
  1: 'الفترة الاولى (5-7)',
  2: 'الفترة الثانية (7-9)',
  3: 'الفترة الثالثة (9-11)',
}

const CN_TYPE_LABELS: Record<string, string> = {
  price_adjustment: 'تعديل سعر',
  partial_refund:   'استرداد جزئي',
  error_correction: 'تصحيح خطأ',
}

// — fmt تُرجع الرقم فقط (بدون "ر") — الوحدة تُضاف في الـ JSX كعنصر منفصل
function fmt(n: number): string {
  return n.toFixed(n % 1 === 0 ? 0 : 2)
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const day    = d.getDate()
    const month  = d.getMonth() + 1
    const year   = d.getFullYear()
    const months = ['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر']
    // react-pdf مع RTL يعكس ترتيب الكلمات المختلطة (عربي+ارقام)
    // نكتب العام اولاً والاسم في الوسط واليوم اخيراً
    // حتى بعد الـ bidi reversal يظهر: يوم شهر سنة
    return `${year} ${months[month - 1]} ${day}`
  } catch {
    return iso
  }
}

/* ── الأنماط ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  page: {
    fontFamily:      'Tajawal',
    fontSize:        10,
    color:           C.black,
    backgroundColor: C.white,
    paddingTop:      28,
    paddingBottom:   28,
    paddingLeft:     32,
    paddingRight:    32,
  },

  // ── هيدر
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems:    'flex-end',
  },
  headerTitle: {
    fontSize:   22,
    fontWeight: 700,
    color:      C.green,
    textAlign:  'right',
  },
  headerSubtitle: {
    fontSize:  9,
    color:     C.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems:    'flex-start',
  },
  headerInvNum: {
    fontSize:   11,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'left',
  },
  headerDate: {
    fontSize:  8,
    color:     C.muted,
    marginTop: 2,
    textAlign: 'left',
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: C.greenBorder,
    marginTop:         10,
    marginBottom:      14,
  },

  // ── صندوقان جنب بعض
  twoColRow: {
    flexDirection:  'row',
    gap:            8,
    marginBottom:   12,
  },
  infoBox: {
    flex:         1,
    borderWidth:  1,
    borderColor:  C.grayBorder,
    borderRadius: 4,
    padding:      8,
  },
  infoBoxTitle: {
    fontSize:     7.5,
    fontWeight:   700,
    color:        C.greenBorder,
    marginBottom: 6,
    textAlign:    'right',
  },
  infoRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  infoLabel: {
    fontSize:  8,
    color:     C.muted,
    textAlign: 'right',
  },
  infoValue: {
    fontSize:   9,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'left',
    maxWidth:   120,
  },

  // ── جدول البنود
  tableSection: {
    marginBottom: 12,
  },
  tableTitle: {
    fontSize:          7.5,
    fontWeight:        700,
    color:             C.greenBorder,
    textAlign:         'right',
    borderBottomWidth: 1.5,
    borderBottomColor: C.greenBorder,
    paddingBottom:     4,
    marginBottom:      6,
  },
  tableRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayBorder,
  },
  tableRowEven: {
    backgroundColor: C.grayLight,
  },
  tableLabel: {
    fontSize:  9.5,
    color:     C.black,
    textAlign: 'right',
    flex:      1,
  },
  tableAmount: {
    fontSize:       9.5,
    color:          C.black,
    textAlign:      'left',
    minWidth:       60,
  },
  // حاوي الرقم + وحدة العملة كعنصرين منفصلين لتجنّب تشويش bidi
  amountCell: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    minWidth:       60,
  },
  amountNum: {
    fontSize:  9.5,
    color:     C.black,
    textAlign: 'left',
  },
  amountUnit: {
    fontSize:   9.5,
    color:      C.muted,
    textAlign:  'left',
    marginLeft: 2,
  },
  amountNumBold: {
    fontSize:   10,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'left',
  },
  amountNumRed: {
    fontSize:  9.5,
    color:     C.red,
    textAlign: 'left',
  },
  amountNumGreen: {
    fontSize:   15,
    fontWeight: 700,
    color:      C.green,
    textAlign:  'left',
  },
  tableTotalRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   5,
    paddingHorizontal: 4,
    backgroundColor:   C.grayLight,
    borderTopWidth:    1,
    borderTopColor:    C.grayBorder,
    marginTop:         2,
  },
  tableTotalLabel: {
    fontSize:   10,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'right',
  },
  tableTotalAmount: {
    fontSize:   10,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'left',
    minWidth:   60,
  },

  // ── صندوق إشعارات الائتمان
  cnBox: {
    borderWidth:     1,
    borderColor:     C.goldBorder,
    borderRadius:    4,
    backgroundColor: C.goldBg,
    padding:         8,
    marginBottom:    12,
  },
  cnBoxTitle: {
    fontSize:     7.5,
    fontWeight:   700,
    color:        C.gold,
    marginBottom: 6,
    textAlign:    'right',
  },
  cnRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  cnLabel: {
    fontSize:  9,
    color:     C.gray,
    textAlign: 'right',
    flex:      1,
  },
  cnAmount: {
    fontSize:   9.5,
    fontWeight: 700,
    color:      C.red,
    textAlign:  'left',
    minWidth:   60,
  },
  cnReason: {
    fontSize:   7.5,
    color:      C.muted,
    textAlign:  'right',
    marginBottom: 6,
  },

  // ── صندوق الصافي المستحق
  netBox: {
    borderWidth:  2,
    borderColor:  C.greenBorder,
    borderRadius: 5,
    padding:      10,
    marginBottom: 14,
  },
  netRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  netLabel: {
    fontSize:   12,
    fontWeight: 700,
    color:      C.black,
    textAlign:  'right',
  },
  netAmount: {
    fontSize:   15,
    fontWeight: 700,
    color:      C.green,
    textAlign:  'left',
  },
  netSub: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      5,
    paddingTop:     4,
    borderTopWidth: 0.5,
    borderTopColor: C.grayBorder,
  },
  netSubText: {
    fontSize:  8,
    color:     C.muted,
  },

  // ── فوتر
  footer: {
    marginTop:      16,
    paddingTop:     8,
    borderTopWidth: 0.5,
    borderTopColor: C.grayBorder,
    alignItems:     'center',
  },
  footerText: {
    fontSize:  7.5,
    color:     C.muted,
    textAlign: 'center',
  },
})

/* ── المكوّن الرئيسي ─────────────────────────────────────────── */
export function InvoicePDFDocument({ invoice, creditNotes, balance }: InvoicePDFProps) {
  const cust = invoice.customers
  const bk   = invoice.bookings

  // CNs المعتمدة فقط
  const approvedCNs = creditNotes.filter(cn => cn.status === 'approved')
  const cnTotal     = approvedCNs.reduce((s, cn) => s + Number(cn.amount), 0)
  const netAmount   = Math.max(0, invoice.total_amount - cnTotal)
  const hasCNs      = approvedCNs.length > 0

  const courtLabel  = bk ? (COURT_LABELS[bk.court_id] ?? bk.court_id) : null
  const periodLabel = bk ? (PERIOD_LABELS[bk.period_number] ?? String(bk.period_number)) : null
  const dateLabel   = bk ? fmtDate(bk.booking_date + 'T00:00:00') : null

  return (
    <Document
      title={invoice.invoice_number}
      author="مركز حي الشاطئ"
      subject="فاتورة حجز"
    >
      <Page size="A4" style={s.page}>

        {/* الهيدر */}
        <View style={s.header}>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>فاتورة</Text>
            <Text style={s.headerSubtitle}>مركز حي الشاطئ للحجوزات</Text>
          </View>
          <View style={s.headerLeft}>
            <Text style={s.headerInvNum}>{invoice.invoice_number}</Text>
            <Text style={s.headerDate}>{'تاريخ الاصدار: ' + fmtDate(invoice.issued_at)}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* صندوقا العميل والحجز */}
        <View style={s.twoColRow}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>بيانات العميل</Text>
            {cust?.name ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{cust.name}</Text>
                <Text style={s.infoLabel}>الاسم</Text>
              </View>
            ) : null}
            {cust?.customer_code ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{cust.customer_code}</Text>
                <Text style={s.infoLabel}>الكود</Text>
              </View>
            ) : null}
            {cust?.phone ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{cust.phone}</Text>
                <Text style={s.infoLabel}>الجوال</Text>
              </View>
            ) : null}
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>
              {invoice.batch_id ? 'تفاصيل الباقة' : 'تفاصيل الحجز'}
            </Text>
            {courtLabel ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{courtLabel}</Text>
                <Text style={s.infoLabel}>الملعب</Text>
              </View>
            ) : null}
            {periodLabel ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{periodLabel}</Text>
                <Text style={s.infoLabel}>الفترة</Text>
              </View>
            ) : null}
            {dateLabel ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{dateLabel}</Text>
                <Text style={s.infoLabel}>التاريخ</Text>
              </View>
            ) : null}
            {invoice.batch_id && !bk ? (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{invoice.batch_id.slice(0, 8)}</Text>
                <Text style={s.infoLabel}>رقم الباقة</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* جدول البنود */}
        <View style={s.tableSection}>
          <Text style={s.tableTitle}>بنود الفاتورة</Text>

          <View style={s.tableRow}>
            <Text style={s.tableLabel}>
              {invoice.batch_id ? 'سعر الملعب (مجموع)' : 'سعر الملعب'}
            </Text>
            <View style={s.amountCell}>
              <Text style={s.amountNum}>{fmt(invoice.base_price)}</Text>
              <Text style={s.amountUnit}>ر</Text>
            </View>
          </View>

          {invoice.discount_amount > 0 ? (
            <View style={[s.tableRow, s.tableRowEven]}>
              <Text style={s.tableLabel}>
                {'خصم'}
                {invoice.discount_code ? ' (' + invoice.discount_code + ')' : ''}
                {invoice.discount_percentage > 0 ? ' - ' + invoice.discount_percentage + '%' : ''}
              </Text>
              <View style={s.amountCell}>
                <Text style={s.amountNumRed}>{'-' + fmt(invoice.discount_amount)}</Text>
                <Text style={[s.amountUnit, { color: C.red }]}>ر</Text>
              </View>
            </View>
          ) : null}


          {invoice.water_quantity > 0 ? (
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>
                {'مياه (' + invoice.water_quantity + ' كراتين x ' + fmt(invoice.water_unit_price) + ')'}
              </Text>
              <Text style={s.tableAmount}>{fmt(invoice.water_total)}</Text>
            </View>
          ) : null}

          <View style={s.tableTotalRow}>
            <Text style={s.tableTotalLabel}>الاجمالي المفوتر</Text>
            <Text style={s.tableTotalAmount}>{fmt(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* صندوق إشعارات الائتمان */}
        {hasCNs ? (
          <View style={s.cnBox}>
            <Text style={s.cnBoxTitle}>اشعارات الائتمان - خصم بعد الاصدار</Text>
            {approvedCNs.map((cn) => (
              <View key={cn.id}>
                <View style={s.cnRow}>
                  <Text style={s.cnLabel}>
                    {cn.credit_note_number}
                    {cn.type ? ' - ' + (CN_TYPE_LABELS[cn.type] ?? cn.type) : ''}
                  </Text>
                  <View style={s.amountCell}>
                    <Text style={s.amountNumRed}>{'-' + fmt(cn.amount)}</Text>
                    <Text style={[s.amountUnit, { color: C.red }]}>ر</Text>
                  </View>
                </View>
                {cn.reason ? (
                  <Text style={s.cnReason}>{'السبب: ' + cn.reason}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* صندوق الصافي المستحق */}
        <View style={s.netBox}>
          <View style={s.netRow}>
            <Text style={s.netLabel}>الصافي المستحق</Text>
            <View style={s.amountCell}>
              <Text style={s.amountNumGreen}>{fmt(netAmount)}</Text>
              <Text style={[s.amountUnit, { fontSize: 13, color: C.green }]}>ر</Text>
            </View>
          </View>
          {balance ? (
            <View style={s.netSub}>
              <Text style={s.netSubText}>{'المدفوع: ' + fmt(balance.paid_amount) + ' ر'}</Text>
              <Text style={s.netSubText}>{'المتبقي: ' + fmt(balance.balance_due) + ' ر'}</Text>
            </View>
          ) : null}
        </View>

        {/* الفوتر */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {invoice.invoice_number + ' · ' + fmtDate(invoice.issued_at) + ' · مركز حي الشاطئ للحجوزات'}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
