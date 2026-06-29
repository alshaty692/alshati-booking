import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  Building2, Phone, MessageSquare, MapPin,
  Landmark, CreditCard, Hash,
  CircleDollarSign, Trophy, Layers, Tag,
  CalendarDays, Clock, Users,
  Droplets, Package, Save, AlertTriangle, Lock,
} from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'
import ClosureControl from '@/components/admin/ClosureControl'

export const metadata: Metadata = { title: 'الإعدادات' }

async function saveSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  'use server'
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return { success: false, error: 'غير مصرح — يرجى تسجيل الدخول' }

  const pairs: { key: string; value: string }[] = []
  formData.forEach((value, key) => {
    if (key !== 'action') pairs.push({ key: key.trim(), value: String(value).trim() })
  })

  if (pairs.length === 0) return { success: false, error: 'لا توجد بيانات للحفظ' }

  const supabase = createAdminClient()
  const { error: upsertError } = await supabase.from('settings').upsert(pairs, { onConflict: 'key' })

  if (upsertError) {
    console.error('[saveSettings] upsert error:', upsertError)
    return { success: false, error: upsertError.message }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book')
  return { success: true }
}

async function saveClosureSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  'use server'
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return { success: false, error: 'غير مصرح' }

  const supabase = createAdminClient()

  const active  = formData.get('closure_full_active') as string
  const start   = formData.get('closure_full_start')  as string
  const title   = formData.get('closure_full_title')  as string
  const message = formData.get('closure_full_message') as string

  const { error: upsertError } = await supabase.from('settings').upsert([
    { key: 'closure_full_active',  value: active  ?? 'false' },
    { key: 'closure_full_start',   value: start   ?? '' },
    { key: 'closure_full_title',   value: title   ?? 'المنشأة مغلقة مؤقتاً' },
    { key: 'closure_full_message', value: message ?? '' },
  ], { onConflict: 'key' })

  if (upsertError) {
    console.error('[saveClosureSettings]', upsertError)
    return { success: false, error: upsertError.message }
  }

  // لو الإغلاق فوري → احذف كل slot_holds النشطة (مهم!)
  const isImmediate = active === 'true' && (!start || start <= new Date().toISOString().slice(0,10))
  if (isImmediate) {
    await supabase.from('slot_holds').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('[saveClosureSettings] تم حذف كل slot_holds النشطة')
  }

  revalidatePath('/')
  revalidatePath('/book')
  revalidatePath('/my-bookings')
  revalidatePath('/admin/settings')
  return { success: true }
}

export default async function SettingsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('key, value')

  const s: Record<string, string> = {}
  data?.forEach(r => { if (r.key) s[r.key] = r.value ?? '' })

  type FieldProps = {
    name: string
    label: string
    icon: React.ReactNode
    type?: string
    placeholder?: string
    span?: boolean
    highlight?: boolean
  }

  const Field = ({ name, label, icon, type = 'text', placeholder = '', highlight }: FieldProps) => (
    <div className="s-field">
      <label htmlFor={`field-${name}`} className="s-field-label">
        <span className="s-field-icon">{icon}</span>
        {label}
      </label>
      <input
        id={`field-${name}`}
        type={type}
        name={name}
        className={`input${highlight ? ' s-field-highlight' : ''}`}
        defaultValue={s[name] ?? ''}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="animate-fade-in s-page">
      <PageHeader
        title="الإعدادات"
        subtitle="جميع الإعدادات تُطبَّق فوراً على الموقع"
      />

      <form action={async (fd) => {
        'use server'
        await saveSettings(fd)
      }}>
        {/* ── معلومات المنشأة ── */}
        <div className="s-section card">
          <div className="s-section-head">
            <Building2 size={18} strokeWidth={1.75} />
            <h2>معلومات المنشأة</h2>
          </div>
          <div className="s-grid-2">
            <Field name="facility_name"     label="اسم المنشأة"        icon={<Building2 size={14} />}      placeholder="مركز حي الشاطئ" />
            <Field name="facility_phone"    label="رقم الهاتف"         icon={<Phone size={14} />}          placeholder="0XXXXXXXXX" />
            <Field name="whatsapp_number"   label="رقم واتساب"         icon={<MessageSquare size={14} />}  placeholder="9665XXXXXXXX" />
            <Field name="facility_location" label="رابط الموقع (خرائط)" icon={<MapPin size={14} />}       placeholder="https://maps.google.com/..." />
          </div>
        </div>

        {/* ── معلومات البنك ── */}
        <div className="s-section card">
          <div className="s-section-head">
            <Landmark size={18} strokeWidth={1.75} />
            <h2>معلومات التحويل البنكي</h2>
          </div>
          <div className="s-grid-2">
            <Field name="bank_name"           label="اسم البنك"     icon={<Landmark size={14} />}      placeholder="بنك الراجحي" />
            <Field name="bank_account_name"   label="اسم الحساب"   icon={<Users size={14} />}         placeholder="مركز حي الشاطئ" />
            <Field name="bank_iban"           label="رقم الآيبان"   icon={<Hash size={14} />}          placeholder="SA..." />
            <Field name="bank_account_number" label="رقم الحساب"   icon={<CreditCard size={14} />}    placeholder="XXXX-XXXX-XXXX" />
          </div>
        </div>

        {/* ── الأسعار — كرت مميز (lime border) ── */}
        <div className="s-section card s-card-featured">
          <div className="s-section-head">
            <CircleDollarSign size={18} strokeWidth={1.75} />
            <h2>الأسعار (ريال سعودي)</h2>
            <span className="s-live-badge">يُطبَّق فوراً على موقع العملاء</span>
          </div>
          <p className="s-hint">نفس السعر للفترات الثلاث لكل ملعب</p>
          <div className="s-grid-3">
            <Field name="price_football_normal"   label="كرة القدم"      icon={<Trophy size={14} />}    type="number" placeholder="100" />
            <Field name="price_volleyball_normal" label="الكرة الطائرة"  icon={<Layers size={14} />}    type="number" placeholder="80" />
            <Field name="price_multi_normal"      label="الملعب المتعدد" icon={<Layers size={14} />}    type="number" placeholder="60" />
          </div>
        </div>

        {/* ── إعدادات الحجز ── */}
        <div className="s-section card">
          <div className="s-section-head">
            <CalendarDays size={18} strokeWidth={1.75} />
            <h2>إعدادات الحجز</h2>
          </div>
          <div className="s-grid-2">
            <Field name="booking_window_days"  label="نافذة الحجز (أيام)"             icon={<CalendarDays size={14} />} type="number" placeholder="7" />
            <Field name="max_pending_bookings" label="أقصى حجوزات معلّقة للعميل"     icon={<Users size={14} />}        type="number" placeholder="3" />
            <Field name="pending_expiry_hours" label="انتهاء مهلة الإيصال (ساعات)"   icon={<Clock size={14} />}        type="number" placeholder="24" />
          </div>
        </div>

        {/* ── أسماء الملاعب ── */}
        <div className="s-section card">
          <div className="s-section-head">
            <Tag size={18} strokeWidth={1.75} />
            <h2>أسماء الملاعب</h2>
          </div>
          <p className="s-hint">تُعرض هذه الأسماء في موقع العملاء ولوحة الإدارة</p>
          <div className="s-grid-3">
            <Field name="venue_1_name" label="الملعب ١ (football)"  icon={<Trophy size={14} />}  placeholder="كرة القدم" />
            <Field name="venue_2_name" label="الملعب ٢ (volleyball)" icon={<Layers size={14} />}  placeholder="الكرة الطائرة" />
            <Field name="venue_3_name" label="الملعب ٣ (multi)"      icon={<Layers size={14} />}  placeholder="الملعب المتعدد" />
          </div>
        </div>

        {/* ── إعدادات المياه ── */}
        <div className="s-section card">
          <div className="s-section-head">
            <Droplets size={18} strokeWidth={1.75} />
            <h2>إعدادات المياه</h2>
          </div>
          <p className="s-hint">يظهر خيار شراء كراتين المياه للعملاء أثناء الحجز</p>
          <div className="s-grid-3">
            <Field name="water_price_per_carton" label="سعر الكرتون (ريال)"    icon={<CircleDollarSign size={14} />} type="number" placeholder="20" />
            <Field name="water_max_cartons"      label="الحد الأقصى لكل حجز"  icon={<Package size={14} />}          type="number" placeholder="10" />
            <div className="s-field s-field-stock">
              <label htmlFor="field-water_stock" className="s-field-label">
                <span className="s-field-icon"><Package size={14} /></span>
                المخزون المتوفر
              </label>
              <input
                id="field-water_stock"
                type="number"
                name="water_stock_available"
                className="input s-field-highlight"
                defaultValue={s['water_stock_available'] ?? '50'}
                placeholder="50"
              />
              <p className="s-stock-note">
                <AlertTriangle size={11} strokeWidth={2} />
                يُنقص تلقائياً عند تأكيد حجز فيه مياه
              </p>
            </div>
          </div>
        </div>

        {/* ── زر الحفظ ── */}
        <button id="btn-save-settings" type="submit" className="btn btn-primary btn-lg s-save-btn">
          <Save size={18} strokeWidth={2} />
          حفظ جميع الإعدادات
        </button>
      </form>

      {/* ── إغلاق المنشأة الكامل ── */}
      <div className="s-section">
        <ClosureControl
          initialActive={s['closure_full_active'] === 'true'}
          initialStart={s['closure_full_start'] ?? ''}
          initialTitle={s['closure_full_title'] ?? 'المنشأة مغلقة مؤقتاً'}
          initialMessage={s['closure_full_message'] ?? 'نعتذر عن الإغلاق المؤقت، سنعود قريباً بإذن الله.'}
          saveAction={saveClosureSettings}
        />
      </div>
      <style>{`
        .s-page { max-width: 720px; }

        .s-section { margin-bottom: var(--space-5); }

        /* كرت الأسعار المميز */
        .s-card-featured {
          border-color: var(--color-lime-dim);
          box-shadow: 0 0 0 1px var(--color-lime-muted), var(--shadow-sm);
        }

        /* رأس القسم */
        .s-section-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
          color: var(--text-primary);
        }
        .s-section-head h2 {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          margin: 0;
          color: var(--text-primary);
        }
        .s-section-head > svg { color: var(--color-lime-dim); flex-shrink: 0; }

        .s-live-badge {
          margin-right: auto;
          background: var(--color-lime-muted);
          color: var(--color-lime);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 0.2em 0.65em;
          border-radius: var(--radius-full);
          border: 1px solid rgba(200,255,62,.2);
          white-space: nowrap;
        }
        [data-theme="light"] .s-live-badge {
          background: rgba(74,124,0,.1);
          color: #2D5A00;
          border-color: rgba(74,124,0,.2);
        }

        .s-hint {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: calc(-1 * var(--space-2)) 0 var(--space-4);
        }

        /* شبكات الحقول */
        .s-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .s-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-4); }

        @media (max-width: 640px) {
          .s-grid-2 { grid-template-columns: 1fr; }
          .s-grid-3 { grid-template-columns: 1fr; }
        }

        /* الحقل */
        .s-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .s-field-label {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }
        .s-field-icon { color: var(--text-muted); display: flex; }

        /* حقل مميز — lime border */
        .s-field-highlight {
          border-color: var(--color-lime-dim) !important;
        }
        .s-field-highlight:focus {
          border-color: var(--border-active) !important;
          box-shadow: 0 0 0 3px var(--color-lime-glow) !important;
        }

        /* ملاحظة المخزون */
        .s-stock-note {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: var(--space-1) 0 0;
        }

        /* زر الحفظ */
        .s-save-btn {
          width: 100%;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
      `}</style>
    </div>
  )
}
