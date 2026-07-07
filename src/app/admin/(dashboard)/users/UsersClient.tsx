'use client'
// ============================================================
// UsersClient — صفحة إدارة المستخدمين والأدوار (Client Component)
// /admin/users — تبويبان: المستخدمون | الأدوار والصلاحيات
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, Edit2, KeyRound,
  Loader2, X, Eye, EyeOff, ShieldCheck, UserCheck, UserX,
  Lock, LayoutGrid, DollarSign,
} from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'
import RolesMatrix from './RolesMatrix'

// ── أنواع البيانات ──────────────────────────────────────────

interface Role {
  id: string
  name: string
  label_ar: string
}

interface AdminUser {
  id: string
  username: string | null
  display_name: string | null
  is_active: boolean
  created_at: string
  role: Role | null
}

interface Props {
  currentUserId: string
}

// ── ألوان الأدوار ────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin:  'u-badge-admin',
  editor: 'u-badge-editor',
  viewer: 'u-badge-viewer',
}

// ============================================================
// المكوّن الرئيسي
// ============================================================

export default function UsersClient({ currentUserId }: Props) {
  const [mounted,  setMounted]  = useState(false)
  const [tab,      setTab]      = useState<'users' | 'roles'>('users')
  const [users,    setUsers]    = useState<AdminUser[]>([])
  const [roles,    setRoles]    = useState<Role[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // ── Modal states ──────────────────────────────────────────
  const [addOpen,      setAddOpen]      = useState(false)
  const [editUser,     setEditUser]     = useState<AdminUser | null>(null)
  const [resetUser,    setResetUser]    = useState<AdminUser | null>(null)
  const [pwdOpen,      setPwdOpen]      = useState(false)   // تغيير كلمة مرور حسابي
  const [togglingId,   setTogglingId]   = useState<string | null>(null)

  // SSR guard
  useEffect(() => { setMounted(true) }, [])

  // ── جلب البيانات ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ])
      const [uData, rData] = await Promise.all([uRes.json(), rRes.json()])
      if (!uRes.ok) throw new Error(uData.error ?? 'فشل تحميل المستخدمين')
      if (!rRes.ok) throw new Error(rData.error ?? 'فشل تحميل الأدوار')
      setUsers(uData.users ?? [])
      setRoles(rData.roles ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── تفعيل / تعطيل ──────────────────────────────────────────
  const handleToggle = async (user: AdminUser) => {
    if (togglingId) return
    setTogglingId(user.id)
    try {
      const res  = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: !user.is_active }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'فشل تغيير الحالة')
        return
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
    } catch {
      alert('فشل الاتصال بالخادم')
    } finally {
      setTogglingId(null)
    }
  }

  // ── العرض ─────────────────────────────────────────────────
  return (
    <div className="animate-fade-in u-page">
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة حسابات الموظفين وأدوار الوصول"
      />

      {/* ── التبويبان ── */}
      <div className="u-tabs">
        <button id="tab-users" className={`u-tab ${tab==='users'?'u-tab-active':''}`} onClick={()=>setTab('users')}>
          <Users size={15}/> الموظفون
        </button>
        <button id="tab-roles" className={`u-tab ${tab==='roles'?'u-tab-active':''}`} onClick={()=>setTab('roles')}>
          <LayoutGrid size={15}/> الأدوار والصلاحيات
        </button>
      </div>

      {/* ── تبويب: المستخدمون ── */}
      {tab === 'users' && <>
      {/* ── شريط الأدوات ── */}
      <div className="u-toolbar">
        <button id="btn-add-user" className="btn btn-primary" onClick={()=>setAddOpen(true)}>
          <Plus size={16} strokeWidth={2.5}/> إضافة موظف
        </button>
        <button id="btn-my-password" className="btn btn-ghost" onClick={()=>setPwdOpen(true)}>
          <Lock size={15} strokeWidth={2}/> تغيير كلمة مروري
        </button>
      </div>

      {/* ── محتوى ── */}
      {loading ? (
        <div className="u-loading-wrap">
          <Loader2 size={28} className="u-spin" />
          <span>جارٍ التحميل…</span>
        </div>
      ) : error ? (
        <div className="u-error-wrap">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={fetchData}>إعادة المحاولة</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>اسم المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th style={{ width: 200 }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                      لا يوجد موظفون
                    </td>
                  </tr>
                ) : users.map(user => {
                  const isMe = user.id === currentUserId
                  const displayName = user.display_name || '—'

                  return (
                    <tr key={user.id} className={!user.is_active ? 'u-row-inactive' : ''}>
                      {/* الاسم */}
                      <td>
                        <div className="u-user-cell">
                          <span className="u-user-avatar">
                            {(user.display_name ?? 'م')[0]}
                          </span>
                          <div>
                            <div className="u-user-name">
                              {displayName}
                              {isMe && (
                                <span className="u-badge-me">حسابك</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* اسم المستخدم */}
                      <td>
                        <code className="u-username">
                          {user.username ?? '—'}
                        </code>
                      </td>

                      {/* الدور */}
                      <td>
                        {user.role ? (
                          <span className={`badge ${ROLE_COLORS[user.role.name] ?? 'u-badge-custom'}`}>
                            {user.role.label_ar}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>بدون دور</span>
                        )}
                      </td>

                      {/* الحالة */}
                      <td>
                        <span className={`badge ${user.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                          {user.is_active ? 'نشط' : 'معطّل'}
                        </span>
                      </td>

                      {/* الإجراءات */}
                      <td>
                        <div className="u-actions">
                          {/* تعديل */}
                          <button
                            className="btn-icon"
                            title="تعديل"
                            onClick={() => setEditUser(user)}
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* إعادة تعيين كلمة المرور */}
                          <button
                            className="btn-icon"
                            title="إعادة تعيين كلمة المرور"
                            onClick={() => setResetUser(user)}
                          >
                            <KeyRound size={14} />
                          </button>

                          {/* إعدادات الراتب — رابط لصفحة الموظفين */}
                          <a
                            id={`btn-salary-${user.id}`}
                            className="btn-icon"
                            title="إعدادات الراتب والعمولة"
                            href={`/admin/employees?admin_user=${user.id}`}
                            style={{ color: 'var(--color-lime)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <DollarSign size={14} />
                          </a>

                          {/* تفعيل / تعطيل — لا يظهر على حسابي */}
                          {!isMe && (
                            <button
                              className={`btn-icon ${user.is_active ? 'u-btn-danger' : 'u-btn-success'}`}
                              title={user.is_active ? 'تعطيل' : 'تفعيل'}
                              disabled={togglingId === user.id}
                              onClick={() => handleToggle(user)}
                            >
                              {togglingId === user.id
                                ? <Loader2 size={14} className="u-spin" />
                                : user.is_active
                                  ? <UserX size={14} />
                                  : <UserCheck size={14} />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* إغلاق تبويب المستخدمين */}
      </>}

      {/* ── تبويب: الأدوار والصلاحيات ── */}
      {tab === 'roles' && <RolesMatrix onRolesChange={fetchData} />}

      {/* ── Modals (Portal) ─────────────────────────────────── */}
      {mounted && createPortal(
        <>

          {addOpen && (
            <AddUserModal
              roles={roles}
              onClose={() => setAddOpen(false)}
              onSuccess={() => { setAddOpen(false); fetchData() }}
            />
          )}
          {editUser && (
            <EditUserModal
              user={editUser}
              roles={roles}
              onClose={() => setEditUser(null)}
              onSuccess={() => { setEditUser(null); fetchData() }}
            />
          )}
          {resetUser && (
            <ResetPasswordModal
              user={resetUser}
              onClose={() => setResetUser(null)}
              onSuccess={() => setResetUser(null)}
            />
          )}
          {pwdOpen && (
            <MyPasswordModal
              onClose={() => setPwdOpen(false)}
              onSuccess={() => setPwdOpen(false)}
            />
          )}
        </>,
        document.body
      )}

      {/* ── Styles ─────────────────────────────────────────── */}
      <style>{`
        .u-tabs {
          display: flex;
          gap: var(--space-1);
          margin-bottom: var(--space-5);
          background: var(--bg-elevated);
          border-radius: var(--radius-lg);
          padding: var(--space-1);
          width: fit-content;
          border: 1px solid var(--border-color);
        }
        .u-tab {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .u-tab:hover:not(.u-tab-active) { background: var(--bg-surface); color: var(--text-primary); }
        .u-tab-active { background: var(--bg-surface); color: var(--color-lime); border: 1px solid var(--border-color); }
        [data-theme="light"] .u-tab-active { color: #2D5A00; }

        .u-page { max-width: 960px; }

        .u-toolbar {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-5);
          flex-wrap: wrap;
        }

        /* صف المستخدم المعطّل */
        .u-row-inactive td { opacity: 0.55; }

        /* خلية الاسم */
        .u-user-cell {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .u-user-avatar {
          width: 34px; height: 34px;
          background: var(--color-lime-muted);
          border: 1px solid var(--color-lime-dim);
          border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--color-lime);
          flex-shrink: 0;
        }
        .u-user-name {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
          color: var(--text-primary);
        }
        .u-badge-me {
          font-size: 10px;
          font-weight: var(--font-semibold);
          background: var(--color-lime-muted);
          color: var(--color-lime);
          border: 1px solid rgba(200,255,62,.25);
          border-radius: var(--radius-full);
          padding: 0.1em 0.55em;
          white-space: nowrap;
        }

        /* اسم المستخدم */
        .u-username {
          font-family: 'Courier New', monospace;
          font-size: var(--text-xs);
          color: var(--text-secondary);
          background: var(--bg-elevated);
          border-radius: var(--radius-sm);
          padding: 0.1em 0.5em;
        }

        /* badges الأدوار */
        .u-badge-admin  { background: rgba(224,85,85,.15);   color: #E05555; border-color: rgba(224,85,85,.3); }
        .u-badge-editor { background: rgba(74,158,191,.15);  color: #4A9EBF; border-color: rgba(74,158,191,.3); }
        .u-badge-viewer { background: rgba(122,145,130,.15); color: var(--text-secondary); border-color: rgba(122,145,130,.3); }
        .u-badge-custom { background: var(--color-warning-bg); color: var(--color-warning); border-color: rgba(245,166,35,.3); }

        /* أزرار الإجراءات */
        .u-actions { display: flex; gap: var(--space-2); align-items: center; }
        .btn-icon {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .btn-icon:hover:not(:disabled) { background: var(--bg-surface); color: var(--text-primary); border-color: var(--border-active); }
        .btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }
        .u-btn-danger:hover:not(:disabled)  { color: var(--color-danger);  border-color: var(--color-danger);  background: var(--color-danger-bg); }
        .u-btn-success:hover:not(:disabled) { color: var(--color-lime);    border-color: var(--color-lime-dim); background: var(--color-lime-muted); }

        /* loading / error */
        .u-loading-wrap, .u-error-wrap {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: var(--space-3);
          padding: var(--space-12);
          color: var(--text-muted);
        }
        .u-spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Modal ──────────────────────────────────── */
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
          position: relative;
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
        .u-modal-title {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0;
        }
        .u-modal-close {
          margin-right: auto;
          background: none; border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          display: flex;
          transition: color 0.15s;
        }
        .u-modal-close:hover { color: var(--text-primary); }
        .u-modal-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-4); }
        .u-modal-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
        }
        .u-pw-wrap { position: relative; }
        .u-pw-toggle {
          position: absolute; left: var(--space-3); top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--text-muted); cursor: pointer;
          display: flex; padding: 0;
          transition: color 0.15s;
        }
        .u-pw-toggle:hover { color: var(--text-primary); }
        .u-pw-input { padding-left: var(--space-8) !important; }
        .u-modal-footer {
          display: flex; gap: var(--space-3); justify-content: flex-end;
          margin-top: var(--space-5);
          padding-top: var(--space-4);
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
        .u-modal-success {
          background: var(--color-lime-muted);
          border: 1px solid rgba(200,255,62,.25);
          border-radius: var(--radius-md);
          color: var(--color-lime);
          font-size: var(--text-sm);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
        }
        [data-theme="light"] .u-badge-admin  { background: rgba(200,50,50,.1);   color: #B83030; }
        [data-theme="light"] .u-badge-editor { background: rgba(30,120,180,.1);  color: #1E78B4; }
        [data-theme="light"] .u-badge-viewer { background: rgba(90,110,100,.1);  color: #4A6056; }
        [data-theme="light"] .u-badge-me     { background: rgba(74,124,0,.1); color: #2D5A00; border-color: rgba(74,124,0,.2); }
        [data-theme="light"] .u-user-avatar  { background: rgba(74,124,0,.1); color: #2D5A00; border-color: rgba(74,124,0,.3); }
      `}</style>
    </div>
  )
}

// ============================================================
// Modal: إضافة موظف
// ============================================================
function AddUserModal({
  roles, onClose, onSuccess,
}: { roles: Role[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]     = useState({ username: '', password: '', display_name: '', role_id: roles[0]?.id ?? '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const submit = async () => {
    if (!form.username.trim()) { setError('اسم المستخدم مطلوب'); return }
    if (!form.password || form.password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (!form.role_id) { setError('اختر دوراً'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <h3 className="u-modal-title">إضافة موظف جديد</h3>
          <button className="u-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="u-modal-error">{error}</div>}

        <div className="u-modal-field">
          <label className="u-modal-label">اسم المستخدم (إنجليزي)</label>
          <input id="add-username" className="input" placeholder="مثال: khalid_m" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">الاسم المعروض</label>
          <input id="add-display-name" className="input" placeholder="مثال: خالد محمد" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">كلمة المرور</label>
          <div className="u-pw-wrap">
            <input id="add-password" className="input u-pw-input" type={showPw ? 'text' : 'password'} placeholder="8 أحرف على الأقل" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            <button type="button" className="u-pw-toggle" onClick={() => setShowPw(p => !p)}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">الدور</label>
          <select id="add-role" className="input" value={form.role_id} onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.label_ar}</option>)}
          </select>
        </div>

        <div className="u-modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
          <button id="btn-add-user-submit" className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="u-spin" /> : <Plus size={15} />}
            إضافة
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Modal: تعديل موظف
// ============================================================
function EditUserModal({
  user, roles, onClose, onSuccess,
}: { user: AdminUser; roles: Role[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]     = useState({ display_name: user.display_name ?? '', role_id: user.role?.id ?? '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const submit = async () => {
    if (!form.display_name.trim()) { setError('الاسم المعروض مطلوب'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: form.display_name, role_id: form.role_id || undefined }),
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
          <div className="u-modal-icon"><Edit2 size={18} /></div>
          <h3 className="u-modal-title">تعديل الموظف</h3>
          <button className="u-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="u-modal-error">{error}</div>}

        <div className="u-modal-field">
          <label className="u-modal-label">الاسم المعروض</label>
          <input id="edit-display-name" className="input" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
        </div>
        <div className="u-modal-field">
          <label className="u-modal-label">الدور</label>
          <select id="edit-role" className="input" value={form.role_id} onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.label_ar}</option>)}
          </select>
        </div>

        <div className="u-modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
          <button id="btn-edit-user-submit" className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="u-spin" /> : <ShieldCheck size={15} />}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Modal: إعادة تعيين كلمة مرور موظف
// ============================================================
function ResetPasswordModal({
  user, onClose, onSuccess,
}: { user: AdminUser; onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  const submit = async () => {
    if (!password || password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      setDone(true)
      setTimeout(onSuccess, 1500)
    } catch { setError('فشل الاتصال') } finally { setLoading(false) }
  }

  return (
    <div className="u-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="u-modal">
        <div className="u-modal-header">
          <div className="u-modal-icon"><KeyRound size={18} /></div>
          <h3 className="u-modal-title">إعادة تعيين كلمة مرور</h3>
          <button className="u-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          إعادة تعيين كلمة مرور: <strong style={{ color: 'var(--text-primary)' }}>{user.display_name ?? user.username ?? 'الموظف'}</strong>
        </p>

        {error && <div className="u-modal-error">{error}</div>}
        {done  && <div className="u-modal-success">✓ تمت إعادة التعيين بنجاح</div>}

        {!done && (
          <>
            <div className="u-modal-field">
              <label className="u-modal-label">كلمة المرور الجديدة</label>
              <div className="u-pw-wrap">
                <input id="reset-password-input" className="input u-pw-input" type={showPw ? 'text' : 'password'} placeholder="8 أحرف على الأقل" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="u-pw-toggle" onClick={() => setShowPw(p => !p)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="u-modal-footer">
              <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
              <button id="btn-reset-pw-submit" className="btn btn-primary" onClick={submit} disabled={loading}>
                {loading ? <Loader2 size={15} className="u-spin" /> : <KeyRound size={15} />}
                إعادة التعيين
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Modal: تغيير كلمة مرور الحالي (/me/password)
// ============================================================
function MyPasswordModal({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]       = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  const submit = async () => {
    if (!form.current_password) { setError('كلمة المرور الحالية مطلوبة'); return }
    if (form.new_password.length < 8) { setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'); return }
    if (form.new_password !== form.confirm_password) { setError('كلمتا المرور غير متطابقتين'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
      setDone(true)
      setTimeout(onSuccess, 1800)
    } catch { setError('فشل الاتصال') } finally { setLoading(false) }
  }

  return (
    <div className="u-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="u-modal">
        <div className="u-modal-header">
          <div className="u-modal-icon"><Lock size={18} /></div>
          <h3 className="u-modal-title">تغيير كلمة مروري</h3>
          <button className="u-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="u-modal-error">{error}</div>}
        {done  && <div className="u-modal-success">✓ تم تغيير كلمة المرور بنجاح</div>}

        {!done && (
          <>
            <div className="u-modal-field">
              <label className="u-modal-label">كلمة المرور الحالية</label>
              <div className="u-pw-wrap">
                <input id="my-current-pw" className="input u-pw-input" type={showCur ? 'text' : 'password'} value={form.current_password} onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))} />
                <button type="button" className="u-pw-toggle" onClick={() => setShowCur(p => !p)}>{showCur ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <div className="u-modal-field">
              <label className="u-modal-label">كلمة المرور الجديدة</label>
              <div className="u-pw-wrap">
                <input id="my-new-pw" className="input u-pw-input" type={showNew ? 'text' : 'password'} placeholder="8 أحرف على الأقل" value={form.new_password} onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))} />
                <button type="button" className="u-pw-toggle" onClick={() => setShowNew(p => !p)}>{showNew ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <div className="u-modal-field">
              <label className="u-modal-label">تأكيد كلمة المرور الجديدة</label>
              <input id="my-confirm-pw" className="input" type="password" value={form.confirm_password} onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))} />
            </div>
            <div className="u-modal-footer">
              <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
              <button id="btn-my-pw-submit" className="btn btn-primary" onClick={submit} disabled={loading}>
                {loading ? <Loader2 size={15} className="u-spin" /> : <Lock size={15} />}
                تغيير كلمة المرور
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
