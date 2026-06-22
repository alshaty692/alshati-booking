'use client'
// ============================================================
// زر إلغاء كامل باقة الحجزات (client component)
// ============================================================
import { useState } from 'react'
import { Package, Loader2, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BatchCancelButton({ batchId }: { batchId: string }) {
  const [loading, setLoading]     = useState(false)
  const [confirm, setConfirm]     = useState(false)
  const [reason, setReason]       = useState('')
  const [result, setResult]       = useState<string | null>(null)
  const router = useRouter()

  async function handleCancel() {
    if (!confirm) { setConfirm(true); return }
    if (!reason.trim()) { return }
    setLoading(true)
    try {
      const r = await fetch(
        `/api/admin/batch-booking?batch_id=${encodeURIComponent(batchId)}&reason=${encodeURIComponent(reason)}`,
        { method: 'DELETE' }
      )
      const d = await r.json()
      if (r.ok) {
        setResult(`✓ تم إلغاء ${d.cancelled} حجز من الباقة`)
        setTimeout(() => router.push('/admin/bookings'), 1500)
      } else {
        setResult(`✗ ${d.error ?? 'فشل الإلغاء'}`)
      }
    } catch {
      setResult('✗ تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <p style={{
        padding:'0.5rem 0.75rem', borderRadius:'0.4rem',
        background: result.startsWith('✓') ? 'rgba(163,230,53,0.1)' : 'rgba(255,80,80,0.1)',
        color: result.startsWith('✓') ? '#7bba00' : 'var(--danger)',
        fontSize:'0.85rem', fontWeight:600,
      }}>{result}</p>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      {confirm && (
        <>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="سبب إلغاء الباقة..."
            rows={2}
            style={{
              width:'100%', padding:'0.5rem 0.75rem',
              background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)',
              borderRadius:'0.5rem', color:'var(--text-main)', fontSize:'0.85rem',
              resize:'vertical',
            }}
          />
          <p style={{ fontSize:'0.75rem', color:'var(--danger)', display:'flex', alignItems:'center', gap:'0.3rem', margin:0 }}>
            <AlertTriangle size={12}/> سيُلغى كل الحجوزات النشطة في الباقة — لا يمكن التراجع
          </p>
        </>
      )}
      <button
        onClick={handleCancel}
        disabled={loading || (confirm && !reason.trim())}
        style={{
          background: confirm ? 'rgba(139,92,246,0.8)' : 'rgba(139,92,246,0.15)',
          color: confirm ? '#fff' : '#a78bfa',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius:'0.5rem', padding:'0.6rem 1rem',
          cursor: (loading || (confirm && !reason.trim())) ? 'not-allowed' : 'pointer',
          fontWeight:700, fontSize:'0.85rem',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
          opacity: (loading || (confirm && !reason.trim())) ? 0.6 : 1,
          width:'100%',
        }}
      >
        {loading
          ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>
          : <Package size={14}/>
        }
        {loading ? 'جارٍ الإلغاء...' : confirm ? 'تأكيد إلغاء الباقة' : 'إلغاء كامل الباقة'}
      </button>
      {confirm && (
        <button
          onClick={() => { setConfirm(false); setReason('') }}
          style={{
            background:'none', border:'1px solid var(--border-subtle)',
            borderRadius:'0.5rem', padding:'0.4rem',
            cursor:'pointer', color:'var(--text-muted)', fontSize:'0.8rem',
          }}
        >إلغاء</button>
      )}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
