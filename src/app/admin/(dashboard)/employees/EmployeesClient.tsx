'use client'
// ============================================================
// EmployeesClient — صفحة إدارة الفريق الميداني وملفات التعويض
// /admin/employees
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Loader2, Briefcase, UserCheck, UserX,
  RefreshCw, Edit2, DollarSign, Percent, Hash,
  Phone, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── أنواع البيانات ──────────────────────────────────────────

interface CompensationProfile {
  id:               string
  base_salary:      number
  commission_type:  'percentage' | 'fixed_per_booking' | 'none'
  commission_value: number
  is_active:        boolean
  updated_at:       string
}

interface Employee {
  id:                   string
  full_name:            string
  position:             string | null
  phone:                string | null
  hire_date:            string | null
  is_active:            boolean
  notes:                string | null
  created_at:           string
  compensation_profiles: CompensationProfile[]
}

interface Props {
  canManageEmployees: boolean
  canManagePayroll:   boolean
}

// ── مساعد: نوع العمولة بالعربية ─────────────────────────────

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  none:              'بدون عمولة',
  percentage:        'نسبة مئوية %',
  fixed_per_booking: 'مبلغ ثابت / حجز',
}

const COMMISSION_TYPE_ICON = {
  none:              null,
  percentage:        Percent,
  fixed_per_booking: Hash,
}

// ============================================================
// Modal: إضافة موظف جديد
// ============================================================

function AddEmployeeModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: (emp: Employee) => void
}) {
  const [form,    setForm]    = useState({ full_name: '', position: '', phone: '', hire_date: '', notes: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res  = await fetch('/api/admin/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess(data.employee)
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="emp-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="emp-modal" role="dialog" aria-modal="true" aria-labelledby="add-emp-title">
        <div className="emp-modal-header">
          <div className="emp-modal-icon"><Briefcase size={18} /></div>
          <h2 id="add-emp-title" className="emp-modal-title">موظف جديد</h2>
          <button className="emp-modal-close" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="emp-field">
            <label className="emp-label">الاسم الكامل *</label>
            <input id="emp-full-name" className="input" required autoFocus
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="محمد أحمد العلي"
            />
          </div>
          <div className="emp-field">
            <label className="emp-label">المنصب الوظيفي</label>
            <input id="emp-position" className="input"
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              placeholder="حارس ملعب، مشرف، ..."
            />
          </div>
          <div className="emp-row2">
            <div className="emp-field">
              <label className="emp-label">رقم الهاتف</label>
              <input id="emp-phone" className="input" type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="05XXXXXXXX"
              />
            </div>
            <div className="emp-field">
              <label className="emp-label">تاريخ التوظيف</label>
              <input id="emp-hire-date" className="input" type="date"
                value={form.hire_date}
                onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="emp-field">
            <label className="emp-label">ملاحظات</label>
            <textarea id="emp-notes" className="input" rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="أي ملاحظات إضافية..."
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && <p className="emp-error">{error}</p>}

          <div className="emp-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>إلغاء</button>
            <button id="btn-save-employee" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="emp-spin" /> : <Plus size={14} />}
              {saving ? 'جارٍ الحفظ…' : 'إضافة الموظف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Modal: تعديل ملف التعويض
// ============================================================

function CompensationModal({
  profile,
  employeeName,
  onClose,
  onSuccess,
}: {
  profile:      CompensationProfile
  employeeName: string
  onClose:      () => void
  onSuccess:    (updated: CompensationProfile) => void
}) {
  const [form,   setForm]   = useState({
    base_salary:      String(profile.base_salary),
    commission_type:  profile.commission_type,
    commission_value: String(profile.commission_value),
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    const salary = Number(form.base_salary)
    const value  = Number(form.commission_value)
    if (isNaN(salary) || salary < 0)   { setError('الراتب يجب أن يكون رقماً موجباً'); return }
    if (isNaN(value)  || value < 0)    { setError('قيمة العمولة يجب أن تكون موجبة'); return }
    if (form.commission_type === 'percentage' && value > 100) {
      setError('نسبة العمولة لا يمكن أن تتجاوز 100%')
      return
    }

    setSaving(true)
    try {
      const res  = await fetch(`/api/admin/compensation-profiles/${profile.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          base_salary:      salary,
          commission_type:  form.commission_type,
          commission_value: value,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess(data.profile)
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="emp-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="emp-modal" role="dialog" aria-modal="true" aria-labelledby="comp-modal-title">
        <div className="emp-modal-header">
          <div className="emp-modal-icon"><DollarSign size={18} /></div>
          <div style={{ flex: 1 }}>
            <h2 id="comp-modal-title" className="emp-modal-title">إعدادات الراتب</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>{employeeName}</p>
          </div>
          <button className="emp-modal-close" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="emp-field">
            <label className="emp-label">الراتب الأساسي (ريال/شهر)</label>
            <input id="comp-base-salary" className="input" type="number" min={0} step="0.01"
              value={form.base_salary}
              onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="emp-field">
            <label className="emp-label">نوع العمولة</label>
            <select id="comp-commission-type" className="input"
              value={form.commission_type}
              onChange={e => setForm(f => ({ ...f, commission_type: e.target.value as 'percentage' | 'fixed_per_booking' | 'none' }))}
            >
              <option value="none">بدون عمولة</option>
              <option value="percentage">نسبة مئوية % من الفاتورة</option>
              <option value="fixed_per_booking">مبلغ ثابت لكل حجز</option>
            </select>
          </div>

          {form.commission_type !== 'none' && (
            <div className="emp-field">
              <label className="emp-label">
                {form.commission_type === 'percentage' ? 'النسبة (0 – 100%)' : 'المبلغ الثابت (ريال)'}
              </label>
              <input id="comp-commission-value" className="input" type="number"
                min={0} max={form.commission_type === 'percentage' ? 100 : undefined} step="0.01"
                value={form.commission_value}
                onChange={e => setForm(f => ({ ...f, commission_value: e.target.value }))}
                placeholder={form.commission_type === 'percentage' ? '0' : '0.00'}
              />
              {form.commission_type === 'percentage' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  الحد الأقصى 100%
                </span>
              )}
            </div>
          )}

          {error && <p className="emp-error">{error}</p>}

          <div className="emp-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>إلغاء</button>
            <button id="btn-save-compensation" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="emp-spin" /> : <DollarSign size={14} />}
              {saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Modal: تعديل بيانات الموظف الأساسية
// ============================================================

function EditEmployeeModal({
  employee,
  onClose,
  onSuccess,
}: {
  employee:  Employee
  onClose:   () => void
  onSuccess: (updated: Employee) => void
}) {
  const [form,   setForm]   = useState({
    full_name: employee.full_name,
    position:  employee.position  ?? '',
    phone:     employee.phone     ?? '',
    hire_date: employee.hire_date ?? '',
    notes:     employee.notes     ?? '',
    is_active: employee.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.full_name.trim()) { setError('الاسم الكامل مطلوب'); return }
    setSaving(true)
    try {
      const res  = await fetch(`/api/admin/employees/${employee.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess({ ...employee, ...data.employee })
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="emp-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="emp-modal" role="dialog" aria-modal="true" aria-labelledby="edit-emp-title">
        <div className="emp-modal-header">
          <div className="emp-modal-icon"><Edit2 size={18} /></div>
          <h2 id="edit-emp-title" className="emp-modal-title">تعديل بيانات الموظف</h2>
          <button className="emp-modal-close" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="emp-field">
            <label className="emp-label">الاسم الكامل *</label>
            <input id="edit-emp-full-name" className="input" required autoFocus
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="emp-field">
            <label className="emp-label">المنصب الوظيفي</label>
            <input id="edit-emp-position" className="input"
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
            />
          </div>
          <div className="emp-row2">
            <div className="emp-field">
              <label className="emp-label">الهاتف</label>
              <input id="edit-emp-phone" className="input" type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="emp-field">
              <label className="emp-label">تاريخ التوظيف</label>
              <input id="edit-emp-hire-date" className="input" type="date"
                value={form.hire_date}
                onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="emp-field">
            <label className="emp-label">ملاحظات</label>
            <textarea id="edit-emp-notes" className="input" rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="emp-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)' }}>
            <input id="edit-emp-active" type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="edit-emp-active" className="emp-label" style={{ margin: 0, cursor: 'pointer' }}>
              موظف نشط (إلغاء التفعيل يخفيه من القائمة الافتراضية)
            </label>
          </div>

          {error && <p className="emp-error">{error}</p>}

          <div className="emp-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>إلغاء</button>
            <button id="btn-save-edit-employee" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="emp-spin" /> : null}
              {saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// بطاقة الموظف
// ============================================================

function EmployeeCard({
  employee,
  canManageEmployees,
  canManagePayroll,
  onEdit,
  onEditCompensation,
}: {
  employee:           Employee
  canManageEmployees: boolean
  canManagePayroll:   boolean
  onEdit:             (emp: Employee) => void
  onEditCompensation: (emp: Employee) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const profile = employee.compensation_profiles?.[0] ?? null

  const CommIcon = profile
    ? COMMISSION_TYPE_ICON[profile.commission_type] ?? null
    : null

  return (
    <div className={`emp-card ${!employee.is_active ? 'emp-card-inactive' : ''}`}>
      <div className="emp-card-main">
        {/* Avatar */}
        <div className="emp-avatar">
          {employee.full_name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="emp-info">
          <div className="emp-name">
            {employee.full_name}
            {!employee.is_active && <span className="emp-badge emp-badge-inactive">غير نشط</span>}
          </div>
          {employee.position && (
            <div className="emp-meta">{employee.position}</div>
          )}
          <div className="emp-meta-row">
            {employee.phone && (
              <span className="emp-meta-item">
                <Phone size={12} /> {employee.phone}
              </span>
            )}
            {employee.hire_date && (
              <span className="emp-meta-item">
                <Calendar size={12} /> {new Date(employee.hire_date).toLocaleDateString('ar-SA')}
              </span>
            )}
          </div>
        </div>

        {/* Compensation badge */}
        {profile && (
          <div className="emp-comp-badge">
            <div className="emp-salary">
              <DollarSign size={13} />
              <span>{Number(profile.base_salary).toLocaleString('ar-SA')} ر.س</span>
            </div>
            {profile.commission_type !== 'none' && (
              <div className="emp-commission">
                {CommIcon && <CommIcon size={12} />}
                <span>
                  {COMMISSION_TYPE_LABELS[profile.commission_type]}:&nbsp;
                  {profile.commission_type === 'percentage'
                    ? `${profile.commission_value}%`
                    : `${Number(profile.commission_value).toLocaleString('ar-SA')} ر.س`
                  }
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="emp-actions">
          {canManageEmployees && (
            <button
              id={`btn-edit-emp-${employee.id}`}
              className="btn-icon"
              title="تعديل البيانات"
              onClick={() => onEdit(employee)}
            >
              <Edit2 size={14} />
            </button>
          )}
          {canManagePayroll && profile && (
            <button
              id={`btn-comp-${employee.id}`}
              className="btn-icon"
              title="إعدادات الراتب والعمولة"
              onClick={() => onEditCompensation(employee)}
              style={{ color: 'var(--color-lime)' }}
            >
              <DollarSign size={14} />
            </button>
          )}
          {employee.notes && (
            <button
              className="btn-icon"
              title={expanded ? 'إخفاء الملاحظات' : 'عرض الملاحظات'}
              onClick={() => setExpanded(p => !p)}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && employee.notes && (
        <div className="emp-notes">{employee.notes}</div>
      )}
    </div>
  )
}

// ============================================================
// المكوّن الرئيسي
// ============================================================

export default function EmployeesClient({ canManageEmployees, canManagePayroll }: Props) {
  const [mounted,      setMounted]      = useState(false)
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const [addOpen,      setAddOpen]      = useState(false)
  const [editTarget,   setEditTarget]   = useState<Employee | null>(null)
  const [compTarget,   setCompTarget]   = useState<Employee | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/admin/employees?show_inactive=${showInactive}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل التحميل')
      setEmployees(data.employees ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  // ── Handlers ────────────────────────────────────────────────

  const handleAddSuccess = (emp: Employee) => {
    setEmployees(prev => [emp, ...prev])
    setAddOpen(false)
  }

  const handleEditSuccess = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    setEditTarget(null)
  }

  const handleCompSuccess = (updatedProfile: CompensationProfile) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== compTarget?.id) return emp
      return {
        ...emp,
        compensation_profiles: [updatedProfile],
      }
    }))
    setCompTarget(null)
  }

  // ── Render ───────────────────────────────────────────────────

  const activeCount   = employees.filter(e => e.is_active).length
  const inactiveCount = employees.filter(e => !e.is_active).length

  return (
    <>
      {/* ── Header toolbar ───────────────────────────────────── */}
      <div className="emp-toolbar">
        <div className="emp-stats">
          <span className="emp-stat">
            <UserCheck size={14} />
            {activeCount} نشط
          </span>
          {inactiveCount > 0 && (
            <span className="emp-stat emp-stat-dim">
              <UserX size={14} />
              {inactiveCount} غير نشط
            </span>
          )}
        </div>

        <div className="emp-toolbar-actions">
          <label className="emp-toggle-label">
            <input
              id="toggle-show-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            إظهار غير النشطين
          </label>

          <button className="btn-icon" title="تحديث" onClick={fetchEmployees}>
            <RefreshCw size={14} />
          </button>

          {canManageEmployees && (
            <button
              id="btn-add-employee"
              className="btn btn-primary"
              style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.9rem' }}
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} strokeWidth={2.5} /> موظف جديد
            </button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {loading ? (
        <div className="emp-center">
          <Loader2 size={28} className="emp-spin" />
          <span>جارٍ تحميل الموظفين…</span>
        </div>
      ) : error ? (
        <div className="emp-center">
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="btn btn-ghost" onClick={fetchEmployees}>إعادة المحاولة</button>
        </div>
      ) : employees.length === 0 ? (
        <div className="emp-empty">
          <Briefcase size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p>لا يوجد موظفون{showInactive ? '' : ' نشطون'} بعد</p>
          {canManageEmployees && (
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> أضف أول موظف
            </button>
          )}
        </div>
      ) : (
        <div className="emp-list">
          {employees.map(emp => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canManageEmployees={canManageEmployees}
              canManagePayroll={canManagePayroll}
              onEdit={setEditTarget}
              onEditCompensation={setCompTarget}
            />
          ))}
        </div>
      )}

      {/* ── Portals ──────────────────────────────────────────── */}
      {mounted && addOpen && createPortal(
        <AddEmployeeModal onClose={() => setAddOpen(false)} onSuccess={handleAddSuccess} />,
        document.body
      )}
      {mounted && editTarget && createPortal(
        <EditEmployeeModal
          employee={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleEditSuccess}
        />,
        document.body
      )}
      {mounted && compTarget?.compensation_profiles?.[0] && createPortal(
        <CompensationModal
          profile={compTarget.compensation_profiles[0]}
          employeeName={compTarget.full_name}
          onClose={() => setCompTarget(null)}
          onSuccess={handleCompSuccess}
        />,
        document.body
      )}

      {/* ── Styles ───────────────────────────────────────────── */}
      <style>{`
        .emp-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-bottom: var(--space-5);
        }
        .emp-toolbar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .emp-toggle-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }
        .emp-stats {
          display: flex;
          gap: var(--space-4);
        }
        .emp-stat {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--color-lime);
          font-weight: var(--font-semibold);
        }
        .emp-stat-dim { color: var(--text-muted); }

        .emp-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-16);
          color: var(--text-muted);
        }
        .emp-spin { animation: empSpin 0.9s linear infinite; }
        @keyframes empSpin { to { transform: rotate(360deg); } }

        .emp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-16);
          color: var(--text-muted);
          text-align: center;
        }

        /* ── بطاقة الموظف ──────────────────────────────── */
        .emp-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .emp-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .emp-card:hover { border-color: var(--border-active); }
        .emp-card-inactive { opacity: 0.65; }
        .emp-card-main {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4);
        }
        .emp-avatar {
          width: 42px; height: 42px;
          border-radius: var(--radius-full);
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--color-lime);
          flex-shrink: 0;
        }
        .emp-info { flex: 1; min-width: 0; }
        .emp-name {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .emp-meta {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .emp-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-top: 4px;
        }
        .emp-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .emp-badge {
          font-size: 10px;
          padding: 0.1em 0.55em;
          border-radius: var(--radius-full);
          font-weight: var(--font-semibold);
          border: 1px solid;
          white-space: nowrap;
        }
        .emp-badge-inactive {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border-color: rgba(245,166,35,.3);
        }

        /* بيانات التعويض بالبطاقة */
        .emp-comp-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          text-align: end;
        }
        .emp-salary {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        }
        .emp-commission {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-lime);
        }

        /* ملاحظات موسعة */
        .emp-notes {
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border-subtle);
          font-size: var(--text-xs);
          color: var(--text-secondary);
          background: var(--bg-elevated);
          white-space: pre-wrap;
        }

        /* الإجراءات */
        .emp-actions {
          display: flex;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        /* ── Modal ────────────────────────────────────────── */
        .emp-backdrop {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(3px);
          z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: empFadeIn 0.15s ease;
        }
        @keyframes empFadeIn { from { opacity:0 } to { opacity:1 } }
        .emp-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%; max-width: 460px;
          padding: var(--space-6);
          animation: empSlideUp 0.18s ease;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }
        @keyframes empSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .emp-modal-header {
          display: flex; align-items: center; gap: var(--space-3);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
        }
        .emp-modal-icon {
          width: 36px; height: 36px;
          background: var(--color-lime-muted);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-lime);
          flex-shrink: 0;
        }
        .emp-modal-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0; flex: 1;
        }
        .emp-modal-close {
          background: none; border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          display: flex;
          transition: color 0.15s;
        }
        .emp-modal-close:hover { color: var(--text-primary); }
        .emp-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
        }
        .emp-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }
        .emp-row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        .emp-error {
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--color-danger);
          margin-bottom: var(--space-4);
        }
        .emp-modal-footer {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          margin-top: var(--space-5);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }

        @media (max-width: 600px) {
          .emp-comp-badge { display: none; }
          .emp-row2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}
