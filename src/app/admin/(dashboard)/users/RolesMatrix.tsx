'use client'
// ============================================================
// RolesMatrix — شاشة مصفوفة الأدوار والصلاحيات
// يُعرض كتبويب ثانٍ داخل /admin/users
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Loader2, ShieldCheck, RefreshCw } from 'lucide-react'

// ── أنواع البيانات ──────────────────────────────────────────

interface Role {
  id: string
  name: string
  label_ar: string
  description: string | null
  is_system: boolean
  permissions: string[]
  user_count: number
}

interface Props {
  onRolesChange: () => void   // لتحديث dropdown الأدوار في تبويب المستخدمين
}

// ── الصلاحيات مجمّعة حسب التصنيف ──────────────────────────

const PERMISSION_GROUPS = [
  {
    label: 'الحجوزات',
    icon: '📋',
    keys: [
      { key: 'view_bookings',      label: 'عرض الحجوزات' },
      { key: 'create_booking',     label: 'إنشاء حجز' },
      { key: 'edit_booking',       label: 'تعديل حجز' },
      { key: 'cancel_booking',     label: 'إلغاء حجز' },
      { key: 'soft_delete_booking',label: 'حذف ناعم للحجز' },
      { key: 'hard_delete_booking',label: 'حذف نهائي للحجز' },
    ],
  },
  {
    label: 'العملاء',
    icon: '👥',
    keys: [
      { key: 'view_customers',  label: 'عرض العملاء' },
      { key: 'edit_customer',   label: 'تعديل بيانات العميل' },
    ],
  },
  {
    label: 'الفواتير والمالية',
    icon: '💰',
    keys: [
      { key: 'view_invoices',      label: 'عرض الفواتير' },
      { key: 'manage_invoices',    label: 'إدارة الفواتير' },
      { key: 'manage_payments',    label: 'إدارة المدفوعات' },
      { key: 'delete_payment',     label: 'حذف مدفوعة' },
      { key: 'manage_credit_notes',label: 'إدارة إشعارات الدائن' },
    ],
  },
  {
    label: 'المصروفات',
    icon: '🧾',
    keys: [
      { key: 'view_expenses',   label: 'عرض المصروفات' },
      { key: 'create_expense',  label: 'إضافة مصروف' },
      { key: 'approve_expense', label: 'اعتماد مصروف' },
    ],
  },
  {
    label: 'الأكواد والتوافر',
    icon: '🏷️',
    keys: [
      { key: 'manage_codes',       label: 'إدارة الأكواد' },
      { key: 'manage_availability',label: 'إدارة التوافر' },
      { key: 'manage_closure',     label: 'إدارة الإغلاق' },
    ],
  },
  {
    label: 'التقارير والتصدير',
    icon: '📊',
    keys: [
      { key: 'view_dashboard', label: 'عرض لوحة التحكم' },
      { key: 'view_reports',   label: 'عرض التقارير' },
      { key: 'export_data',    label: 'تصدير البيانات' },
    ],
  },
  {
    label: 'إدارة النظام',
    icon: '⚙️',
    keys: [
      { key: 'manage_settings', label: 'إعدادات النظام' },
      { key: 'manage_users',    label: 'إدارة المستخدمين' },
      { key: 'approve_credit_note', label: 'اعتماد إشعار دائن' },
    ],
  },
]

// ── مُعرِّف فريد لكل مفتاح صلاحية ──────────────────────────
const ALL_KEYS = PERMISSION_GROUPS.flatMap(g => g.keys.map(k => k.key))

// ============================================================
// المكوّن
// ============================================================

export default function RolesMatrix({ onRolesChange }: Props) {
  const [mounted,    setMounted]    = useState(false)
  const [roles,      setRoles]      = useState<Role[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<string>('')        // معرّف الدور النشط
  const [toggling,   setToggling]   = useState<string | null>(null)  // key لتقفيل concurrent
  const [addOpen,    setAddOpen]    = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchRoles = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/admin/roles')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'فشل تحميل الأدوار')
      setRoles(data.roles ?? [])
      if (!activeTab && data.roles?.length > 0) {
        setActiveTab(data.roles[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { fetchRoles() }, [])  // استدعاء أولي فقط

  const activeRole = roles.find(r => r.id === activeTab) ?? null

  // ── تبديل صلاحية ───────────────────────────────────────────
  const handleToggle = async (roleId: string, permKey: string, currentlyGranted: boolean) => {
    const lockKey = `${roleId}:${permKey}`
    if (toggling === lockKey) return
    setToggling(lockKey)

    const action = currentlyGranted ? 'revoke' : 'grant'

    // Optimistic UI — تحديث فوري
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r
      const perms = currentlyGranted
        ? r.permissions.filter(p => p !== permKey)
        : [...r.permissions, permKey]
      return { ...r, permissions: perms }
    }))

    try {
      const res = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ permission_key: permKey, action }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Rollback عند الفشل
        setRoles(prev => prev.map(r => {
          if (r.id !== roleId) return r
          const perms = currentlyGranted
            ? [...r.permissions, permKey]
            : r.permissions.filter(p => p !== permKey)
          return { ...r, permissions: perms }
        }))
        alert(data.error ?? 'فشل تغيير الصلاحية')
      }
    } catch {
      // Rollback
      setRoles(prev => prev.map(r => {
        if (r.id !== roleId) return r
        const perms = currentlyGranted
          ? [...r.permissions, permKey]
          : r.permissions.filter(p => p !== permKey)
        return { ...r, permissions: perms }
      }))
      alert('فشل الاتصال بالخادم')
    } finally {
      setToggling(null)
    }
  }

  // ── العرض ─────────────────────────────────────────────────
  if (loading) return (
    <div className="u-loading-wrap">
      <Loader2 size={28} className="u-spin" />
      <span>جارٍ تحميل الأدوار…</span>
    </div>
  )

  if (error) return (
    <div className="u-error-wrap">
      <p>{error}</p>
      <button className="btn btn-ghost" onClick={fetchRoles}>إعادة المحاولة</button>
    </div>
  )

  return (
    <div className="rm-wrap">
      {/* ── شريط الأدوار (اختيار + إضافة) ── */}
      <div className="rm-role-bar">
        <div className="rm-role-tabs">
          {roles.map(role => (
            <button
              key={role.id}
              id={`role-tab-${role.name}`}
              className={`rm-role-btn ${activeTab === role.id ? 'rm-role-active' : ''}`}
              onClick={() => setActiveTab(role.id)}
            >
              {role.label_ar}
              {role.is_system && <span className="rm-sys-badge">نظام</span>}
              <span className="rm-user-count">{role.user_count}</span>
            </button>
          ))}
        </div>
        <div className="rm-role-actions">
          <button className="btn-icon" title="تحديث" onClick={fetchRoles}>
            <RefreshCw size={14} />
          </button>
          <button id="btn-add-role" className="btn btn-primary" style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.9rem' }} onClick={() => setAddOpen(true)}>
            <Plus size={14} strokeWidth={2.5} /> دور جديد
          </button>
        </div>
      </div>

      {/* ── معلومات الدور النشط ── */}
      {activeRole && (
        <div className="rm-role-info">
          <div className="rm-role-name">
            <ShieldCheck size={16} style={{ color: 'var(--color-lime)' }} />
            <strong>{activeRole.label_ar}</strong>
            {activeRole.is_system && <span className="rm-sys-badge">دور نظامي — لا يمكن حذفه</span>}
          </div>
          {activeRole.description && (
            <p className="rm-role-desc">{activeRole.description}</p>
          )}
          <div className="rm-role-stats">
            <span>{activeRole.permissions.length} صلاحية مفعّلة</span>
            <span>·</span>
            <span>{activeRole.user_count} موظف</span>
            <span>·</span>
            <span>{ALL_KEYS.length - activeRole.permissions.length} صلاحية معطّلة</span>
          </div>
        </div>
      )}

      {/* ── مصفوفة الصلاحيات ── */}
      {activeRole && (
        <div className="rm-matrix">
          {PERMISSION_GROUPS.map(group => (
            <div key={group.label} className="rm-group">
              <div className="rm-group-header">
                <span className="rm-group-icon">{group.icon}</span>
                <span className="rm-group-label">{group.label}</span>
                <span className="rm-group-count">
                  {group.keys.filter(k => activeRole.permissions.includes(k.key)).length}/{group.keys.length}
                </span>
              </div>
              <div className="rm-permissions">
                {group.keys.map(({ key, label }) => {
                  const granted    = activeRole.permissions.includes(key)
                  const lockKey    = `${activeRole.id}:${key}`
                  const isToggling = toggling === lockKey

                  return (
                    <div key={key} className={`rm-perm ${granted ? 'rm-perm-on' : 'rm-perm-off'}`}>
                      <div className="rm-perm-info">
                        <span className="rm-perm-label">{label}</span>
                        <code className="rm-perm-key">{key}</code>
                      </div>
                      <button
                        id={`toggle-${activeRole.name}-${key}`}
                        className={`rm-toggle ${granted ? 'rm-toggle-on' : 'rm-toggle-off'} ${isToggling ? 'rm-toggle-busy' : ''}`}
                        onClick={() => handleToggle(activeRole.id, key, granted)}
                        disabled={isToggling}
                        title={granted ? 'سحب الصلاحية' : 'منح الصلاحية'}
                        aria-checked={granted}
                        role="switch"
                      >
                        {isToggling
                          ? <Loader2 size={11} className="u-spin" />
                          : <span className="rm-toggle-knob" />
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: دور جديد ── */}
      {mounted && createPortal(
        <>
          {addOpen && (
            <AddRoleModal
              onClose={() => setAddOpen(false)}
              onSuccess={() => {
                setAddOpen(false)
                fetchRoles()
                onRolesChange()
              }}
            />
          )}
        </>,
        document.body
      )}

      {/* ── Styles ── */}
      <style>{`
        .rm-wrap { display: flex; flex-direction: column; gap: var(--space-5); }

        /* شريط الأدوار */
        .rm-role-bar {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .rm-role-tabs {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
          flex: 1;
        }
        .rm-role-btn {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .rm-role-btn:hover:not(.rm-role-active) { background: var(--bg-surface); color: var(--text-primary); }
        .rm-role-active {
          background: var(--color-lime-muted);
          border-color: var(--color-lime-dim);
          color: var(--color-lime);
        }
        [data-theme="light"] .rm-role-active { color: #2D5A00; border-color: #6B9E00; background: rgba(74,124,0,.08); }
        .rm-sys-badge {
          font-size: 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          border-radius: var(--radius-full);
          padding: 0.05em 0.5em;
        }
        .rm-user-count {
          font-size: 10px;
          background: rgba(200,255,62,.15);
          color: var(--color-lime);
          border-radius: var(--radius-full);
          padding: 0.1em 0.45em;
          font-weight: var(--font-bold);
          min-width: 16px;
          text-align: center;
        }
        [data-theme="light"] .rm-user-count { background: rgba(74,124,0,.12); color: #2D5A00; }
        .rm-role-actions { display: flex; gap: var(--space-2); align-items: center; }

        /* معلومات الدور */
        .rm-role-info {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-4) var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .rm-role-name { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-base); }
        .rm-role-desc { font-size: var(--text-sm); color: var(--text-secondary); margin: 0; }
        .rm-role-stats { display: flex; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); }

        /* المصفوفة */
        .rm-matrix {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-4);
        }
        .rm-group {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .rm-group-header {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border-subtle);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        .rm-group-icon { font-size: 15px; }
        .rm-group-label { flex: 1; }
        .rm-group-count {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }
        .rm-permissions { padding: var(--space-2) 0; }
        .rm-perm {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-4);
          transition: background 0.12s;
        }
        .rm-perm:hover { background: var(--bg-elevated); }
        .rm-perm-on .rm-perm-label  { color: var(--text-primary); }
        .rm-perm-off .rm-perm-label { color: var(--text-muted); }
        .rm-perm-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rm-perm-label { font-size: var(--text-sm); font-weight: var(--font-medium); }
        .rm-perm-key {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Toggle Switch */
        .rm-toggle {
          position: relative;
          width: 36px; height: 20px;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .rm-toggle-on  { background: var(--color-lime); }
        .rm-toggle-off { background: var(--border-color); }
        .rm-toggle-busy { opacity: 0.6; cursor: wait; }
        .rm-toggle-knob {
          position: absolute;
          width: 14px; height: 14px;
          border-radius: var(--radius-full);
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          transition: transform 0.2s ease;
        }
        .rm-toggle-on  .rm-toggle-knob { transform: translateX(-8px); }
        .rm-toggle-off .rm-toggle-knob { transform: translateX(8px); }
        [data-theme="light"] .rm-toggle-off { background: #CBD5D0; }
        [data-theme="light"] .rm-toggle-on  { background: #5A9000; }
        [data-theme="light"] .rm-toggle-knob { background: white; }

        /* ── Modal ── */
        .u-backdrop {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(3px);
          z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .u-modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%; max-width: 440px;
          padding: var(--space-6);
          animation: slideUp 0.18s ease;
        }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .u-modal-header {
          display: flex; align-items: center; gap: var(--space-3);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
        }
        .u-modal-icon {
          width: 36px; height: 36px;
          background: var(--color-lime-muted);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-lime);
        }
        .u-modal-title { font-size: var(--text-base); font-weight: var(--font-bold); color: var(--text-primary); margin: 0; }
        .u-modal-close {
          margin-right: auto;
          background: none; border: none;
          color: var(--text-muted); cursor: pointer;
          padding: var(--space-1); border-radius: var(--radius-sm);
          display: flex; transition: color 0.15s;
        }
        .u-modal-close:hover { color: var(--text-primary); }
        .u-modal-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-4); }
        .u-modal-label { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); }
        .u-modal-footer {
          display: flex; gap: var(--space-3); justify-content: flex-end;
          margin-top: var(--space-5); padding-top: var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }
        .u-modal-error {
          background: var(--color-danger-bg);
          border: 1px solid rgba(224,85,85,.3);
          border-radius: var(--radius-md);
          color: var(--color-danger);
          font-size: var(--text-sm);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
        }
        .u-modal-hint {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: var(--space-2);
        }
        .u-spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ============================================================
// Modal: إضافة دور جديد
// ============================================================
function AddRoleModal({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]     = useState({ name: '', display_name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const submit = async () => {
    if (!form.name.trim())         { setError('الاسم التقني مطلوب (إنجليزي)'); return }
    if (!form.display_name.trim()) { setError('الاسم العربي مطلوب'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/roles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      onSuccess()
    } catch { setError('فشل الاتصال') } finally { setLoading(false) }
  }

  return (
    <div className="u-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="u-modal">
        <div className="u-modal-header">
          <div className="u-modal-icon"><Plus size={18} /></div>
          <h3 className="u-modal-title">إضافة دور جديد</h3>
          <button className="u-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="u-modal-error">{error}</div>}

        <div className="u-modal-field">
          <label className="u-modal-label">الاسم التقني (إنجليزي)</label>
          <input
            id="add-role-name"
            className="input"
            placeholder="مثال: supervisor"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <span className="u-modal-hint">أحرف إنجليزية وأرقام وشرطة سفلية فقط</span>
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">الاسم العربي (label_ar)</label>
          <input
            id="add-role-label"
            className="input"
            placeholder="مثال: مشرف"
            value={form.display_name}
            onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
          />
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">الوصف (اختياري)</label>
          <input
            id="add-role-desc"
            className="input"
            placeholder="وصف مختصر لاستخدام هذا الدور"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="u-modal-hint" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
          🔒 سيُنشأ الدور بدون أي صلاحيات (رفض افتراضي). فعّل الصلاحيات التي تحتاجها يدوياً بعد الإنشاء.
        </div>

        <div className="u-modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
          <button id="btn-add-role-submit" className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="u-spin" /> : <Plus size={15} />}
            إنشاء الدور
          </button>
        </div>
      </div>
    </div>
  )
}
