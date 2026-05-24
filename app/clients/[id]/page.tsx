'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import {
  Client, MembershipLevel, InstallmentContract, Installment,
  Package, SvLedgerEntry, TEA_QUOTA, LEVEL_POINTS, YODOMO_MILESTONES,
  BIRTHDAY_GIFT, HARVEST_GIFT, NEXT_LEVEL, LEVEL_THRESHOLDS, PAYMENT_METHODS,
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ContractWithInstallments extends InstallmentContract {
  installments: Installment[]
}
interface CheckoutItem {
  id: number; checkout_id: number; category: string; label: string; price: number; qty: number; pkg_id?: number
}
interface CheckoutPayment {
  id: number; checkout_id: number; method: string; amount: number
}
interface Checkout {
  id: number; client_id: number | null; date: string; note: string | null
  total_amount: number; incl_course: number; created_at: string
  items: CheckoutItem[]; payments: CheckoutPayment[]
}
interface PointsLedgerEntry {
  id: number; client_id: number; delta: number; note: string | null; date: string; created_at: string
}
interface ShoppingCreditEntry {
  id: number; client_id: number; delta: number; note: string | null; date: string; created_at: string
}
interface ClientDetail extends Client {
  stored_value: number
  active_contracts: number
  next_due_date: string | null
  active_packages: number
  shopping_credit: number
  contracts: ContractWithInstallments[]
  packages: Package[]
  sv_ledger: SvLedgerEntry[]
  points_ledger: PointsLedgerEntry[]
  shopping_credit_ledger: ShoppingCreditEntry[]
  checkouts: Checkout[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function thisMonth() {
  return todayStr().slice(0, 7)
}

// ─── Level colors ─────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  '癒米':   { bg: '#f0ede8', color: '#706c68', border: '#c8c4be' },
  '甜癒米': { bg: '#fce8f0', color: '#9a3060', border: '#e8a0c0' },
  '療癒米': { bg: '#e8f0fc', color: '#2d4f9a', border: '#9ab0e8' },
  '悟癒米': { bg: '#fdf5e0', color: '#7a5a00', border: '#e0c055' },
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      color: active ? '#2c2825' : '#9a8f84',
      borderBottom: active ? '2px solid #6b5f54' : '2px solid transparent',
      background: 'none', border: 'none',
      fontSize: '0.82rem', letterSpacing: '0.06em',
      padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

// ─── Installment Row ──────────────────────────────────────────────────────────
function InstallmentRow({ inst, onPay, onUnpay }: {
  inst: Installment; onPay: (id: number, paidAt: string) => void; onUnpay: (id: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const [payDate, setPayDate] = useState(todayStr)
  const isPaid = !!inst.paid_at
  const isOverdue = !isPaid && inst.due_date < todayStr()

  async function toggle() {
    setLoading(true)
    if (isPaid) {
      await fetch(`/api/installments/${inst.id}/pay`, { method: 'DELETE' })
      onUnpay(inst.id)
    } else {
      await fetch(`/api/installments/${inst.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_at: payDate }),
      })
      onPay(inst.id, payDate)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0ebe4' }}>
      <div>
        <span style={{ color: '#9a8f84', fontSize: '0.75rem', marginRight: '8px' }}>第 {inst.period_number} 期</span>
        <span style={{ color: isPaid ? '#9a8f84' : isOverdue ? '#9a4a4a' : '#2c2825', fontSize: '0.85rem', textDecoration: isPaid ? 'line-through' : 'none' }}>
          {fmtShort(inst.due_date)}
        </span>
        {inst.paid_at && (
          <span style={{ color: '#9a8f84', fontSize: '0.72rem', marginLeft: '6px' }}>
            （{fmtShort(inst.paid_at.slice(0, 10))} 繳）
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: isPaid ? '#9a8f84' : '#2c2825', fontSize: '0.9rem' }}>{fmtAmt(inst.amount)}</span>
        {!isPaid && (
          <input
            type="date"
            value={payDate}
            onChange={e => setPayDate(e.target.value)}
            style={{ border: '1px solid #ddd8d0', borderRadius: '4px', fontSize: '0.72rem', padding: '3px 6px', color: '#4a4642', background: '#faf8f5' }}
          />
        )}
        <button onClick={toggle} disabled={loading} style={{
          background: isPaid ? '#f0ebe4' : '#2c2825', color: isPaid ? '#9a8f84' : '#f7f4ef',
          border: 'none', borderRadius: '4px', fontSize: '0.72rem', padding: '4px 10px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>{isPaid ? '取消' : '繳納'}</button>
      </div>
    </div>
  )
}

function ContractCard({ contract, onChange }: {
  contract: ContractWithInstallments; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [insts, setInsts] = useState(contract.installments)
  const paidCount = insts.filter(i => i.paid_at).length
  const remaining = insts.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0)

  function handlePay(id: number, paidAt: string) {
    setInsts(prev => prev.map(i => i.id === id ? { ...i, paid_at: paidAt } : i))
    onChange()
  }
  function handleUnpay(id: number) {
    setInsts(prev => prev.map(i => i.id === id ? { ...i, paid_at: null } : i))
    onChange()
  }
  async function deleteContract() {
    if (!confirm('確定要刪除此分期合約？')) return
    await fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', marginBottom: '10px' }}>
      <div className="p-3 cursor-pointer flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{contract.payment_method}　{fmtAmt(contract.total_amount)}</div>
          <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
            {paidCount}/{insts.length} 期已繳{remaining > 0 && `　剩餘 ${fmtAmt(remaining)}`}{contract.is_completed ? '　✓ 完成' : ''}
          </div>
        </div>
        <div style={{ color: '#9a8f84' }}>{open ? '▲' : '▼'}</div>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #e0d9d0', padding: '0 12px 12px' }}>
          {insts.map(inst => <InstallmentRow key={inst.id} inst={inst} onPay={handlePay} onUnpay={handleUnpay} />)}
          {contract.note && <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '8px' }}>{contract.note}</p>}
          <button onClick={deleteContract} style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>刪除合約</button>
        </div>
      )}
    </div>
  )
}

// ─── Benefits Tab (interactive) ───────────────────────────────────────────────
function BenefitsTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const id = client.id
  const level = (client.level || '癒米') as MembershipLevel
  const lc = LEVEL_COLOR[level] ?? LEVEL_COLOR['癒米']
  const isPendingUpgrade = !!(client.level_since && client.level_since > todayStr())
  const effectiveLevel: MembershipLevel = isPendingUpgrade ? '癒米' : level
  const teaQuota = TEA_QUOTA[effectiveLevel]
  const pointRate = LEVEL_POINTS[effectiveLevel]   // 每千元金米點數
  const pointPct  = pointRate / 10                  // 百分比（20點 = 2%）

  // tea_usage: {"YYYY-MM": ["YYYY-MM-DD", ...]}
  const teaUsage: Record<string, string[]> = (() => {
    try {
      const raw = JSON.parse(client.tea_usage || '{}')
      // Support both old (count) and new (array) format
      const result: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(raw)) {
        result[k] = Array.isArray(v) ? v : []
      }
      return result
    } catch { return {} }
  })()
  const month = thisMonth()
  const teaDates = teaUsage[month] ?? []
  const [teaLoading, setTeaLoading] = useState<number | null>(null)

  // membership duration
  const since = client.level_since
  let duration = ''
  if (since && !isPendingUpgrade) {
    const start = new Date(since)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    const y = Math.floor(months / 12); const m = months % 12
    duration = y > 0 ? `${y} 年 ${m} 個月` : `${m} 個月`
  }

  // 生日福利
  const bdayPerks: Record<string, Record<string, string>> = (() => {
    try { return JSON.parse(client.birthday_perks || '{}') } catch { return {} }
  })()
  const thisYear = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 4)
  const thisYearPerks = bdayPerks[thisYear] ?? {}
  const [bdLoading, setBdLoading] = useState<string | null>(null)

  async function recordBdPerk(action: string, undo = false) {
    setBdLoading(action)
    const date = undo ? undefined : (prompt('請輸入日期（YYYY-MM-DD）', todayStr()) || todayStr())
    if (!undo && !date) { setBdLoading(null); return }
    try {
      const res = await fetch(`/api/clients/${id}/birthday-perk`, {
        method: undo ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, date, year: thisYear }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`操作失敗：${err.error || res.status}`)
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setBdLoading(null)
      refresh()
    }
  }

  async function recordHarvest(undo = false) {
    setBdLoading('harvest')
    const date = undo ? undefined : (prompt('請輸入日期（YYYY-MM-DD）', todayStr()) || todayStr())
    if (!undo && !date) { setBdLoading(null); return }
    await fetch(`/api/clients/${id}/birthday-perk`, {
      method: undo ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'harvest', date }),
    })
    setBdLoading(null)
    refresh()
  }

  // yodomo
  const cardPoints = client.yodomo_card_points
  const yodomoRedeemed: number[] = (() => {
    try { return JSON.parse(client.yodomo_redeemed || '[]') } catch { return [] }
  })()
  const [yodomoLoading, setYodomoLoading] = useState(false)

  // points adjust — new entry form
  const [ptDelta, setPtDelta] = useState('')
  const [ptNote, setPtNote] = useState('')
  const [ptDate, setPtDate] = useState(todayStr)
  const [ptLoading, setPtLoading] = useState(false)
  const [showPtForm, setShowPtForm] = useState(false)

  // points_ledger edit state
  const [ptEditingId, setPtEditingId] = useState<number | null>(null)
  const [ptEditDelta, setPtEditDelta] = useState('')
  const [ptEditNote, setPtEditNote] = useState('')
  const [ptEditDate, setPtEditDate] = useState('')
  const [ptEditSaving, setPtEditSaving] = useState(false)

  function startPtEdit(e: PointsLedgerEntry) {
    setPtEditingId(e.id)
    setPtEditDelta(String(e.delta))
    setPtEditNote(e.note ?? '')
    setPtEditDate(e.date)
  }

  async function savePtEdit(entryId: number) {
    setPtEditSaving(true)
    await fetch(`/api/points-ledger/${entryId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(ptEditDelta), note: ptEditNote, date: ptEditDate }),
    })
    setPtEditSaving(false)
    setPtEditingId(null)
    refresh()
  }

  async function deletePtEntry(entryId: number) {
    if (!confirm('確定刪除這筆金米記錄？')) return
    await fetch(`/api/points-ledger/${entryId}`, { method: 'DELETE' })
    refresh()
  }

  // shopping credit adjust
  const [scDelta, setScDelta] = useState('')
  const [scNote, setScNote] = useState('')
  const [scDate, setScDate] = useState(todayStr)
  const [scLoading, setScLoading] = useState(false)
  const [showScForm, setShowScForm] = useState(false)

  // shopping_credit_ledger edit state
  const [scEditingId, setScEditingId] = useState<number | null>(null)
  const [scEditDelta, setScEditDelta] = useState('')
  const [scEditNote, setScEditNote] = useState('')
  const [scEditDate, setScEditDate] = useState('')
  const [scEditSaving, setScEditSaving] = useState(false)

  function startScEdit(e: ShoppingCreditEntry) {
    setScEditingId(e.id); setScEditDelta(String(e.delta)); setScEditNote(e.note ?? ''); setScEditDate(e.date)
  }
  async function saveScEdit(entryId: number) {
    setScEditSaving(true)
    await fetch(`/api/shopping-credit-ledger/${entryId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(scEditDelta), note: scEditNote, date: scEditDate }),
    })
    setScEditSaving(false); setScEditingId(null); refresh()
  }
  async function deleteScEntry(entryId: number) {
    if (!confirm('確定刪除這筆購物金記錄？')) return
    await fetch(`/api/shopping-credit-ledger/${entryId}`, { method: 'DELETE' })
    refresh()
  }
  async function adjustShoppingCredit(e: React.FormEvent) {
    e.preventDefault()
    if (!scDelta) return
    setScLoading(true)
    await fetch(`/api/clients/${id}/shopping-credit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(scDelta), note: scNote, date: scDate }),
    })
    setScDelta(''); setScNote(''); setScDate(todayStr()); setShowScForm(false); setScLoading(false)
    refresh()
  }

  // yodomo adjust
  const [ydDelta, setYdDelta] = useState('')
  const [ydNote, setYdNote] = useState('')
  const [showYdForm, setShowYdForm] = useState(false)

  async function recordTea(slotIndex: number) {
    setTeaLoading(slotIndex)
    const date = prompt('請輸入日期（YYYY-MM-DD）', todayStr())
    if (!date) { setTeaLoading(null); return }
    const res = await fetch(`/api/clients/${id}/tea`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`記錄失敗：${err.error || res.status}`)
    }
    setTeaLoading(null)
    refresh()
  }

  async function cancelTea(date: string) {
    if (!confirm(`確定取消 ${fmtShort(date)} 的下午茶記錄？`)) return
    await fetch(`/api/clients/${id}/tea`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    refresh()
  }

  async function adjustPoints(e: React.FormEvent) {
    e.preventDefault()
    if (!ptDelta) return
    setPtLoading(true)
    await fetch(`/api/clients/${id}/points`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(ptDelta), note: ptNote, date: ptDate }),
    })
    setPtDelta(''); setPtNote(''); setPtDate(todayStr()); setShowPtForm(false); setPtLoading(false)
    refresh()
  }

  async function adjustYodomo(e: React.FormEvent) {
    e.preventDefault()
    if (!ydDelta) return
    setYodomoLoading(true)
    await fetch(`/api/clients/${id}/yodomo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(ydDelta), note: ydNote }),
    })
    setYdDelta(''); setYdNote(''); setShowYdForm(false); setYodomoLoading(false)
    refresh()
  }

  async function redeemYodomo(milestone: number) {
    if (!confirm(`確定兌換癒多多 ${milestone} 次里程碑？`)) return
    setYodomoLoading(true)
    const res = await fetch(`/api/clients/${id}/yodomo`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redeem: milestone }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error)
    setYodomoLoading(false)
    refresh()
  }

  return (
    <div className="space-y-5">

      {/* ── 會員期間 ── */}
      <BenefitSection label="會員期間">
        <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>
          {since ? `${fmtDate(since)} 起` : '未設定升等日期'}
          {duration && <span style={{ color: '#9a8f84', marginLeft: '10px', fontSize: '0.82rem' }}>（{duration}）</span>}
        </div>
      </BenefitSection>

      {/* ── 金米 ── */}
      <BenefitSection label={pointPct > 0 ? `金米　千元回饋 ${pointPct}%` : '金米（本等級不累積）'} color="#7a5a00" bg="#fdf5e0" border="#d4a830">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#7a5a00', fontSize: '1.6rem', fontWeight: 600 }}>{client.points}</span>
            <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>點</span>
          </div>
          <button onClick={() => setShowPtForm(v => !v)} style={{
            background: 'none', border: '1px solid #e0c055', color: '#7a5a00',
            borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
          }}>＋ 新增記錄</button>
        </div>
        {showPtForm && (
          <form onSubmit={adjustPoints} style={{ marginTop: '8px', background: '#f5f2ee', borderRadius: '6px', padding: '10px' }} className="space-y-2">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>增減金額（負數為扣除）</label>
                <input value={ptDelta} onChange={e => setPtDelta(e.target.value)}
                  type="number" style={miniInput} />
              </div>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期</label>
                <input value={ptDate} onChange={e => setPtDate(e.target.value)}
                  type="date" style={miniInput} />
              </div>
            </div>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註（選填）</label>
              <input value={ptNote} onChange={e => setPtNote(e.target.value)}
                placeholder="選填" style={miniInput} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" disabled={ptLoading || !ptDelta} style={{
                background: ptLoading || !ptDelta ? '#c4b8aa' : '#7a5a00', color: '#f7f4ef',
                border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1,
              }}>{ptLoading ? '儲存中…' : '新增'}</button>
              <button type="button" onClick={() => setShowPtForm(false)} style={{
                background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0',
                borderRadius: '4px', fontSize: '0.78rem', padding: '6px 14px', cursor: 'pointer',
              }}>取消</button>
            </div>
          </form>
        )}

        {/* ── 金米明細 ── */}
        <div className="space-y-1" style={{ marginTop: '10px' }}>
          {(client.points_ledger ?? []).length === 0 && (
            <p style={{ color: '#c4b8aa', fontSize: '0.82rem', textAlign: 'center', padding: '10px 0' }}>尚無金米記錄</p>
          )}
          {(client.points_ledger ?? []).map(e => {
            const isEditing = ptEditingId === e.id
            return (
              <div key={e.id} style={{ borderBottom: '1px solid #f0ebe4', padding: '8px 0' }}>
                {!isEditing ? (
                  /* ── 顯示模式 ── */
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(e.date)}</span>
                      {e.note && <span style={{ color: '#6b5f54', fontSize: '0.8rem', marginLeft: '8px' }}>{e.note}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: e.delta >= 0 ? '#7a5a00' : '#9a4a4a', fontSize: '0.9rem', fontWeight: 500 }}>
                        {e.delta >= 0 ? '+' : ''}$ {Math.abs(e.delta).toLocaleString()}
                      </span>
                      <button onClick={() => startPtEdit(e)}
                        style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>
                        編輯
                      </button>
                      <button onClick={() => deletePtEntry(e.id)}
                        style={{ background: 'none', color: '#c47070', border: '1px solid #e8c8c8', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>
                        刪除
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── 編輯模式 ── */
                  <div style={{ background: '#f5f2ee', borderRadius: '6px', padding: '10px' }} className="space-y-2">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>增減金額</label>
                        <input value={ptEditDelta} onChange={ev => setPtEditDelta(ev.target.value)}
                          type="number" style={miniInput} />
                      </div>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期</label>
                        <input value={ptEditDate} onChange={ev => setPtEditDate(ev.target.value)}
                          type="date" style={miniInput} />
                      </div>
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註</label>
                      <input value={ptEditNote} onChange={ev => setPtEditNote(ev.target.value)}
                        placeholder="選填" style={miniInput} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => savePtEdit(e.id)} disabled={ptEditSaving}
                        style={{ background: '#7a5a00', color: '#f7f4ef', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1 }}>
                        {ptEditSaving ? '儲存中…' : '儲存'}
                      </button>
                      <button onClick={() => setPtEditingId(null)}
                        style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 14px', cursor: 'pointer' }}>
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </BenefitSection>

      {/* ── 購物金 ── */}
      <BenefitSection label="購物金" color="#4a6b52" bg="#edf3eb" border="#9ab89e">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#4a6b52', fontSize: '1.6rem', fontWeight: 600 }}>{(client.shopping_credit ?? 0).toLocaleString()}</span>
            <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>元</span>
          </div>
          <button onClick={() => setShowScForm(v => !v)} style={{
            background: 'none', border: '1px solid #9ab89e', color: '#4a6b52',
            borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
          }}>＋ 新增記錄</button>
        </div>
        {showScForm && (
          <form onSubmit={adjustShoppingCredit} style={{ marginTop: '8px', background: '#f5f2ee', borderRadius: '6px', padding: '10px' }} className="space-y-2">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>增減金額（負數為扣除）</label>
                <input value={scDelta} onChange={e => setScDelta(e.target.value)} type="number" style={miniInput} />
              </div>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期</label>
                <input value={scDate} onChange={e => setScDate(e.target.value)} type="date" style={miniInput} />
              </div>
            </div>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註（選填，如：舊客介紹新客）</label>
              <input value={scNote} onChange={e => setScNote(e.target.value)} placeholder="選填" style={miniInput} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" disabled={scLoading || !scDelta} style={{
                background: scLoading || !scDelta ? '#c4b8aa' : '#4a6b52', color: '#f7f4ef',
                border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1,
              }}>{scLoading ? '儲存中…' : '新增'}</button>
              <button type="button" onClick={() => setShowScForm(false)} style={{
                background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0',
                borderRadius: '4px', fontSize: '0.78rem', padding: '6px 14px', cursor: 'pointer',
              }}>取消</button>
            </div>
          </form>
        )}
        {/* 購物金明細 */}
        <div className="space-y-1" style={{ marginTop: '10px' }}>
          {(client.shopping_credit_ledger ?? []).length === 0 && (
            <p style={{ color: '#c4b8aa', fontSize: '0.82rem', textAlign: 'center', padding: '10px 0' }}>尚無購物金記錄</p>
          )}
          {(client.shopping_credit_ledger ?? []).map(e => {
            const isEditing = scEditingId === e.id
            return (
              <div key={e.id} style={{ borderBottom: '1px solid #f0ebe4', padding: '8px 0' }}>
                {!isEditing ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(e.date)}</span>
                      {e.note && <span style={{ color: '#6b5f54', fontSize: '0.8rem', marginLeft: '8px' }}>{e.note}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: e.delta >= 0 ? '#4a6b52' : '#9a4a4a', fontSize: '0.9rem', fontWeight: 500 }}>
                        {e.delta >= 0 ? '+' : ''}$ {e.delta.toLocaleString()}
                      </span>
                      <button onClick={() => startScEdit(e)} style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>編輯</button>
                      <button onClick={() => deleteScEntry(e.id)} style={{ background: 'none', color: '#c47070', border: '1px solid #e8c8c8', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>刪除</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f5f2ee', borderRadius: '6px', padding: '10px' }} className="space-y-2">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>增減金額</label>
                        <input value={scEditDelta} onChange={ev => setScEditDelta(ev.target.value)} type="number" style={miniInput} />
                      </div>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期</label>
                        <input value={scEditDate} onChange={ev => setScEditDate(ev.target.value)} type="date" style={miniInput} />
                      </div>
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註</label>
                      <input value={scEditNote} onChange={ev => setScEditNote(ev.target.value)} placeholder="選填" style={miniInput} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => saveScEdit(e.id)} disabled={scEditSaving} style={{ background: '#4a6b52', color: '#f7f4ef', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1 }}>
                        {scEditSaving ? '儲存中…' : '儲存'}
                      </button>
                      <button onClick={() => setScEditingId(null)} style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 14px', cursor: 'pointer' }}>取消</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </BenefitSection>

      {/* ── 迎賓下午茶 ── */}
      <BenefitSection label={`迎賓下午茶　本月 ${teaQuota} 次`} color="#1a6b5a" bg="#e6f5f0" border="#5ab89e">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {Array.from({ length: teaQuota }).map((_, i) => {
            const date = teaDates[i]
            return date ? (
              // Used slot
              <div key={i} style={{
                background: '#e6f5f0', border: '1px solid #5ab89e',
                borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ color: '#1a6b5a' }}>☕ {fmtShort(date)}</span>
                <button onClick={() => cancelTea(date)} style={{
                  background: 'none', border: 'none', color: '#c4b8aa',
                  cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: '0 2px',
                }}>✕</button>
              </div>
            ) : (
              // Empty slot
              <button key={i} onClick={() => recordTea(i)}
                disabled={teaLoading === i}
                style={{
                  background: '#faf8f5', border: '1px dashed #d9d0c5',
                  borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem',
                  color: '#9a8f84', cursor: 'pointer',
                }}>
                第 {i + 1} 次　＋記錄
              </button>
            )
          })}
        </div>
        <p style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
          本月已使用 {teaDates.length}/{teaQuota} 次
          　{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })}
        </p>
      </BenefitSection>

      {/* ── 癒多多集點 ── */}
      <BenefitSection label="癒多多集點卡" color="#7a3d8a" bg="#f5eaf8" border="#d4a8e0">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#7a3d8a', fontSize: '1.6rem', fontWeight: 600 }}>{cardPoints}</span>
            <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>點</span>
            <span style={{ color: '#b4aa9e', fontSize: '0.75rem' }}>（第 {client.yodomo_total_cards + 1} 輪）</span>
          </div>
          <button onClick={() => setShowYdForm(v => !v)} style={{
            background: 'none', border: '1px solid #d4a8e0', color: '#7a3d8a',
            borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
          }}>調整</button>
        </div>

        {showYdForm && (
          <form onSubmit={adjustYodomo} style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input value={ydDelta} onChange={e => setYdDelta(e.target.value)}
              placeholder="增減金額（負數為扣除）" type="number" style={{ ...miniInput, flex: '1', minWidth: '140px' }} />
            <input value={ydNote} onChange={e => setYdNote(e.target.value)}
              placeholder="備註（選填）" style={{ ...miniInput, flex: '1', minWidth: '100px' }} />
            <button type="submit" disabled={yodomoLoading} style={miniBtn}>確認</button>
          </form>
        )}

        {/* Milestones */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {YODOMO_MILESTONES.map(m => {
            const redeemed = yodomoRedeemed.includes(m)
            const reachable = cardPoints >= m && !redeemed
            return (
              <div key={m} style={{
                borderRadius: '20px', fontSize: '0.78rem', padding: '5px 14px',
                background: redeemed ? '#c4a8d0' : reachable ? '#e8c8f0' : '#f0ebe4',
                color: redeemed ? '#fff' : reachable ? '#7a3d8a' : '#b4aa9e',
                border: `1px solid ${redeemed ? '#b898c8' : reachable ? '#d4a8e0' : '#e0d9d0'}`,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span>{m} 點</span>
                {redeemed && <span>✓ 已兌換</span>}
                {reachable && (
                  <button onClick={() => redeemYodomo(m)} disabled={yodomoLoading} style={{
                    background: '#7a3d8a', color: '#fff', border: 'none',
                    borderRadius: '10px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer',
                  }}>兌換</button>
                )}
              </div>
            )
          })}
        </div>
      </BenefitSection>

      {/* ── 生日福利 ── */}
      {client.birthday && (
        <BenefitSection label={`🎂 生日福利　${client.birthday.replace('-', '月').replace(/(\d+)$/, '$1日')}`} color="#9a5060" bg="#fce8f0" border="#e8a0b8">
          {isPendingUpgrade && (
            <p style={{ color: '#b4aa9e', fontSize: '0.75rem', marginBottom: '8px' }}>⚠ 升等日期尚未到，福利依「癒米」等級計算</p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* 公益捐款（甜癒米以上） */}
            {['甜癒米','療癒米','悟癒米'].includes(effectiveLevel) && (
              <PerkBtn
                label="公益捐款" done={!!thisYearPerks.donation} doneDate={thisYearPerks.donation}
                loading={bdLoading === 'donation'}
                onRecord={() => recordBdPerk('donation')}
                onUndo={() => recordBdPerk('donation', true)}
              />
            )}
            {/* 生日金 $100（甜癒米以上，自動入購物金） */}
            {['甜癒米','療癒米','悟癒米'].includes(effectiveLevel) && (
              <div>
                <PerkBtn
                  label="生日金 $100（→ 購物金）" done={!!thisYearPerks.cash} doneDate={thisYearPerks.cash}
                  loading={bdLoading === 'cash'}
                  onRecord={() => recordBdPerk('cash')}
                  onUndo={() => recordBdPerk('cash', true)}
                />
              </div>
            )}
            {/* 生日禮（全等級） */}
            <PerkBtn
              label={`生日禮：${BIRTHDAY_GIFT[effectiveLevel]}`} done={!!thisYearPerks.gift} doneDate={thisYearPerks.gift}
              loading={bdLoading === 'gift'}
              onRecord={() => recordBdPerk('gift')}
              onUndo={() => recordBdPerk('gift', true)}
            />
          </div>
        </BenefitSection>
      )}

      {/* ── 慶祝收成 ── */}
      {HARVEST_GIFT[effectiveLevel] && (
        <BenefitSection label="🌾 慶祝收成" color="#6b7a4a" bg="#f0f5e8" border="#c0d098">
          <PerkBtn
            label={`收成禮：${HARVEST_GIFT[effectiveLevel]}`}
            done={!!client.harvest_given} doneDate={client.harvest_given ?? undefined}
            loading={bdLoading === 'harvest'}
            onRecord={() => recordHarvest()}
            onUndo={() => recordHarvest(true)}
          />
          <p style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '6px' }}>於會員期滿時發放</p>
        </BenefitSection>
      )}
    </div>
  )
}

// ─── Perk Button ──────────────────────────────────────────────────────────────
function PerkBtn({ label, done, doneDate, loading, onRecord, onUndo }: {
  label: string; done: boolean; doneDate?: string;
  loading: boolean; onRecord: () => void; onUndo: () => void
}) {
  return (
    <div style={{
      borderRadius: '8px', border: `1px solid ${done ? '#9ab89e' : '#ddd8d0'}`,
      background: done ? '#edf3eb' : '#faf8f5',
      padding: '8px 12px', minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.78rem', color: done ? '#4a6b52' : '#706c68', marginBottom: '4px' }}>
        {done ? '✓ ' : ''}{label}
      </div>
      {done && doneDate && (
        <div style={{ fontSize: '0.68rem', color: '#9a8f84', marginBottom: '4px' }}>{fmtShort(doneDate)}</div>
      )}
      <button
        onClick={done ? onUndo : onRecord}
        disabled={loading}
        style={{
          fontSize: '0.68rem', padding: '2px 8px', border: `1px solid ${done ? '#c4b8aa' : '#4a6b52'}`,
          borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer',
          background: done ? '#f0ede8' : '#2c2825', color: done ? '#9a8f84' : '#f7f4ef',
          fontFamily: 'inherit',
        }}
      >
        {loading ? '…' : done ? '取消' : '記錄'}
      </button>
    </div>
  )
}

// ─── Stored Value Tab ─────────────────────────────────────────────────────────
const SV_PAY_METHODS = ['現金', '匯款', 'LINE Pay', '信用卡', '其他'] as const

function StoredValueTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  // ── 新增表單 ────────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [payMethod, setPayMethod] = useState('現金')
  const [inclAccum, setInclAccum] = useState(false)
  const [saving, setSaving] = useState(false)

  const isDeposit = Number(amount) > 0
  const allowance = isDeposit && paidAmount && Number(paidAmount) < Number(amount)
    ? Number(amount) - Number(paidAmount) : 0

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    await fetch('/api/sv-ledger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.id,
        amount: Number(amount),
        paid_amount: isDeposit && paidAmount ? Number(paidAmount) : null,
        note, date,
        payment_method: isDeposit ? payMethod : null,
        include_in_accumulation: inclAccum,
      }),
    })
    setAmount(''); setPaidAmount(''); setNote(''); setInclAccum(false); setSaving(false)
    refresh()
  }

  // ── 編輯狀態 ────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editPaid, setEditPaid] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editPay, setEditPay] = useState('現金')
  const [editInclAccum, setEditInclAccum] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  function startEdit(e: SvLedgerEntry) {
    setEditingId(e.id)
    setEditAmount(String(e.amount))
    setEditPaid(e.paid_amount !== null && e.paid_amount !== undefined ? String(e.paid_amount) : '')
    setEditNote(e.note ?? '')
    setEditDate(e.date)
    setEditPay(e.payment_method ?? '現金')
    setEditInclAccum(e.include_in_accumulation === 1)
  }

  async function saveEdit(id: number) {
    setSavingEdit(true)
    await fetch(`/api/sv-ledger/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(editAmount),
        paid_amount: editPaid ? Number(editPaid) : null,
        note: editNote,
        date: editDate,
        payment_method: editPay,
        include_in_accumulation: editInclAccum,
      }),
    })
    setSavingEdit(false)
    setEditingId(null)
    refresh()
  }

  const editIsDeposit = Number(editAmount) > 0
  const editAllowance = editIsDeposit && editPaid && Number(editPaid) < Number(editAmount)
    ? Number(editAmount) - Number(editPaid) : 0

  return (
    <div className="space-y-4">
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
        <div style={{ color: '#9a8f84', fontSize: '0.78rem', letterSpacing: '0.08em' }}>儲值餘額</div>
        <div style={{ color: '#2c2825', fontSize: '1.8rem', fontWeight: 500, marginTop: '4px' }}>{fmtAmt(client.stored_value)}</div>
      </div>
      <form onSubmit={addEntry} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }} className="space-y-3">
        <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>新增儲值 / 扣款</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>入帳金額（客人帳上）</label>
            <input value={amount} onChange={e => { setAmount(e.target.value); setPaidAmount('') }}
              placeholder="例：3000" type="number" style={inputStyle} />
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>
              實收金額（選填）
              {allowance > 0 && <span style={{ color: '#9a4a4a', marginLeft: '6px' }}>讓利 {fmtAmt(allowance)}</span>}
            </label>
            <input value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
              placeholder={isDeposit ? `無折扣填 ${amount || '同入帳'}` : '—'}
              type="number" disabled={!isDeposit} style={{ ...inputStyle, opacity: isDeposit ? 1 : 0.4 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
            disabled={!isDeposit} style={{ ...inputStyle, opacity: isDeposit ? 1 : 0.4 }}>
            {SV_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="備註（選填）" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inputStyle} />
          <button type="submit" disabled={saving || !amount} style={{
            background: saving || !amount ? '#c4b8aa' : '#2c2825', color: '#f7f4ef',
            border: 'none', borderRadius: '5px', fontSize: '0.85rem', cursor: 'pointer',
          }}>{saving ? '儲存中…' : '新增'}</button>
        </div>
        {isDeposit && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={inclAccum} onChange={e => setInclAccum(e.target.checked)}
              style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
            <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>計入年度消費累積（升等用）</span>
          </label>
        )}
      </form>

      <div className="space-y-1">
        {client.sv_ledger.length === 0 && (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無儲值記錄</p>
        )}
        {client.sv_ledger.map(e => {
          const hasAllowance = e.amount > 0 && e.paid_amount !== null && e.paid_amount !== undefined && e.paid_amount < e.amount
          const svAllowance = hasAllowance ? e.amount - (e.paid_amount as number) : 0
          const isEditing = editingId === e.id

          return (
            <div key={e.id} style={{ borderBottom: '1px solid #f0ebe4', padding: '8px 0' }}>
              {!isEditing ? (
                /* ── 顯示模式 ── */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(e.date)}</span>
                    {e.payment_method && e.amount > 0 && (
                      <span style={{ color: '#9a8f84', fontSize: '0.72rem', marginLeft: '6px', background: '#f0ebe4', borderRadius: '8px', padding: '1px 6px' }}>{e.payment_method}</span>
                    )}
                    {e.include_in_accumulation === 1 && e.amount > 0 && (
                      <span style={{ color: '#4a6b52', fontSize: '0.68rem', marginLeft: '6px', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '8px', padding: '1px 6px' }}>計入年度</span>
                    )}
                    {hasAllowance && (
                      <span style={{ color: '#9a4a4a', fontSize: '0.68rem', marginLeft: '6px', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '8px', padding: '1px 6px' }}>
                        實收 {fmtAmt(e.paid_amount as number)}　讓利 {fmtAmt(svAllowance)}
                      </span>
                    )}
                    {e.note && <span style={{ color: '#6b5f54', fontSize: '0.8rem', marginLeft: '8px' }}>{e.note}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: e.amount >= 0 ? '#4a6b52' : '#9a4a4a', fontSize: '0.9rem', fontWeight: 500 }}>
                      {e.amount >= 0 ? '+' : ''}{fmtAmt(e.amount)}
                    </span>
                    <button onClick={() => startEdit(e)}
                      style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>
                      編輯
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 編輯模式 ── */
                <div style={{ background: '#f5f2ee', borderRadius: '6px', padding: '10px' }} className="space-y-2">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>入帳金額</label>
                      <input value={editAmount} onChange={e => { setEditAmount(e.target.value); setEditPaid('') }}
                        type="number" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>
                        實收金額（選填）
                        {editAllowance > 0 && <span style={{ color: '#9a4a4a', marginLeft: '4px' }}>讓利 {fmtAmt(editAllowance)}</span>}
                      </label>
                      <input value={editPaid} onChange={e => setEditPaid(e.target.value)}
                        type="number" disabled={!editIsDeposit}
                        style={{ ...inputStyle, opacity: editIsDeposit ? 1 : 0.4 }} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>付款方式</label>
                      <select value={editPay} onChange={e => setEditPay(e.target.value)}
                        disabled={!editIsDeposit} style={{ ...inputStyle, opacity: editIsDeposit ? 1 : 0.4 }}>
                        {SV_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期</label>
                      <input value={editDate} onChange={e => setEditDate(e.target.value)}
                        type="date" style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註</label>
                    <input value={editNote} onChange={e => setEditNote(e.target.value)}
                      placeholder="選填" style={inputStyle} />
                  </div>
                  {editIsDeposit && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editInclAccum} onChange={ev => setEditInclAccum(ev.target.checked)}
                        style={{ accentColor: '#6b5f54', width: '14px', height: '14px' }} />
                      <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>計入年度消費累積（升等用）</span>
                    </label>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => saveEdit(e.id)} disabled={savingEdit}
                      style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1 }}>
                      {savingEdit ? '儲存中…' : '儲存'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 14px', cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Packages Tab ─────────────────────────────────────────────────────────────
function PackagesTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [recalcing, setRecalcing] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Package>>({})
  const [saving, setSaving] = useState(false)

  async function recalc(pkgId: number) {
    setRecalcing(pkgId)
    await fetch(`/api/packages/${pkgId}/recalc`, { method: 'POST' })
    setRecalcing(null)
    refresh()
  }

  function startEdit(pkg: Package) {
    setEditingId(pkg.id)
    setEditForm({
      service_name: pkg.service_name,
      total_sessions: pkg.total_sessions,
      unit_price: pkg.unit_price,
      unit_price_orig: pkg.unit_price_orig,
      prepaid_amount: pkg.prepaid_amount,
      payment_method: pkg.payment_method,
      date: pkg.date,
      note: pkg.note ?? '',
      include_in_accumulation: pkg.include_in_accumulation,
      include_in_points: pkg.include_in_points,
      timing_note: pkg.timing_note ?? '',
      bonus_desc: pkg.bonus_desc ?? '',
      timing_max_weeks: pkg.timing_max_weeks ?? undefined,
      bonus_active: pkg.bonus_active ?? 1,
    })
  }

  async function saveEdit(pkg: Package) {
    setSaving(true)
    await fetch(`/api/packages/${pkg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    setEditingId(null)
    refresh()
  }

  async function deletePkg(pkg: Package) {
    if (!confirm(`確定刪除套組「${pkg.service_name}」？`)) return
    await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' })
    refresh()
  }

  const miniInput: React.CSSProperties = {
    width: '100%', padding: '4px 7px', borderRadius: '4px',
    border: '1px solid #d9d0c5', fontSize: '0.78rem', background: '#faf8f5',
  }

  const activePkgs    = client.packages.filter(p => p.used_sessions < p.total_sessions)
  const completedPkgs = client.packages.filter(p => p.used_sessions >= p.total_sessions)
  const [showHistory, setShowHistory] = useState(false)

  async function toggleBonus(pkg: Package) {
    const newActive = pkg.bonus_active ? 0 : 1
    const msg = newActive ? `確定恢復「${pkg.service_name}」的達標任務？` : `確定撤銷「${pkg.service_name}」的達標任務？\n客人已無法享有贈品。`
    if (!confirm(msg)) return
    await fetch(`/api/packages/${pkg.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pkg, bonus_active: newActive }),
    })
    refresh()
  }

  function PkgCard({ pkg }: { pkg: Package }) {
    const remaining = pkg.total_sessions - pkg.used_sessions
    const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
    const isDone    = remaining <= 0
    const isEditing = editingId === pkg.id

    // 任務倒數計算
    const hasTask = !isDone && !!pkg.bonus_desc && !!pkg.timing_max_weeks && pkg.bonus_active
    const lastDate = pkg.last_session_date || pkg.date
    const deadlineDays = hasTask && lastDate && pkg.timing_max_weeks
      ? Math.round((new Date(lastDate).getTime() + pkg.timing_max_weeks * 7 * 86400000 - Date.now()) / 86400000)
      : null
    const taskColor = deadlineDays === null ? '' : deadlineDays < 0 ? '#9a4a4a' : deadlineDays <= 7 ? '#9a6a2a' : '#4a6b52'
    const taskBg    = deadlineDays === null ? '' : deadlineDays < 0 ? '#fdf0f0' : deadlineDays <= 7 ? '#fdf5e8' : '#edf3eb'

    return (
      <div key={pkg.id} style={{ background: isDone ? '#f5f2ee' : '#faf8f5', border: `1px solid ${isDone ? '#d9d0c5' : '#e0d9d0'}`, borderRadius: '6px', padding: '12px' }}>
            {!isEditing ? (
              <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{pkg.service_name}</div>
                  <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
                    {fmtShort(pkg.date)}　{pkg.payment_method}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        background: remaining > 0 ? '#9ab89e' : '#c4b8aa',
                        width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '3px' }}>
                      已用 {pkg.used_sessions} / {pkg.total_sessions} 次
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div style={{ color: remaining > 0 ? '#4a6b52' : '#9a8f84', fontSize: '0.9rem', fontWeight: 500 }}>
                    剩 {remaining} 次
                  </div>
                  <div style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtAmt(pkg.prepaid_amount)}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => startEdit(pkg)}
                      style={{ color: '#6b5f54', fontSize: '0.65rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>
                      編輯
                    </button>
                    <button onClick={() => recalc(pkg.id)} disabled={recalcing === pkg.id}
                      style={{ color: '#9a8f84', fontSize: '0.65rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {recalcing === pkg.id ? '…' : '重算'}
                    </button>
                    <button onClick={() => deletePkg(pkg)}
                      style={{ color: '#9a4a4a', fontSize: '0.65rem', background: 'none', border: '1px solid #e8a8a8', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>
                      刪除
                    </button>
                  </div>
                </div>
              </div>

              {/* 鼓勵任務區塊 */}
              {pkg.bonus_desc && !isDone && (
                <div style={{
                  marginTop: '10px', borderTop: '1px solid #e8e2db', paddingTop: '8px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
                }}>
                  <div style={{ flex: 1 }}>
                    {pkg.bonus_active ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: '#9a6a2a' }}>🎁 達標贈</span>
                          <span style={{ fontSize: '0.78rem', color: '#6b5044', fontWeight: 500 }}>{pkg.bonus_desc}</span>
                          {pkg.timing_note && (
                            <span style={{ fontSize: '0.68rem', color: '#9a8f84', background: '#f0ebe4', borderRadius: '4px', padding: '1px 6px' }}>
                              {pkg.timing_note}內回來
                            </span>
                          )}
                        </div>
                        {deadlineDays !== null && (
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.68rem', background: taskBg, color: taskColor, border: `1px solid ${taskColor}55`, borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
                              {deadlineDays < 0
                                ? `⚠ 已逾期 ${Math.abs(deadlineDays)} 天`
                                : deadlineDays === 0 ? '⚡ 今天截止！'
                                : `截止還有 ${deadlineDays} 天`}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#b4aa9e' }}>
                              上次 {fmtShort(lastDate)}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#b4aa9e' }}>🎁 達標任務已撤銷（{pkg.bonus_desc}）</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleBonus(pkg)}
                    style={{
                      fontSize: '0.65rem', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      color: pkg.bonus_active ? '#9a4a4a' : '#4a6b52',
                      border: `1px solid ${pkg.bonus_active ? '#e8a8a8' : '#9ab89e'}`,
                      borderRadius: '4px', padding: '2px 8px',
                    }}>
                    {pkg.bonus_active ? '撤銷任務' : '恢復任務'}
                  </button>
                </div>
              )}
              </>
            ) : (
              /* ── 編輯表單 ── */
              <div className="space-y-2">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>服務名稱</label>
                    <input value={editForm.service_name ?? ''} onChange={e => setEditForm(f => ({ ...f, service_name: e.target.value }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>日期</label>
                    <input type="date" value={editForm.date ?? ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>總堂數</label>
                    <input type="number" value={editForm.total_sessions ?? ''} onChange={e => setEditForm(f => ({ ...f, total_sessions: Number(e.target.value) }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>
                      單堂原價
                      <span style={{ color: '#b4aa9e', marginLeft: '4px' }}>（定價，影響累積）</span>
                    </label>
                    <input type="number" value={editForm.unit_price_orig ?? ''} onChange={e => setEditForm(f => ({ ...f, unit_price_orig: Number(e.target.value) }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>單堂記帳價（折後）</label>
                    <input type="number" value={editForm.unit_price ?? ''} onChange={e => setEditForm(f => ({ ...f, unit_price: Number(e.target.value) }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>預收金額（實收現金）</label>
                    <input type="number" value={editForm.prepaid_amount ?? ''} onChange={e => setEditForm(f => ({ ...f, prepaid_amount: Number(e.target.value) }))} style={miniInput} />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>付款方式</label>
                    <select value={editForm.payment_method ?? '現金'} onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))} style={miniInput}>
                      {PAYMENT_METHODS.filter(m => m !== '商品券').map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>備註</label>
                  <input value={editForm.note ?? ''} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} style={miniInput} />
                </div>

                {/* 鼓勵任務設定 */}
                <div style={{ borderTop: '1px solid #e8e2db', paddingTop: '8px' }}>
                  <p style={{ color: '#9a6a2a', fontSize: '0.68rem', marginBottom: '6px', letterSpacing: '0.05em' }}>🎁 達標任務（選填）</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>回訪間隔（顯示用）</label>
                      <input value={editForm.timing_note ?? ''} onChange={e => setEditForm(f => ({ ...f, timing_note: e.target.value }))}
                        placeholder="例：3-4 週" style={miniInput} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>最長幾週（計算截止日）</label>
                      <input type="number" min="1" max="12" value={editForm.timing_max_weeks ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, timing_max_weeks: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="例：4" style={miniInput} />
                    </div>
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>達標贈品內容</label>
                    <input value={editForm.bonus_desc ?? ''} onChange={e => setEditForm(f => ({ ...f, bonus_desc: e.target.value }))}
                      placeholder="例：B5熱導+頸部" style={miniInput} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b5f54', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editForm.include_in_accumulation} onChange={e => setEditForm(f => ({ ...f, include_in_accumulation: e.target.checked ? 1 : 0 }))} />
                    計入年度累積
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b5f54', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editForm.include_in_points} onChange={e => setEditForm(f => ({ ...f, include_in_points: e.target.checked ? 1 : 0 }))} />
                    計入金米
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingId(null)}
                    style={{ background: 'none', border: '1px solid #e0d9d0', color: '#9a8f84', fontSize: '0.78rem', padding: '5px 14px', borderRadius: '4px', cursor: 'pointer' }}>
                    取消
                  </button>
                  <button onClick={() => saveEdit(pkg)} disabled={saving}
                    style={{ background: saving ? '#c4b8aa' : '#2c2825', color: '#f7f4ef', border: 'none', fontSize: '0.78rem', padding: '5px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                    {saving ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </div>
            )}
        </div>
      )
  }   // end PkgCard

  return (
    <div className="space-y-2">
      {/* 進行中套組 */}
      {activePkgs.length === 0 && completedPkgs.length === 0 && (
        <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無套組</p>
      )}
      {activePkgs.length === 0 && completedPkgs.length > 0 && (
        <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '10px 0' }}>目前無進行中套組</p>
      )}
      {activePkgs.map(pkg => <PkgCard key={pkg.id} pkg={pkg} />)}

      {/* 歷史套組（已核銷完畢） */}
      {completedPkgs.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f0ede8', border: '1px solid #d9d0c5', borderRadius: '6px',
              padding: '8px 12px', cursor: 'pointer', color: '#6b5f54', fontSize: '0.78rem',
            }}>
            <span>歷史套組（已完成）</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{completedPkgs.length} 件</span>
              <span>{showHistory ? '▲' : '▼'}</span>
            </span>
          </button>
          {showHistory && (
            <div className="space-y-2" style={{ marginTop: '6px' }}>
              {completedPkgs.map(pkg => <PkgCard key={pkg.id} pkg={pkg} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Consumption Tab ─────────────────────────────────────────────────────────
function ConsumptionTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [deleting, setDeleting] = useState<number | null>(null)

  async function deleteCheckout(co: Checkout) {
    if (!confirm(`確定刪除 ${fmtShort(co.date)} 的消費記錄（${fmtAmt(co.total_amount)}）？\n商品券（套組）堂數將一併還原。`)) return
    setDeleting(co.id)
    await fetch(`/api/checkouts/${co.id}`, { method: 'DELETE' })
    setDeleting(null)
    refresh()
  }

  const currentYear = new Date().getFullYear().toString()

  // Aggregate stats from checkout history
  const allItems = client.checkouts.flatMap(co => co.items ?? [])
  const checkoutCourseAmt = allItems
    .filter(i => ['服務', '加購', '活動'].includes(i.category))
    .reduce((s, i) => s + i.price * i.qty, 0)
  // Add packages with include_in_accumulation (all time) — 用原價計算，讓利不影響客人累積
  const pkgAccumAmt = (client.packages ?? [])
    .filter(pkg => pkg.include_in_accumulation === 1)
    .reduce((s, pkg) => s + (pkg.unit_price_orig > 0 ? pkg.unit_price_orig * pkg.total_sessions : pkg.prepaid_amount), 0)
  // Add sv_ledger deposits with include_in_accumulation (all time)
  const svAccumAmt = (client.sv_ledger ?? [])
    .filter(e => e.include_in_accumulation === 1 && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0)
  const courseSpendig = checkoutCourseAmt + pkgAccumAmt + svAccumAmt
  const productSpending = allItems
    .filter(i => i.category === '產品')
    .reduce((s, i) => s + i.price * i.qty, 0)
  const visitCount = client.checkouts.length

  // Service & product frequency maps
  const serviceMap: Record<string, { count: number; amount: number }> = {}
  const productMap: Record<string, { count: number; amount: number }> = {}

  for (const co of client.checkouts) {
    for (const item of co.items) {
      const key = item.label
      const amt = item.price * item.qty
      if (['服務', '商品券', '加購', '活動'].includes(item.category)) {
        if (!serviceMap[key]) serviceMap[key] = { count: 0, amount: 0 }
        serviceMap[key].count += item.qty
        serviceMap[key].amount += amt
      } else if (item.category === '產品') {
        if (!productMap[key]) productMap[key] = { count: 0, amount: 0 }
        productMap[key].count += item.qty
        productMap[key].amount += amt
      }
    }
  }

  const topServices = Object.entries(serviceMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const topProducts = Object.entries(productMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: '課程累積', value: fmtAmt(courseSpendig), color: '#4a6b52' },
          { label: '保養品累積', value: fmtAmt(productSpending), color: '#5a4a6b' },
          { label: '到訪次數', value: `${visitCount} 次`, color: '#6b5f54' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ color, fontSize: '0.88rem', fontWeight: 500, marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Service preferences */}
      {topServices.length > 0 && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
          <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>常做課程</p>
          <div className="space-y-2">
            {topServices.map(([name, { count, amount }]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>{name}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{count} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product preferences */}
      {topProducts.length > 0 && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
          <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>常購產品</p>
          <div className="space-y-2">
            {topProducts.map(([name, { count, amount }]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>{name}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{count} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkout history */}
      <div>
        <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>消費明細</p>
        {client.checkouts.length === 0 ? (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無消費記錄</p>
        ) : (
          <div className="space-y-2">
            {client.checkouts.map(co => (
              <div key={co.id} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(co.date)}</span>
                      <span style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500 }}>{fmtAmt(co.total_amount)}</span>
                      {co.note && <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{co.note}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {co.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                          <span style={{ color: '#b4aa9e', minWidth: '44px' }}>{item.category}</span>
                          <span style={{ color: '#4a4642' }}>{item.label}</span>
                          {item.qty > 1 && <span style={{ color: '#9a8f84' }}>×{item.qty}</span>}
                          <span style={{ color: '#6b5f54', marginLeft: 'auto' }}>{fmtAmt(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {co.payments.map(pay => (
                        <span key={pay.id} style={{ fontSize: '0.68rem', color: '#9a8f84', background: '#f0ebe4', borderRadius: '10px', padding: '1px 7px' }}>
                          {pay.method} {fmtAmt(pay.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteCheckout(co)} disabled={deleting === co.id}
                    style={{ color: '#c4b8aa', fontSize: '0.68rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}>
                    {deleting === co.id ? '…' : '刪除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Service Log Tab ──────────────────────────────────────────────────────────
interface ServiceLog {
  id: number
  client_id: number
  date: string
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

function ServiceLogTab({ client }: { client: ClientDetail }) {
  const [logs, setLogs]           = useState<ServiceLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting]   = useState<number | null>(null)

  // New log form
  const [newDate, setNewDate]       = useState(todayStr())
  const [newTitle, setNewTitle]     = useState('')
  const [newContent, setNewContent] = useState('')

  // Edit form
  const [editDate, setEditDate]       = useState('')
  const [editTitle, setEditTitle]     = useState('')
  const [editContent, setEditContent] = useState('')

  function loadLogs() {
    fetch(`/api/clients/${client.id}/service-logs`)
      .then(r => r.json())
      .then((data: ServiceLog[]) => { setLogs(data); setLoading(false) })
  }
  useEffect(() => { loadLogs() }, [client.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitNew(e: React.FormEvent) {
    e.preventDefault()
    if (!newContent.trim()) return
    setSaving(true)
    await fetch(`/api/clients/${client.id}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, title: newTitle, content: newContent }),
    })
    setSaving(false)
    setShowForm(false)
    setNewTitle(''); setNewContent(''); setNewDate(todayStr())
    loadLogs()
  }

  function startEdit(log: ServiceLog) {
    setEditingId(log.id)
    setEditDate(log.date)
    setEditTitle(log.title ?? '')
    setEditContent(log.content)
  }

  async function saveEdit(id: number) {
    if (!editContent.trim()) return
    setSaving(true)
    await fetch(`/api/service-logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: editDate, title: editTitle, content: editContent }),
    })
    setSaving(false)
    setEditingId(null)
    loadLogs()
  }

  async function deleteLog(id: number) {
    if (!confirm('確定刪除這筆服務日誌？')) return
    setDeleting(id)
    await fetch(`/api/service-logs/${id}`, { method: 'DELETE' })
    setDeleting(null)
    loadLogs()
  }

  const slStyle: React.CSSProperties = {
    width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
    borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
    outline: 'none', padding: '9px 12px',
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null) }}
          style={{
            background: showForm ? '#f0ebe4' : '#2c2825',
            color: showForm ? '#6b5f54' : '#f7f4ef',
            border: 'none', borderRadius: '5px',
            fontSize: '0.8rem', padding: '6px 16px', cursor: 'pointer',
          }}>
          {showForm ? '取消' : '＋ 新增日誌'}
        </button>
      </div>

      {/* New log form */}
      {showForm && (
        <form onSubmit={submitNew}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
          className="space-y-3">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>新增服務日誌</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>日期</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={slStyle} />
            </div>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>標題（選填）</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="例：精細光彩 第3次" style={slStyle} />
            </div>
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>內容 *</label>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder="膚況、使用產品、特殊反應、下次注意事項…"
              rows={4}
              style={{ ...slStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving || !newContent.trim()}
              style={{
                flex: 1, background: saving || !newContent.trim() ? '#c4b8aa' : '#2c2825',
                color: '#f7f4ef', border: 'none', borderRadius: '5px',
                fontSize: '0.85rem', padding: '9px', cursor: 'pointer',
              }}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.85rem', padding: '9px 16px', cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </form>
      )}

      {/* Log list */}
      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '30px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>📋</div>
          <p style={{ fontSize: '0.85rem' }}>尚無服務日誌</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} style={{
              background: '#faf8f5', border: '1px solid #e0d9d0',
              borderLeft: '3px solid #c0a88a', borderRadius: '6px', padding: '12px 14px',
            }}>
              {editingId === log.id ? (
                /* ── 編輯模式 ── */
                <div className="space-y-3">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>日期</label>
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={slStyle} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>標題</label>
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="選填" style={slStyle} />
                    </div>
                  </div>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                    rows={4} style={{ ...slStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => saveEdit(log.id)} disabled={saving || !editContent.trim()}
                      style={{ flex: 1, background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '7px', cursor: 'pointer' }}>
                      {saving ? '儲存中…' : '儲存'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.82rem', padding: '7px 14px', cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 顯示模式 ── */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{fmtDate(log.date)}</span>
                        {log.title && (
                          <span style={{ color: '#2c2825', fontSize: '0.85rem', fontWeight: 500 }}>{log.title}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      <button onClick={() => startEdit(log)}
                        style={{ color: '#6b5f54', fontSize: '0.68rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>
                        編輯
                      </button>
                      <button onClick={() => deleteLog(log.id)} disabled={deleting === log.id}
                        style={{ color: '#c4a898', fontSize: '0.68rem', background: 'none', border: 'none', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer' }}>
                        {deleting === log.id ? '…' : '✕'}
                      </button>
                    </div>
                  </div>
                  <p style={{
                    color: '#4a4642', fontSize: '0.85rem', lineHeight: 1.7,
                    marginTop: '8px', whiteSpace: 'pre-wrap',
                  }}>
                    {log.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Client Tags Row ──────────────────────────────────────────────────────────
const TAG_COLORS = [
  '#9ab89e','#c0a88a','#8ab0c8','#c4a8d8',
  '#e0a8a8','#a8c4b0','#d4b840','#a89890',
  '#d49870','#8ab8b0','#e0b890','#b8a0c0',
]

interface Tag { id: number; name: string; color: string; client_count?: number }

function ClientTagsRow({ clientId }: { clientId: number }) {
  const [clientTags, setClientTags] = useState<Tag[]>([])
  const [allTags, setAllTags]       = useState<Tag[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newColor, setNewColor]     = useState(TAG_COLORS[0])
  const [creating, setCreating]     = useState(false)

  function loadClientTags() {
    fetch(`/api/clients/${clientId}/tags`).then(r => r.json()).then(setClientTags)
  }
  function loadAllTags() {
    fetch('/api/tags').then(r => r.json()).then(setAllTags)
  }
  useEffect(() => { loadClientTags(); loadAllTags() }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTag(tagId: number) {
    await fetch(`/api/clients/${clientId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    })
    loadClientTags()
  }

  async function removeTag(tagId: number) {
    await fetch(`/api/clients/${clientId}/tags/${tagId}`, { method: 'DELETE' })
    loadClientTags()
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    if (res.ok) {
      const { id } = await res.json()
      await addTag(id)
      loadAllTags()
    }
    setCreating(false)
    setNewName(''); setNewColor(TAG_COLORS[0])
    setShowPicker(false)
  }

  const unattached = allTags.filter(t => !clientTags.some(ct => ct.id === t.id))

  return (
    <div style={{ marginTop: '8px', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {clientTags.map(tag => (
          <span key={tag.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: tag.color + '28', color: tag.color,
              border: `1px solid ${tag.color}70`,
              borderRadius: '12px', fontSize: '0.75rem', padding: '2px 8px 2px 10px',
              fontWeight: 500,
            }}>
            {tag.name}
            <button onClick={() => removeTag(tag.id)}
              style={{ background: 'none', border: 'none', color: tag.color, cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: '0 1px', opacity: 0.7 }}>
              ✕
            </button>
          </span>
        ))}

        {/* Add tag button */}
        <button onClick={() => setShowPicker(v => !v)}
          style={{
            background: 'none', border: '1px dashed #d9d0c5', borderRadius: '12px',
            color: '#9a8f84', fontSize: '0.72rem', padding: '2px 10px', cursor: 'pointer',
          }}>
          ＋ 標籤
        </button>
      </div>

      {/* Tag picker dropdown */}
      {showPicker && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 30, marginTop: '6px',
          background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px',
          padding: '12px', minWidth: '220px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {/* Existing tags */}
          {unattached.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: '#9a8f84', fontSize: '0.68rem', marginBottom: '6px' }}>選擇現有標籤</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {unattached.map(tag => (
                  <button key={tag.id} onClick={() => { addTag(tag.id); setShowPicker(false) }}
                    style={{
                      background: tag.color + '28', color: tag.color,
                      border: `1px solid ${tag.color}70`,
                      borderRadius: '12px', fontSize: '0.75rem', padding: '3px 10px',
                      cursor: 'pointer', fontWeight: 500,
                    }}>
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create new */}
          <form onSubmit={createAndAdd} className="space-y-2">
            <p style={{ color: '#9a8f84', fontSize: '0.68rem' }}>建立新標籤</p>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="標籤名稱…" autoFocus
              style={{ width: '100%', background: '#f5f2ee', border: '1px solid #e0d9d0', borderRadius: '5px', color: '#2c2825', fontSize: '0.82rem', padding: '6px 10px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {TAG_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: newColor === c ? '2px solid #2c2825' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" disabled={creating || !newName.trim()}
                style={{ flex: 1, background: creating || !newName.trim() ? '#c4b8aa' : '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px', cursor: 'pointer' }}>
                {creating ? '…' : '建立並加入'}
              </button>
              <button type="button" onClick={() => setShowPicker(false)}
                style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 10px', cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────
interface TimelineEntry {
  key: string
  type: 'checkout' | 'package' | 'session' | 'installment' | 'sv' | 'points' | 'shopping_credit' | 'service_log'
  date: string
  amount: number
  title: string
  subtitle: string | null
  note: string | null
  detail: string | null  // JSON
}

const TL_TYPE: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  checkout:        { icon: '🧾', color: '#2c2825', bg: '#faf8f5',  border: '#8a7a6e' },
  package:         { icon: '📦', color: '#4a6b52', bg: '#edf3eb',  border: '#9ab89e' },
  session:         { icon: '✓',  color: '#1a6b5a', bg: '#e6f5f0',  border: '#5ab89e' },
  installment:     { icon: '💴', color: '#7a5a00', bg: '#fdf5e0',  border: '#d4a830' },
  sv_pos:          { icon: '＋', color: '#2d4f9a', bg: '#e8f0fc',  border: '#9ab0e8' },
  sv_neg:          { icon: '－', color: '#7a3020', bg: '#fdf0f0',  border: '#e8a8a8' },
  points_pos:      { icon: '⭐', color: '#7a5a00', bg: '#fdf8e8',  border: '#d4a830' },
  points_neg:      { icon: '⭐', color: '#7a3020', bg: '#fdf0f0',  border: '#e8a8a8' },
  shopping_credit_pos: { icon: '🛍', color: '#3a6b7a', bg: '#e6f0f5', border: '#7ab0c8' },
  shopping_credit_neg: { icon: '🛍', color: '#7a3020', bg: '#fdf0f0', border: '#e8a8a8' },
  service_log:     { icon: '📋', color: '#6b5044', bg: '#faf3ee',  border: '#c0a88a' },
}

function tlKey(entry: TimelineEntry): string {
  if (entry.type === 'sv') return entry.amount >= 0 ? 'sv_pos' : 'sv_neg'
  if (entry.type === 'points') return entry.amount >= 0 ? 'points_pos' : 'points_neg'
  if (entry.type === 'shopping_credit') return entry.amount >= 0 ? 'shopping_credit_pos' : 'shopping_credit_neg'
  return entry.type
}

function TimelineTab({ client }: { client: ClientDetail }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clients/${client.id}/timeline`)
      .then(r => r.json())
      .then((data: TimelineEntry[]) => { setEntries(data); setLoading(false) })
  }, [client.id])

  if (loading) return (
    <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
  )
  if (entries.length === 0) return (
    <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>尚無任何紀錄</div>
  )

  // Group by date
  const grouped: Record<string, TimelineEntry[]> = {}
  for (const e of entries) {
    if (!grouped[e.date]) grouped[e.date] = []
    grouped[e.date].push(e)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-5">
      {sortedDates.map(date => (
        <div key={date}>
          {/* Date header */}
          <div style={{
            color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em',
            marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>{fmtDate(date)}</span>
            <div style={{ flex: 1, height: '1px', background: '#e0d9d0' }} />
          </div>

          <div className="space-y-2">
            {grouped[date].map(entry => {
              const cfg = TL_TYPE[tlKey(entry)]
              let detail: { items?: { cat: string; label: string; price: number; qty: number }[]; pays?: { method: string; amount: number }[]; payment_method?: string } | null = null
              try { if (entry.detail) detail = JSON.parse(entry.detail) } catch { /* ignore */ }

              return (
                <div key={entry.key} style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderLeft: `3px solid ${cfg.border}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem' }}>{cfg.icon}</span>
                        <span style={{ color: cfg.color, fontWeight: 500, fontSize: '0.85rem' }}>{entry.title}</span>
                        {entry.subtitle && (
                          <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>　{entry.subtitle}</span>
                        )}
                      </div>

                      {/* Checkout items detail */}
                      {entry.type === 'checkout' && detail?.items && detail.items.length > 0 && (
                        <div style={{ marginTop: '6px', paddingLeft: '20px' }} className="space-y-0.5">
                          {detail.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '0.72rem' }}>
                              <span style={{ color: '#b4aa9e', minWidth: '36px' }}>{item.cat}</span>
                              <span style={{ color: '#4a4642' }}>{item.label}</span>
                              {item.qty > 1 && <span style={{ color: '#9a8f84' }}>×{item.qty}</span>}
                              <span style={{ color: '#6b5f54', marginLeft: 'auto' }}>
                                {fmtAmt(item.price * item.qty)}
                              </span>
                            </div>
                          ))}
                          {detail.pays && detail.pays.length > 0 && (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {detail.pays.map((p, i) => (
                                <span key={i} style={{ fontSize: '0.68rem', color: '#9a8f84', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '1px 7px' }}>
                                  {p.method} {fmtAmt(p.amount)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Package payment method */}
                      {entry.type === 'package' && detail?.payment_method && (
                        <div style={{ fontSize: '0.72rem', color: '#9a8f84', marginTop: '3px', paddingLeft: '20px' }}>
                          {detail.payment_method}
                        </div>
                      )}

                      {/* Service log content */}
                      {entry.type === 'service_log' && entry.note && (
                        <p style={{
                          color: '#4a4642', fontSize: '0.78rem', lineHeight: 1.65,
                          marginTop: '6px', paddingLeft: '20px',
                          whiteSpace: 'pre-wrap',
                          display: '-webkit-box', WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {entry.note}
                        </p>
                      )}

                      {/* Note (non service_log) */}
                      {entry.type !== 'service_log' && entry.note && (
                        <div style={{ fontSize: '0.72rem', color: '#9a8f84', marginTop: '3px', paddingLeft: '20px' }}>
                          {entry.note}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    {entry.type !== 'session' && entry.amount !== 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
                        {entry.type === 'points' ? (
                          <span style={{ color: cfg.color, fontSize: '0.9rem', fontWeight: 600 }}>
                            {entry.amount >= 0 ? '+' : ''}{entry.amount} 點
                          </span>
                        ) : (
                          <span style={{ color: cfg.color, fontSize: '0.9rem', fontWeight: 600 }}>
                            {['sv', 'shopping_credit'].includes(entry.type) && entry.amount >= 0 ? '+' : ''}
                            {fmtAmt(entry.amount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = '時間軸' | '服務日誌' | '分期' | '福利' | '套組' | '儲值' | '消費紀錄'
const TABS: Tab[] = ['時間軸', '服務日誌', '分期', '福利', '套組', '儲值', '消費紀錄']

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('時間軸')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, { cache: 'no-store' })
      if (!res.ok) { router.push('/clients'); return }
      setClient(await res.json())
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function deleteClient() {
    if (!confirm(`確定要刪除「${client?.name}」？此操作無法復原。`)) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    router.push('/clients')
  }

  if (loading) return <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
  if (!client) return null

  const level = (client.level || '癒米') as MembershipLevel
  const lc = LEVEL_COLOR[level] ?? LEVEL_COLOR['癒米']
  const isPendingUpgrade = !!(client.level_since && client.level_since > todayStr())
  const effectiveLevel: MembershipLevel = isPendingUpgrade ? '癒米' : level

  // Annual course spending for upgrade progress (current year)
  const currentYear = new Date().getFullYear().toString()
  // 商品券 excluded from checkouts — already counted at package purchase time
  const checkoutCourseSpending = client.checkouts
    .filter(co => co.incl_course && co.date.startsWith(currentYear))
    .flatMap(co => co.items ?? [])
    .filter(item => ['服務', '加購', '活動'].includes(item.category))
    .reduce((s, item) => s + item.price * item.qty, 0)
  // Packages with include_in_accumulation purchased this year — 用原價計算，讓利不影響客人累積
  const pkgCourseSpending = (client.packages ?? [])
    .filter(pkg => pkg.include_in_accumulation === 1 && pkg.date.startsWith(currentYear))
    .reduce((s, pkg) => s + (pkg.unit_price_orig > 0 ? pkg.unit_price_orig * pkg.total_sessions : pkg.prepaid_amount), 0)
  // sv_ledger deposits with include_in_accumulation this year
  const svCourseSpending = (client.sv_ledger ?? [])
    .filter(e => e.include_in_accumulation === 1 && e.amount > 0 && e.date.startsWith(currentYear))
    .reduce((s, e) => s + e.amount, 0)
  const annualCourseSpending = checkoutCourseSpending + pkgCourseSpending + svCourseSpending

  const nextLevel = NEXT_LEVEL[effectiveLevel]
  const nextThreshold = nextLevel ? LEVEL_THRESHOLDS[nextLevel] : null
  const upgradeGap = nextThreshold ? Math.max(0, nextThreshold - annualCourseSpending) : 0
  const upgradePct = nextThreshold ? Math.min(100, Math.round((annualCourseSpending / nextThreshold) * 100)) : 100

  // 悟癒米：顯示甜癒米門檻的年度累積進度（明年年費基準）
  const renewThreshold = LEVEL_THRESHOLDS['甜癒米']  // 38,000
  const renewPct = Math.min(100, Math.round((annualCourseSpending / renewThreshold) * 100))
  const renewGap = Math.max(0, renewThreshold - annualCourseSpending)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pt-2">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/clients" style={{ color: '#9a8f84', fontSize: '0.82rem' }}>← 客人</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <h1 style={{ color: '#2c2825', fontSize: '1.4rem', fontWeight: 500 }}>{client.name}</h1>
              {client.level && (() => {
                const isPending = !!(client.level_since && client.level_since > todayStr())
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ opacity: isPending ? 0.4 : 1 }}><MembershipBadge tier={level} /></span>
                    {isPending && (
                      <span style={{ fontSize: '0.68rem', color: '#b4aa9e', background: '#f0ede8', border: '1px solid #ddd8d0', borderRadius: '4px', padding: '1px 6px' }}>
                        待升等 {client.level_since}
                      </span>
                    )}
                  </span>
                )
              })()}
            </div>
            {client.phone && <div style={{ color: '#9a8f84', fontSize: '0.82rem', marginTop: '2px' }}>{client.phone}</div>}
            {client.note && <div style={{ color: '#6b5f54', fontSize: '0.8rem', marginTop: '4px' }}>{client.note}</div>}
            {client.birthday && <div style={{ color: '#b4aa9e', fontSize: '0.75rem', marginTop: '2px' }}>🎂 {client.birthday.replace('-', '月').replace(/(\d+)$/, '$1日')}</div>}
          </div>
          <Link href={`/clients/${id}/edit`} style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '28px' }}>編輯</Link>
        </div>

        {/* Tags */}
        <ClientTagsRow clientId={Number(id)} />

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '14px' }}>
          {[
            { label: '金米', value: `$ ${client.points.toLocaleString()}`, color: '#7a5a00', bg: '#fdf5e0', border: '#e0c055' },
            { label: '儲值', value: fmtAmt(client.stored_value), color: '#2d4f9a', bg: '#e8f0fc', border: '#9ab0e8' },
            { label: '購物金', value: fmtAmt(client.shopping_credit ?? 0), color: '#4a6b52', bg: '#edf3eb', border: '#9ab89e' },
            { label: '分期中', value: `${client.active_contracts} 件`, color: '#9a6a4a', bg: '#fdf0e6', border: '#e8cba8' },
            { label: '套組', value: `${client.active_packages} 件`, color: '#4a6b52', bg: '#edf3eb', border: '#9ab89e' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '5px', padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ color, fontSize: '0.82rem', marginTop: '2px', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Upgrade progress */}
        {nextLevel ? (
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px 12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                升等進度　{effectiveLevel} → {nextLevel}
              </span>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
                {fmtAmt(annualCourseSpending)} / {fmtAmt(nextThreshold!)}
              </span>
            </div>
            <div style={{ background: '#e0d9d0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                background: upgradePct >= 100 ? '#9ab89e' : lc.border,
                width: `${upgradePct}%`, height: '100%', borderRadius: '4px',
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ marginTop: '4px', color: '#9a8f84', fontSize: '0.68rem' }}>
              {upgradeGap > 0
                ? `還差 ${fmtAmt(upgradeGap)} 可升 ${nextLevel}`
                : `已達 ${nextLevel} 門檻`}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fdf5e0', border: '1px solid #e0c055', borderRadius: '6px', padding: '10px 12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: '#7a5a00', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                悟癒米　年度累積進度
              </span>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
                {fmtAmt(annualCourseSpending)} / {fmtAmt(renewThreshold)}
              </span>
            </div>
            <div style={{ background: '#e8d89e', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                background: renewPct >= 100 ? '#c8a000' : '#e0c055',
                width: `${renewPct}%`, height: '100%', borderRadius: '4px',
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ marginTop: '4px', color: '#9a8f84', fontSize: '0.68rem' }}>
              {renewGap > 0
                ? `還差 ${fmtAmt(renewGap)} 達甜癒米門檻（明年年費基準）`
                : '✓ 已達甜癒米門檻，明年年費有保障'}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0d9d0', overflowX: 'auto' }}>
        {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {tab === '時間軸'   && <TimelineTab client={client} />}
      {tab === '服務日誌' && <ServiceLogTab client={client} />}
      {tab === '分期' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#9a8f84', fontSize: '0.78rem' }}>分期合約 {client.contracts.length} 件</span>
            <Link href={`/installments/new?client_id=${id}`}
              style={{ color: '#2c2825', fontSize: '0.78rem', background: '#f0ebe4', border: '1px solid #d9d0c5', borderRadius: '4px' }}
              className="px-3 py-1.5">＋ 新增合約</Link>
          </div>
          {client.contracts.length === 0
            ? <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無分期合約</p>
            : client.contracts.map(c => <ContractCard key={c.id} contract={c} onChange={load} />)}
        </div>
      )}

      {tab === '福利' && <BenefitsTab client={client} refresh={load} />}
      {tab === '套組' && <PackagesTab client={client} refresh={load} />}
      {tab === '儲值' && <StoredValueTab client={client} refresh={load} />}
      {tab === '消費紀錄' && <ConsumptionTab client={client} refresh={load} />}

      {/* Delete */}
      <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '16px', marginTop: '8px' }}>
        <button onClick={deleteClient} style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>刪除此客人</button>
      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
  outline: 'none', padding: '9px 12px',
}
const miniInput: React.CSSProperties = {
  background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '5px', color: '#2c2825', fontSize: '0.82rem',
  outline: 'none', padding: '6px 10px',
}
const miniBtn: React.CSSProperties = {
  background: '#2c2825', color: '#f7f4ef', border: 'none',
  borderRadius: '5px', fontSize: '0.82rem', padding: '6px 14px', cursor: 'pointer',
}

function BenefitSection({ label, children, color = '#6b5f54', bg = '#faf8f5', border = '#e0d9d0' }: {
  label: string; children: React.ReactNode
  color?: string; bg?: string; border?: string
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '14px' }}>
      <p style={{ color, fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 500 }}>{label}</p>
      {children}
    </div>
  )
}
