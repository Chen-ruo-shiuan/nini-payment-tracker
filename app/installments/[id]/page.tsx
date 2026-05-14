'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipLevel } from '@/types'

interface Installment {
  id: number
  period_number: number
  due_date: string
  amount: number
  paid_at: string | null
}
interface Contract {
  id: number
  client_id: number
  client_name: string
  client_level: MembershipLevel
  total_amount: number
  total_periods: number
  payment_method: string
  note: string | null
  is_completed: number
  installments: Installment[]
}

const fmtAmt = (n: number) => `$ ${Math.round(n).toLocaleString()}`

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<number | null>(null)  // installment id being saved
  const [editId, setEditId]     = useState<number | null>(null)
  const [editAmt, setEditAmt]   = useState('')
  const [editDate, setEditDate] = useState('')
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/contracts/${id}`)
    if (!r.ok) { setLoading(false); return }
    setContract(await r.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function startEdit(inst: Installment) {
    setEditId(inst.id)
    setEditAmt(String(inst.amount))
    setEditDate(inst.due_date)
    setError('')
  }

  async function saveEdit(inst: Installment) {
    if (!editAmt || Number(editAmt) <= 0) { setError('請輸入有效金額'); return }
    setSaving(inst.id)
    const r = await fetch(`/api/installments/${inst.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(editAmt), due_date: editDate }),
    })
    setSaving(null)
    if (!r.ok) { const d = await r.json(); setError(d.error || '更新失敗'); return }
    setEditId(null)
    load()
  }

  async function deleteInst(inst: Installment) {
    if (!confirm(`確定刪除第 ${inst.period_number} 期（${fmtAmt(inst.amount)}）？`)) return
    setSaving(inst.id)
    const r = await fetch(`/api/installments/${inst.id}`, { method: 'DELETE' })
    setSaving(null)
    if (!r.ok) { const d = await r.json(); setError(d.error || '刪除失敗'); return }
    load()
  }

  async function markPaid(inst: Installment) {
    setSaving(inst.id)
    const r = await fetch(`/api/installments/${inst.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid_at: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) }),
    })
    setSaving(null)
    if (!r.ok) { const d = await r.json(); setError(d.error || '標記失敗'); return }
    load()
  }

  async function undoPaid(inst: Installment) {
    setSaving(inst.id)
    await fetch(`/api/installments/${inst.id}/pay`, { method: 'DELETE' })
    setSaving(null)
    load()
  }

  async function deleteContract() {
    if (!confirm('確定刪除整個分期計劃嗎？此操作無法復原。')) return
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    router.push('/installments')
  }

  if (loading) return (
    <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
  )
  if (!contract) return (
    <div style={{ color: '#9a4a4a', textAlign: 'center', padding: '60px 0' }}>找不到此分期計劃</div>
  )

  const totalPaid    = contract.installments.filter(i => i.paid_at).reduce((s, i) => s + i.amount, 0)
  const totalUnpaid  = contract.installments.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/installments" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 分期</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>分期計劃詳細</h1>
      </div>

      {/* Contract info */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Link href={`/clients/${contract.client_id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <span style={{ color: '#2c2825', fontSize: '1rem', fontWeight: 500 }}>{contract.client_name}</span>
              <MembershipBadge tier={contract.client_level} />
            </Link>
            <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '4px' }}>
              {contract.payment_method}　共 {contract.total_periods} 期
              {contract.note && `　${contract.note}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#2c2825', fontSize: '1.1rem', fontWeight: 600 }}>{fmtAmt(contract.total_amount)}</div>
            {contract.is_completed ? (
              <span style={{ color: '#4a6b52', fontSize: '0.7rem', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '4px', padding: '1px 7px' }}>完成</span>
            ) : (
              <div style={{ color: '#9a6a4a', fontSize: '0.78rem' }}>待收 {fmtAmt(totalUnpaid)}</div>
            )}
          </div>
        </div>
        {/* 進度條 */}
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#b4aa9e', marginBottom: '4px' }}>
            <span>已收 {fmtAmt(totalPaid)}</span>
            <span>未收 {fmtAmt(totalUnpaid)}</span>
          </div>
          <div style={{ background: '#e0d9d0', borderRadius: '4px', height: '5px' }}>
            <div style={{
              background: '#9ab89e',
              width: `${contract.total_amount > 0 ? Math.round((totalPaid / contract.total_amount) * 100) : 0}%`,
              height: '100%', borderRadius: '4px', transition: 'width 0.4s',
            }} />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#9a4a4a', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px', padding: '8px 12px', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Installment list */}
      <div className="space-y-2">
        <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>各期明細</p>
        {contract.installments.map(inst => {
          const isEditing = editId === inst.id
          const isBusy    = saving === inst.id
          const isPaid    = !!inst.paid_at

          return (
            <div key={inst.id} style={{
              background: isPaid ? '#f5f9f5' : '#faf8f5',
              border: `1px solid ${isPaid ? '#9ab89e' : '#e0d9d0'}`,
              borderRadius: '7px', padding: '12px',
            }}>
              {isEditing ? (
                /* ── 編輯模式 ── */
                <div className="space-y-2">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.7rem' }}>金額</label>
                      <input value={editAmt} onChange={e => setEditAmt(e.target.value)}
                        type="number" min="0"
                        style={{ width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '5px', color: '#2c2825', fontSize: '0.9rem', padding: '7px 10px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.7rem' }}>應收日</label>
                      <input value={editDate} onChange={e => setEditDate(e.target.value)}
                        type="date"
                        style={{ width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '5px', color: '#2c2825', fontSize: '0.9rem', padding: '7px 10px', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => saveEdit(inst)} disabled={isBusy}
                      style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '6px 16px', cursor: 'pointer', flex: 1 }}>
                      {isBusy ? '儲存中…' : '儲存'}
                    </button>
                    <button onClick={() => { setEditId(null); setError('') }}
                      style={{ background: '#f0ebe4', color: '#6b5f54', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '6px 16px', cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 顯示模式 ── */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: isPaid ? '#4a6b52' : '#2c2825', fontWeight: 500, fontSize: '0.88rem' }}>
                        第 {inst.period_number} 期
                      </span>
                      {isPaid && (
                        <span style={{ color: '#4a6b52', fontSize: '0.68rem', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '4px', padding: '1px 6px' }}>
                          已收 {inst.paid_at}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '2px' }}>
                      應收日 {inst.due_date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: isPaid ? '#4a6b52' : '#2c2825', fontWeight: 600, fontSize: '0.95rem' }}>
                      {fmtAmt(inst.amount)}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!isPaid && (
                        <>
                          <button onClick={() => startEdit(inst)} disabled={isBusy}
                            style={{ background: '#f0ebe4', color: '#6b5f54', border: 'none', borderRadius: '4px', fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                            編輯
                          </button>
                          <button onClick={() => markPaid(inst)} disabled={isBusy}
                            style={{ background: '#edf3eb', color: '#4a6b52', border: '1px solid #9ab89e', borderRadius: '4px', fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                            {isBusy ? '…' : '收款'}
                          </button>
                          <button onClick={() => deleteInst(inst)} disabled={isBusy}
                            style={{ background: 'none', color: '#c4a898', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '4px 6px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </>
                      )}
                      {isPaid && (
                        <button onClick={() => undoPaid(inst)} disabled={isBusy}
                          style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.7rem', padding: '3px 8px', cursor: 'pointer' }}>
                          {isBusy ? '…' : '取消收款'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete contract */}
      <div style={{ paddingTop: '8px', borderTop: '1px solid #f0ebe4' }}>
        <button onClick={deleteContract}
          style={{ color: '#9a4a4a', background: 'none', border: '1px solid #e8a8a8', borderRadius: '5px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer' }}>
          刪除整個分期計劃
        </button>
      </div>
    </div>
  )
}
