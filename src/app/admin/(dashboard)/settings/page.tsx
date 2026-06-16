import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export const metadata: Metadata = { title: 'الإعدادات' }

async function saveSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  'use server'

  // ── التحقق من تسجيل الدخول ──────────────────────────────
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'غير مصرح — يرجى تسجيل الدخول' }
  }

  // ── جمع الحقول من الـ Form ──────────────────────────────
  const pairs: { key: string; value: string }[] = []
  formData.forEach((value, key) => {
    if (key !== 'action') {
      pairs.push({ key: key.trim(), value: String(value).trim() })
    }
  })

  if (pairs.length === 0) return { success: false, error: 'لا توجد بيانات للحفظ' }

  // ── الكتابة باستخدام Admin Client (يتجاوز RLS) ─────────
  const supabase = createAdminClient()

  const { error: upsertError } = await supabase
    .from('settings')
    .upsert(pairs, { onConflict: 'key' })

  if (upsertError) {
    console.error('[saveSettings] upsert error:', upsertError)
    return { success: false, error: upsertError.message }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book')           // تحديث cache موقع العملاء أيضاً
  return { success: true }
}

export default async function SettingsPage() {
  // ── قراءة الإعدادات الحالية (Admin Client للتأكد من القراءة الكاملة) ──
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('key, value')

  const s: Record<string, string> = {}
  data?.forEach(r => { if (r.key) s[r.key] = r.value ?? '' })

  const Field = ({
    name, label, type = 'text', placeholder = '',
  }: { name: string; label: string; type?: string; placeholder?: string }) => (
    <div>
      <label style={{ display:'block', fontWeight:700, fontSize:'0.875rem', marginBottom:'0.4rem', color:'#1B2A3B' }}>
        {label}
      </label>
      <input
        type={type} name={name} className="input"
        defaultValue={s[name] ?? ''}
        placeholder={placeholder}
        style={{ width:'100%' }}
      />
    </div>
  )

  return (
    <div className="animate-fade-in" style={{ maxWidth:700 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.5rem' }}>
        <h1 style={{ fontSize:'1.6rem', margin:0, color:'#1B2A3B', fontWeight:800 }}>⚙️ الإعدادات</h1>
      </div>
      <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginBottom:'2rem' }}>
        جميع الإعدادات تُطبَّق فوراً على الموقع
      </p>

      <form action={async (fd) => {
        'use server'
        await saveSettings(fd)
      }}>

        {/* ── معلومات المنشأة ── */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem', color:'#1B2A3B' }}>🏟️ معلومات المنشأة</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <Field name="facility_name"     label="اسم المنشأة"        placeholder="مركز حي الشاطئ" />
            <Field name="facility_phone"    label="رقم الهاتف"         placeholder="0XXXXXXXXX" />
            <Field name="whatsapp_number"   label="رقم واتساب"         placeholder="9665XXXXXXXX" />
            <Field name="facility_location" label="رابط الموقع (خرائط)" placeholder="https://maps.google.com/..." />
          </div>
        </div>

        {/* ── معلومات البنك ── */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem', color:'#1B2A3B' }}>🏦 معلومات التحويل البنكي</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <Field name="bank_name"           label="اسم البنك"     placeholder="بنك الراجحي" />
            <Field name="bank_account_name"   label="اسم الحساب"   placeholder="مركز حي الشاطئ" />
            <Field name="bank_iban"           label="رقم الآيبان"   placeholder="SA..." />
            <Field name="bank_account_number" label="رقم الحساب"   placeholder="XXXX-XXXX-XXXX" />
          </div>
        </div>

        {/* ── الأسعار ── */}
        <div className="card" style={{ marginBottom:'1.25rem', border:'1.5px solid #C9A96E' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
            <h2 style={{ fontSize:'1rem', margin:0, color:'#1B2A3B' }}>💰 الأسعار (ريال سعودي)</h2>
            <span style={{
              background:'#C9A96E', color:'#1B2A3B', fontSize:'0.7rem',
              fontWeight:800, padding:'0.15rem 0.5rem', borderRadius:'99px',
            }}>يُطبَّق فوراً على موقع العملاء</span>
          </div>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginBottom:'1rem' }}>
            نفس السعر للفترات الثلاث لكل ملعب
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
            <Field name="price_football_normal"   label="⚽ كرة القدم"     type="number" placeholder="100" />
            <Field name="price_volleyball_normal" label="🏐 الكرة الطائرة" type="number" placeholder="80" />
            <Field name="price_multi_normal"      label="🏅 الملعب المتعدد" type="number" placeholder="60" />
          </div>
        </div>

        {/* ── إعدادات الحجز ── */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem', color:'#1B2A3B' }}>📋 إعدادات الحجز</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <Field name="booking_window_days"    label="نافذة الحجز (أيام)"             type="number" placeholder="7" />
            <Field name="max_pending_bookings"   label="أقصى حجوزات معلّقة للعميل"     type="number" placeholder="3" />
            <Field name="pending_expiry_hours"   label="انتهاء مهلة الإيصال (ساعات)"   type="number" placeholder="24" />
          </div>
        </div>

        {/* ── أسماء الملاعب ── */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem', color:'#1B2A3B' }}>🏟️ أسماء الملاعب</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginBottom:'1rem' }}>
            تُعرض هذه الأسماء في موقع العملاء ولوحة الإدارة
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
            <Field name="venue_1_name" label="⚽ الملعب ١ (football)" placeholder="كرة القدم" />
            <Field name="venue_2_name" label="🏐 الملعب ٢ (volleyball)" placeholder="الكرة الطائرة" />
            <Field name="venue_3_name" label="🏅 الملعب ٣ (multi)" placeholder="الملعب المتعدد" />
          </div>
        </div>

        {/* ── المياه ── */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', marginBottom:'1rem', color:'#1B2A3B' }}>💧 إعدادات المياه</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginBottom:'1rem' }}>
            يظهر خيار شراء كراتين المياه للعملاء أثناء الحجز
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <Field name="water_price_per_carton" label="سعر الكرتون (ريال)" type="number" placeholder="20" />
            <Field name="water_max_cartons"      label="الحد الأقصى لكل حجز" type="number" placeholder="10" />
          </div>
        </div>

        <button
          id="btn-save-settings"
          type="submit"
          className="btn btn-primary btn-lg"
          style={{ width:'100%', background:'#2D5C4E', fontSize:'1rem', fontWeight:800 }}
        >
          💾 حفظ جميع الإعدادات
        </button>
      </form>
    </div>
  )
}
