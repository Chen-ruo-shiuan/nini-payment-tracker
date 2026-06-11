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
  bonus_desc?: string | null; timing_note?: string | null; bonus_active?: number
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
interface ReferredClient {
  id: number; name: string; phone: string | null; level: string; created_at: string
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
  referred_by_name: string | null
  referred_clients: ReferredClient[]
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
            {/* 增加 / 扣除 模式切換 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {([['add', '➕ 增加點數'] , ['sub', '➖ 扣除點數']] as const).map(([mode, label]) => {
                const isAdd = mode === 'add'
                const active = isAdd ? Number(ptDelta) >= 0 : Number(ptDelta) < 0
                return (
                  <button key={mode} type="button"
                    onClick={() => {
                      const abs = Math.abs(Number(ptDelta)) || 0
                      setPtDelta(isAdd ? String(abs || '') : abs ? '-' + abs : '-1')
                    }}
                    style={{
                      flex: 1, padding: '7px 0', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                      background: active ? (isAdd ? '#7a5a00' : '#9a4a4a') : '#e0d9d0',
                      color: active ? '#fff' : '#6b5f54',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>點數</label>
                <input value={ptDelta} onChange={e => setPtDelta(e.target.value)}
                  type="number" style={miniInput} placeholder="例：50" />
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
              <button type="submit" disabled={ptLoading || !ptDelta || ptDelta === '-'} style={{
                background: ptLoading || !ptDelta || ptDelta === '-' ? '#c4b8aa' : Number(ptDelta) < 0 ? '#9a4a4a' : '#7a5a00',
                color: '#f7f4ef', border: 'none', borderRadius: '4px', fontSize: '0.78rem', padding: '6px 16px', cursor: 'pointer', flex: 1,
              }}>{ptLoading ? '儲存中…' : Number(ptDelta) < 0 ? `扣除 ${Math.abs(Number(ptDelta))} 點` : `新增 ${Number(ptDelta) || 0} 點`}</button>
              <button type="button" onClick={() => { setShowPtForm(false); setPtDelta('') }} style={{
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
      extension_count: pkg.extension_count ?? 0,
      expiry_date: pkg.expiry_date ?? '',
      opened_date: pkg.opened_date ?? '',
      completion_bonus_desc:    pkg.completion_bonus_desc    ?? '',
      completion_weeks:         pkg.completion_weeks         ?? undefined,
      completion_bonus_service: pkg.completion_bonus_service ?? '',
      completion_bonus_price:   pkg.completion_bonus_price   ?? undefined,
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

  function pkgHealth(
    total: number, used: number,
    openedDate: string | null,
    purchaseDate?: string, expiryDate?: string | null,
  ): 'blue' | 'green' | 'yellow' | 'red' | null {
    if (total <= 0 || used >= total) return null
    if (!openedDate) return 'blue'
    if (expiryDate && purchaseDate) {
      const now   = Date.now()
      const start = new Date(purchaseDate + 'T00:00:00').getTime()
      const end   = new Date(expiryDate   + 'T00:00:00').getTime()
      const totalMs = end - start
      if (totalMs <= 0) return 'red'
      if (now >= end) return 'red'
      const timeLeft    = (end - now) / totalMs
      const sessionLeft = (total - used) / total
      const gap = sessionLeft - timeLeft
      if (gap <= 0)    return 'green'
      if (gap <= 0.20) return 'yellow'
      return 'red'
    }
    const ratio = (total - used) / total
    if (ratio <= 1 / 3) return 'green'
    if (ratio <= 2 / 3) return 'yellow'
    return 'red'
  }
  const PKG_HEALTH_STYLE = {
    blue:   { emoji: '🔵', color: '#2d5f9a', bg: '#e8f0fc', border: '#90b0e0' },
    green:  { emoji: '🟢', color: '#3a7a42', bg: '#edf3eb', border: '#7ab884' },
    yellow: { emoji: '🟡', color: '#8a6a00', bg: '#fdf8e0', border: '#c8a832' },
    red:    { emoji: '🔴', color: '#9a3a3a', bg: '#fdf0f0', border: '#e89898' },
  }

  function renderPkgCard(pkg: Package) {
    const remaining = pkg.total_sessions - pkg.used_sessions
    const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
    const isDone    = remaining <= 0
    const health = pkgHealth(pkg.total_sessions, pkg.used_sessions, pkg.opened_date, pkg.date, pkg.expiry_date)
    const isEditing = editingId === pkg.id

    // 任務倒數計算（含展延）— 從最後一次施作日開始算，尚未施作時不顯示截止
    const lastDate = pkg.last_session_date  // null = 尚未施作
    const hasTask = !isDone && !!pkg.bonus_desc && !!pkg.timing_max_weeks && !!pkg.bonus_active && !!lastDate
    const effectiveMaxWeeks = (pkg.timing_max_weeks ?? 0) + (pkg.extension_count ?? 0)
    const deadlineDays = hasTask && lastDate && effectiveMaxWeeks
      ? Math.round((new Date(lastDate).getTime() + effectiveMaxWeeks * 7 * 86400000 - Date.now()) / 86400000)
      : null
    const taskColor = deadlineDays === null ? '' : deadlineDays < 0 ? '#9a4a4a' : deadlineDays <= 7 ? '#9a6a2a' : '#4a6b52'
    const taskBg    = deadlineDays === null ? '' : deadlineDays < 0 ? '#fdf0f0' : deadlineDays <= 7 ? '#fdf5e8' : '#edf3eb'

    // 建議使用期限
    const expiryDays = pkg.expiry_date
      ? Math.round((new Date(pkg.expiry_date + 'T00:00:00').getTime() - Date.now()) / 86400000)
      : null

    // 完成鼓勵計算
    // 達標條件：已完成全部堂數（逾期仍可手動領取，老闆決定）
    const hasCompletionBonus = (!!pkg.completion_bonus_service || !!pkg.completion_bonus_desc) && !!pkg.completion_weeks
    const completionDays = (hasCompletionBonus && isDone && !!pkg.opened_date && !!pkg.last_session_date)
      ? Math.round((new Date(pkg.last_session_date).getTime() - new Date(pkg.opened_date).getTime()) / 86400000)
      : null
    const completionOnTime = completionDays !== null && completionDays <= (pkg.completion_weeks! * 7)
    // 只要 isDone + 有設定完成鼓勵，就算「達標」（可領取），逾期只用顏色區分
    const completionAchieved = hasCompletionBonus && isDone
    // 進行中：尚未完成但有開封日，計算剩餘期限
    const completionDeadlineDays = hasCompletionBonus && !isDone && pkg.opened_date
      ? Math.round((new Date(pkg.opened_date).getTime() + pkg.completion_weeks! * 7 * 86400000 - Date.now()) / 86400000)
      : null

    return (
      <div style={{
        background: isDone ? '#f5f2ee' : '#faf8f5',
        border: `1px solid ${isDone ? '#d9d0c5' : '#e0d9d0'}`,
        borderLeft: !isDone && health ? `4px solid ${PKG_HEALTH_STYLE[health].border}` : undefined,
        borderRadius: '6px', padding: '12px',
      }}>
            {!isEditing ? (
              <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{pkg.service_name}</div>
                  <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
                    購買 {fmtShort(pkg.date)}
                    {pkg.opened_date
                      ? <span style={{ marginLeft: '8px', color: '#7a6a9a' }}>開封 {fmtShort(pkg.opened_date)}</span>
                      : <span style={{ marginLeft: '8px', color: '#c4b8aa' }}>未開封</span>
                    }
                    　{pkg.payment_method}
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
                  <div style={{
                    color: !isDone && health ? PKG_HEALTH_STYLE[health].color : (remaining > 0 ? '#4a6b52' : '#9a8f84'),
                    fontSize: '0.9rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {!isDone && health && <span style={{ fontSize: '0.8rem' }}>{PKG_HEALTH_STYLE[health].emoji}</span>}
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
              {(pkg.bonus_desc || pkg.expiry_date) && !isDone && (
                <div style={{ marginTop: '10px', borderTop: '1px solid #e8e2db', paddingTop: '8px' }}>

                  {/* 達標任務 */}
                  {pkg.bonus_desc && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: pkg.expiry_date ? '6px' : 0 }}>
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
                              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.68rem', background: taskBg, color: taskColor, border: `1px solid ${taskColor}55`, borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
                                  {deadlineDays < 0
                                    ? `⚠ 已逾期 ${Math.abs(deadlineDays)} 天`
                                    : deadlineDays === 0 ? '⚡ 今天截止！'
                                    : `截止還有 ${deadlineDays} 天`}
                                </span>
                                {lastDate && (
                                  <span style={{ fontSize: '0.65rem', color: '#b4aa9e' }}>
                                    上次 {fmtShort(lastDate)}
                                  </span>
                                )}
                                {(pkg.extension_count ?? 0) > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: '#7a6a9a', background: '#f0eef8', border: '1px solid #c4b8d8', borderRadius: '4px', padding: '1px 6px' }}>
                                    已展延 {pkg.extension_count}/2 次
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#b4aa9e' }}>🎁 達標任務已撤銷（{pkg.bonus_desc}）</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        {pkg.bonus_active && pkg.timing_max_weeks && (
                          <button
                            onClick={async () => {
                              const ext = pkg.extension_count ?? 0
                              if (ext >= 2) { alert('已達最大展延次數（2 次）'); return }
                              if (!confirm(`確定為「${pkg.service_name}」申請第 ${ext + 1} 次展延（+1 週）？`)) return
                              await fetch(`/api/packages/${pkg.id}`, {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...pkg, extension_count: ext + 1 }),
                              })
                              refresh()
                            }}
                            disabled={(pkg.extension_count ?? 0) >= 2}
                            style={{
                              fontSize: '0.65rem', background: 'none', cursor: (pkg.extension_count ?? 0) >= 2 ? 'not-allowed' : 'pointer',
                              color: (pkg.extension_count ?? 0) >= 2 ? '#c4b8aa' : '#7a6a9a',
                              border: `1px solid ${(pkg.extension_count ?? 0) >= 2 ? '#e0d9d0' : '#c4b8d8'}`,
                              borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap',
                            }}>
                            展延 {(pkg.extension_count ?? 0)}/2
                          </button>
                        )}
                        <button
                          onClick={() => toggleBonus(pkg)}
                          style={{
                            fontSize: '0.65rem', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                            color: pkg.bonus_active ? '#9a4a4a' : '#4a6b52',
                            border: `1px solid ${pkg.bonus_active ? '#e8a8a8' : '#9ab89e'}`,
                            borderRadius: '4px', padding: '2px 8px',
                          }}>
                          {pkg.bonus_active ? '撤銷任務' : '恢復任務'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 建議使用期限 */}
                  {pkg.expiry_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: pkg.bonus_desc ? '4px' : 0 }}>
                      <span style={{ fontSize: '0.68rem', color: '#9a8f84' }}>📅 建議使用期限</span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 500,
                        color: expiryDays !== null && expiryDays < 0 ? '#9a4a4a' : expiryDays !== null && expiryDays <= 30 ? '#9a6a2a' : '#6b5f54',
                      }}>
                        {new Date(pkg.expiry_date + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                        {expiryDays !== null && (
                          <span style={{ marginLeft: '4px', fontWeight: 400, color: expiryDays < 0 ? '#9a4a4a' : '#9a8f84', fontSize: '0.65rem' }}>
                            {expiryDays < 0 ? `（已過期 ${Math.abs(expiryDays)} 天）` : `（剩 ${expiryDays} 天）`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                </div>
              )}

              {/* 完成鼓勵 — 不受 isDone 限制，套組完成後才能領取 */}
              {hasCompletionBonus && (
                <div style={{ marginTop: '8px',
                  background: pkg.completion_claimed ? '#f0ede8' : completionAchieved ? (completionOnTime ? '#edf3eb' : '#fdf5e8') : '#faf5fe',
                  border: `1px solid ${pkg.completion_claimed ? '#d9d0c5' : completionAchieved ? (completionOnTime ? '#9ab89e' : '#e8c878') : '#d4b0e8'}`,
                  borderRadius: '6px', padding: '8px 10px' }}>
                  {completionAchieved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600,
                          color: pkg.completion_claimed ? '#9a8f84' : completionOnTime ? '#3a7a4a' : '#9a6a2a' }}>
                          {pkg.completion_claimed ? '✓ 完成鼓勵已領取' : completionOnTime ? '🎉 完成鼓勵達標！' : '✅ 全部完成（逾期）'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: pkg.completion_claimed ? '#b4aa9e' : completionOnTime ? '#4a6b52' : '#7a5a2a' }}>
                          {pkg.completion_bonus_service || pkg.completion_bonus_desc}
                        </span>
                        {!pkg.completion_claimed && completionDays !== null && (
                          <span style={{ fontSize: '0.68rem', color: completionOnTime ? '#6b8a6e' : '#9a6a2a' }}>
                            （{completionDays} 天完成 / 限{pkg.completion_weeks! * 7}天）
                          </span>
                        )}
                      </div>
                      {!pkg.completion_claimed && (
                        <button
                          onClick={async () => {
                            if (!confirm(`確定要為此客人領取「${pkg.completion_bonus_service}」附加課程嗎？`)) return
                            const res = await fetch(`/api/packages/${pkg.id}/claim-completion`, { method: 'POST' })
                            if (res.ok) { refresh() }
                            else { const d = await res.json(); alert(d.error || '領取失敗') }
                          }}
                          style={{ background: completionOnTime ? '#3a7a4a' : '#9a6a2a', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.72rem', padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>
                          一鍵領取
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#7a4a9a', fontWeight: 500 }}>🎯 完成鼓勵</span>
                        <span style={{ fontSize: '0.72rem', color: '#6b5f54' }}>{pkg.completion_bonus_service || pkg.completion_bonus_desc}</span>
                      </div>
                      {pkg.opened_date && completionDeadlineDays !== null && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#9a8f84' }}>
                            {pkg.completion_weeks} 週內完成全部 {pkg.total_sessions} 堂
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600,
                            color: completionDeadlineDays < 0 ? '#9a4a4a' : completionDeadlineDays <= 14 ? '#9a6a2a' : '#7a4a9a',
                            background: completionDeadlineDays < 0 ? '#fdf0f0' : completionDeadlineDays <= 14 ? '#fdf5e8' : '#f0ebf8',
                            border: `1px solid ${completionDeadlineDays < 0 ? '#e8a8a8' : completionDeadlineDays <= 14 ? '#e8c878' : '#c4a8d8'}`,
                            borderRadius: '4px', padding: '1px 7px',
                          }}>
                            {completionDeadlineDays < 0
                              ? `已逾期 ${Math.abs(completionDeadlineDays)} 天`
                              : `還有 ${completionDeadlineDays} 天截止`}
                          </span>
                        </div>
                      )}
                      {!pkg.opened_date && (
                        <div style={{ marginTop: '2px', fontSize: '0.65rem', color: '#b4aa9e' }}>開封後開始計算</div>
                      )}
                    </div>
                  )}
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
                    <PkgSelectOrInput
                      presets={PKG_BONUS_DESC_PRESETS}
                      value={editForm.bonus_desc ?? ''}
                      onChange={v => setEditForm(f => ({ ...f, bonus_desc: v }))}
                      placeholder="輸入自訂贈品說明"
                    />
                  </div>
                  <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>開封日期</label>
                      <input type="date" value={editForm.opened_date ?? ''} onChange={e => setEditForm(f => ({ ...f, opened_date: e.target.value }))} style={miniInput} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>建議使用期限</label>
                      <input type="date" value={editForm.expiry_date ?? ''} onChange={e => setEditForm(f => ({ ...f, expiry_date: e.target.value }))} style={miniInput} />
                    </div>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <span style={{ color: '#b4aa9e', fontSize: '0.65rem' }}>開封日：首次施作會自動填入；期限：購買日 +6 個月</span>
                  </div>
                </div>

                {/* 完成鼓勵設定 */}
                <div style={{ borderTop: '1px solid #e8e2db', paddingTop: '8px' }}>
                  <p style={{ color: '#7a4a9a', fontSize: '0.68rem', marginBottom: '6px', letterSpacing: '0.05em' }}>🎯 完成鼓勵（選填）</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>附加課程名稱（達標時自動建立）</label>
                      <PkgSelectOrInput
                        presets={PKG_COMPLETION_SERVICE_PRESETS}
                        value={editForm.completion_bonus_service ?? ''}
                        onChange={v => setEditForm(f => ({ ...f, completion_bonus_service: v }))}
                        placeholder="輸入自訂課程名稱"
                      />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>課程價值（記帳用）</label>
                      <PkgSelectOrInput
                        presets={PKG_COMPLETION_PRICE_PRESETS}
                        value={editForm.completion_bonus_price != null ? String(editForm.completion_bonus_price) : ''}
                        onChange={v => setEditForm(f => ({ ...f, completion_bonus_price: v ? Number(v) : undefined }))}
                        placeholder="輸入自訂金額"
                        type="number"
                      />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>完成期限（週）</label>
                      <input type="number" min="1" max="52" value={editForm.completion_weeks ?? ''} onChange={e => setEditForm(f => ({ ...f, completion_weeks: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="例：8（= 2個月）" style={miniInput} />
                    </div>
                    <div>
                      <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>說明文字（顯示用）</label>
                      <input value={editForm.completion_bonus_desc ?? ''} onChange={e => setEditForm(f => ({ ...f, completion_bonus_desc: e.target.value }))}
                        placeholder="例：附加泡光氧彗（梅）" style={miniInput} />
                    </div>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <span style={{ color: '#b4aa9e', fontSize: '0.65rem' }}>開封日起算，全部堂數在期限內完成即達標，可一鍵領取</span>
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
      {activePkgs.map(pkg => <div key={pkg.id}>{renderPkgCard(pkg)}</div>)}

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
              {completedPkgs.map(pkg => <div key={pkg.id}>{renderPkgCard(pkg)}</div>)}
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
                        <div key={item.id}>
                          <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                            <span style={{ color: '#b4aa9e', minWidth: '44px' }}>{item.category}</span>
                            <span style={{ color: '#4a4642' }}>{item.label}</span>
                            {item.qty > 1 && <span style={{ color: '#9a8f84' }}>×{item.qty}</span>}
                            <span style={{ color: '#6b5f54', marginLeft: 'auto' }}>{fmtAmt(item.price * item.qty)}</span>
                          </div>
                          {item.category === '商品券' && item.bonus_desc && item.bonus_active === 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', paddingLeft: '50px' }}>
                              <span style={{ fontSize: '0.68rem', color: '#7a3d8a', background: '#f5eaf8', border: '1px solid #d4b8e8', borderRadius: '4px', padding: '1px 7px' }}>
                                🎁 {item.bonus_desc}
                              </span>
                              {item.timing_note && (
                                <span style={{ fontSize: '0.65rem', color: '#9a8f84' }}>{item.timing_note}回訪</span>
                              )}
                            </div>
                          )}
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

// ─── Appointment Section ──────────────────────────────────────────────────────
interface ApptLog { id: number; client_id: number; date: string; time: string | null; note: string | null; created_at: string }

function AppointmentSection({ clientId }: { clientId: string }) {
  const [appts, setAppts] = useState<ApptLog[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newNote, setNewNote] = useState('')
  const [showPast, setShowPast] = useState(false)

  function load() {
    fetch(`/api/clients/${clientId}/appointments`).then(r => r.json()).then(setAppts)
  }
  useEffect(() => { load() }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const upcoming = appts.filter(a => a.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
  const past     = appts.filter(a => a.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))

  async function addAppt() {
    if (!newDate) return
    await fetch(`/api/clients/${clientId}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, time: newTime || null, note: newNote }),
    })
    setNewDate(''); setNewTime(''); setNewNote(''); setShowAdd(false)
    load()
  }

  async function delAppt(id: number) {
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    load()
  }

  function fmtAppt(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })
  }

  const daysUntil = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.06em' }}>📅 預約記錄</span>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ fontSize: '0.68rem', color: '#9a8f84', background: 'none', border: '1px dashed #c4b8aa', borderRadius: '10px', padding: '1px 10px', cursor: 'pointer' }}>
          ＋ 新增
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px', marginBottom: '8px' }} className="space-y-2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>日期 *</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ width: '100%', border: '1px solid #d9d0c5', borderRadius: '5px', padding: '5px 8px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>時段</label>
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                style={{ width: '100%', border: '1px solid #d9d0c5', borderRadius: '5px', padding: '5px 8px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="備註（選填）"
            style={{ width: '100%', border: '1px solid #d9d0c5', borderRadius: '5px', padding: '5px 8px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={addAppt} disabled={!newDate}
              style={{ flex: 1, background: newDate ? '#2c2825' : '#c4b8aa', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.78rem', padding: '6px', cursor: 'pointer' }}>
              確認新增
            </button>
            <button onClick={() => { setShowAdd(false); setNewDate(''); setNewTime(''); setNewNote('') }}
              style={{ background: 'none', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer', color: '#9a8f84' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <span style={{ color: '#c4b8aa', fontSize: '0.75rem' }}>尚無預約記錄</span>
      )}

      {/* Upcoming */}
      {upcoming.map(a => {
        const d = daysUntil(a.date)
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.78rem', fontWeight: 600,
              color: d === 0 ? '#c4622d' : d <= 3 ? '#9a4a4a' : '#4a6b52',
            }}>
              {fmtAppt(a.date)}
            </span>
            {a.time && <span style={{ fontSize: '0.72rem', color: '#6b5f54', fontVariantNumeric: 'tabular-nums' }}>{a.time}</span>}
            <span style={{
              fontSize: '0.65rem', background: d < 0 ? '#f5f2ee' : d === 0 ? '#fff3ed' : d <= 3 ? '#fdf0f0' : '#edf3eb',
              color: d === 0 ? '#c4622d' : d <= 3 ? '#9a4a4a' : '#4a6b52',
              border: `1px solid ${d === 0 ? '#e0a070' : d <= 3 ? '#e8a8a8' : '#9ab89e'}`,
              borderRadius: '4px', padding: '1px 6px',
            }}>
              {d === 0 ? '今天' : d > 0 ? `還有 ${d} 天` : `${Math.abs(d)} 天前`}
            </span>
            {a.note && <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{a.note}</span>}
            <button onClick={() => delAppt(a.id)}
              style={{ marginLeft: 'auto', color: '#c4b8aa', background: 'none', border: 'none', fontSize: '0.75rem', cursor: 'pointer', padding: '0 4px' }}>
              ✕
            </button>
          </div>
        )
      })}

      {/* Past */}
      {past.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <button onClick={() => setShowPast(v => !v)}
            style={{ color: '#b4aa9e', fontSize: '0.68rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {showPast ? '▲' : '▼'} 過去記錄 {past.length} 筆
          </button>
          {showPast && past.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9a8f84' }}>{fmtAppt(a.date)}</span>
              {a.note && <span style={{ color: '#b4aa9e', fontSize: '0.7rem' }}>{a.note}</span>}
              <button onClick={() => delAppt(a.id)}
                style={{ marginLeft: 'auto', color: '#c4b8aa', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = '時間軸' | '日誌' | '分期' | '福利' | '套組' | '儲值' | '消費紀錄' | '同意書' | '產品紀錄'
const TABS: Tab[] = ['時間軸', '日誌', '分期', '福利', '套組', '儲值', '消費紀錄', '同意書', '產品紀錄']

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
  // 進度條：只計算「目前等級門檻 → 下個等級門檻」的帶內進度
  const currentThreshold = LEVEL_THRESHOLDS[effectiveLevel]
  const bandSize = nextThreshold ? nextThreshold - currentThreshold : 1
  const bandProgress = Math.max(0, annualCourseSpending - currentThreshold)
  const upgradePct = nextThreshold ? Math.min(100, Math.round((bandProgress / bandSize) * 100)) : 100

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

        {/* ── 健康注意事項警示 ── */}
        {(client.allergy_note || client.medical_note || client.skin_note) && (
          <div style={{
            background: '#fdf8ee', border: '1px solid #e8c96a',
            borderLeft: '4px solid #c8940a',
            borderRadius: '6px', padding: '12px 14px', marginTop: '12px',
          }}>
            <p style={{ color: '#7a5a00', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '8px' }}>
              ⚠ 施作前請確認
            </p>
            <div className="space-y-2">
              {client.allergy_note && (
                <div>
                  <span style={{ color: '#9a6a00', fontSize: '0.68rem', fontWeight: 600 }}>過敏　</span>
                  <span style={{ color: '#6b5030', fontSize: '0.8rem' }}>{client.allergy_note}</span>
                </div>
              )}
              {client.medical_note && (
                <div>
                  <span style={{ color: '#9a6a00', fontSize: '0.68rem', fontWeight: 600 }}>健康　</span>
                  <span style={{ color: '#6b5030', fontSize: '0.8rem' }}>{client.medical_note}</span>
                </div>
              )}
              {client.skin_note && (
                <div>
                  <span style={{ color: '#9a6a00', fontSize: '0.68rem', fontWeight: 600 }}>皮膚　</span>
                  <span style={{ color: '#6b5030', fontSize: '0.8rem' }}>{client.skin_note}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 推薦人資訊 ── */}
        {(client.referral_source || client.referred_by_id || client.referred_clients?.length > 0) && (
          <div style={{
            background: '#eef4fb', border: '1px solid #9ab0e8',
            borderLeft: '4px solid #4a7ac8',
            borderRadius: '6px', padding: '10px 14px', marginTop: '10px',
          }}>
            <p style={{ color: '#2d4f9a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '8px' }}>
              🔗 介紹來源
            </p>
            <div className="space-y-1">
              {client.referral_source && (
                <div>
                  <span style={{ color: '#3a5a9a', fontSize: '0.72rem', fontWeight: 600 }}>來源　</span>
                  <span style={{ color: '#2c4070', fontSize: '0.82rem' }}>{client.referral_source}</span>
                </div>
              )}
              {client.referred_by_id && client.referred_by_name && (
                <div>
                  <span style={{ color: '#3a5a9a', fontSize: '0.72rem', fontWeight: 600 }}>介紹人　</span>
                  <Link href={`/clients/${client.referred_by_id}`}
                    style={{ color: '#2d4f9a', fontSize: '0.82rem', textDecoration: 'underline' }}>
                    {client.referred_by_name}
                  </Link>
                </div>
              )}
              {client.referred_clients?.length > 0 && (
                <div>
                  <span style={{ color: '#3a5a9a', fontSize: '0.72rem', fontWeight: 600 }}>
                    已介紹　{client.referred_clients.length} 人：
                  </span>
                  <span style={{ color: '#2c4070', fontSize: '0.82rem' }}>
                    {client.referred_clients.map((rc, i) => (
                      <span key={rc.id}>
                        {i > 0 && '、'}
                        <Link href={`/clients/${rc.id}`} style={{ color: '#2d4f9a', textDecoration: 'underline' }}>
                          {rc.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

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
                {fmtAmt(bandProgress)} / {fmtAmt(bandSize)}
              </span>
            </div>
            <div style={{ background: '#e0d9d0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                background: upgradePct >= 100 ? '#9ab89e' : lc.border,
                width: `${upgradePct}%`, height: '100%', borderRadius: '4px',
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.68rem' }}>
                {upgradeGap > 0
                  ? `還差 ${fmtAmt(upgradeGap)} 可升 ${nextLevel}`
                  : `已達 ${nextLevel} 門檻`}
              </span>
              <span style={{ color: '#b4aa9e', fontSize: '0.65rem' }}>
                年度累積 {fmtAmt(annualCourseSpending)}
              </span>
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
        <AppointmentSection clientId={id} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0d9d0', overflowX: 'auto' }}>
        {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {tab === '時間軸' && <TimelineTab client={client} />}
      {tab === '日誌' && (
        <div className="space-y-6">
          <ServiceLogTab client={client} />
          <div style={{ borderTop: '1px solid #e0d9d0', paddingTop: '16px' }}>
            <FollowUpTab clientId={client.id} clientName={client.name} />
          </div>
        </div>
      )}
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
      {tab === '同意書' && <DocumentsTab clientId={client.id} />}
      {tab === '產品紀錄' && <ProductUsageTab clientId={client.id} checkouts={client.checkouts} />}

      {/* Delete */}
      <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '16px', marginTop: '8px' }}>
        <button onClick={deleteClient} style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>刪除此客人</button>
      </div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
interface DocRow {
  id: number; client_id: number; original_name: string; doc_type: string
  note: string | null; file_size: number | null; signed_date: string | null; upload_date: string
}

const DOC_TYPES = ['課程同意書', '消費契約書', '特殊同意書', '其他'] as const
type DocType = typeof DOC_TYPES[number]

const DOC_TYPE_STYLE: Record<DocType, { bg: string; color: string; border: string; borderLeft: string }> = {
  '課程同意書': { bg: '#eef4fb', color: '#2d4f9a', border: '#9ab0e8', borderLeft: '#4a7ac8' },
  '消費契約書': { bg: '#edf3eb', color: '#3a7a42', border: '#7ab884', borderLeft: '#3a7a42' },
  '特殊同意書': { bg: '#fdf8ee', color: '#9a6a00', border: '#e0c055', borderLeft: '#c8940a' },
  '其他':       { bg: '#f7f4ef', color: '#6b5f54', border: '#c8c4be', borderLeft: '#9a8f84' },
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentsTab({ clientId }: { clientId: number }) {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [docType, setDocType] = useState<DocType>(DOC_TYPES[0])
  const [note, setNote] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [fileErr, setFileErr] = useState('')
  const inputRef = { current: null as HTMLInputElement | null }

  function loadDocs() {
    setLoading(true)
    fetch(`/api/clients/${clientId}/documents`)
      .then(r => r.json())
      .then(d => { setDocs(d); setLoading(false) })
  }
  useEffect(loadDocs, [clientId])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileErr('')
    if (file.size > 20 * 1024 * 1024) { setFileErr('檔案超過 20MB'); return }
    const form = new FormData()
    form.append('file', file)
    form.append('doc_type', docType)
    if (signedDate) form.append('signed_date', signedDate)
    if (note.trim()) form.append('note', note.trim())
    setUploading(true)
    const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: form })
    setUploading(false)
    if (res.ok) {
      setNote('')
      setSignedDate('')
      if (inputRef.current) inputRef.current.value = ''
      loadDocs()
    } else {
      const j = await res.json()
      setFileErr(j.error || '上傳失敗')
    }
  }

  async function deleteDoc(doc: DocRow) {
    if (!confirm(`確定刪除「${doc.original_name}」？此操作無法復原。`)) return
    setDeleting(doc.id)
    await fetch(`/api/documents/${doc.id}/file`, { method: 'DELETE' })
    setDeleting(null)
    loadDocs()
  }

  const iStyle: React.CSSProperties = {
    width: '100%', background: '#fff', border: '1px solid #e0d9d0',
    borderRadius: '5px', color: '#2c2825', fontSize: '0.85rem',
    outline: 'none', padding: '7px 10px',
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }}
        className="space-y-3">
        <p style={{ color: '#6b5f54', fontSize: '0.82rem', fontWeight: 500 }}>上傳同意書 / 文件</p>

        <div>
          <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '3px' }}>文件類型</label>
          <select value={docType} onChange={e => setDocType(e.target.value as DocType)} style={iStyle}>
            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '3px' }}>簽署日期（選填）</label>
            <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '3px' }}>備註（選填）</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="例：本人簽、家長代簽…" style={iStyle} />
          </div>
        </div>

        <div>
          <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '3px' }}>
            選擇檔案（PDF / JPG / PNG，上限 20MB）
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            ref={el => { inputRef.current = el }}
            onChange={upload}
            disabled={uploading}
            style={{
              width: '100%', fontSize: '0.82rem', color: '#6b5f54',
              padding: '6px 0', cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          />
          {uploading && <p style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '4px' }}>上傳中…</p>}
          {fileErr && <p style={{ color: '#9a4a4a', fontSize: '0.75rem', marginTop: '4px' }}>{fileErr}</p>}
        </div>
      </div>

      {/* Document list — grouped by category */}
      {loading ? (
        <p style={{ color: '#c4b8aa', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>載入中…</p>
      ) : docs.length === 0 ? (
        <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無上傳文件</p>
      ) : (
        <div className="space-y-5">
          {DOC_TYPES.map(cat => {
            const group = docs.filter(d => d.doc_type === cat)
            if (group.length === 0) return null
            const st = DOC_TYPE_STYLE[cat]
            return (
              <div key={cat}>
                {/* Category header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '8px',
                }}>
                  <div style={{ width: '3px', height: '14px', background: st.borderLeft, borderRadius: '2px' }} />
                  <span style={{ color: st.color, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>
                    {cat}
                  </span>
                  <span style={{ color: st.color, fontSize: '0.68rem', opacity: 0.7 }}>（{group.length}）</span>
                </div>
                <div className="space-y-2">
                  {group.map(doc => (
                    <div key={doc.id} style={{
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      borderLeft: `3px solid ${st.borderLeft}`,
                      borderRadius: '6px', padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#2c2825', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                            📄 {doc.original_name}
                          </div>
                          <div style={{ color: '#9a8f84', fontSize: '0.7rem', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {doc.signed_date && (
                              <span style={{ color: '#6b5f54' }}>
                                簽署 {new Date(doc.signed_date + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                              </span>
                            )}
                            {doc.file_size ? <span>{fmtSize(doc.file_size)}</span> : null}
                            {doc.note ? <span style={{ color: '#6b5f54' }}>{doc.note}</span> : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          <a
                            href={`/api/documents/${doc.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: st.color, fontSize: '0.72rem',
                              background: '#fff', border: `1px solid ${st.border}`,
                              borderRadius: '4px', padding: '3px 10px',
                              textDecoration: 'none', whiteSpace: 'nowrap',
                            }}>
                            開啟
                          </a>
                          <button
                            onClick={() => deleteDoc(doc)}
                            disabled={deleting === doc.id}
                            style={{
                              color: '#9a4a4a', fontSize: '0.72rem',
                              background: 'none', border: '1px solid #e8a8a8',
                              borderRadius: '4px', padding: '3px 10px',
                              cursor: deleting === doc.id ? 'not-allowed' : 'pointer',
                            }}>
                            {deleting === doc.id ? '…' : '刪除'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
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

// ─── Product Records Tab ─────────────────────────────────────────────────────
const PRODUCT_GROUPS = [
  { label: '原液', items: ['神經醯胺', 'EGF', '藍銅胜肽', '積雪草', 'B3菸鹼醯胺', 'B5泛醇', '穀胱甘肽', '維他命C', '兒茶素', '金縷梅', '膠原蛋白', '阿魏酸+C'] },
  { label: '純露', items: ['千葉玫瑰', '洋甘菊', '橙花', '桂花', '茶樹', '葡萄柚'] },
  { label: '面膜', items: ['晶凍面膜', '胜肽點滴面膜', '凍膜'] },
  { label: '其他', items: [] },
]

// flatten all known items for edit-mode lookup
const ALL_PRESET_ITEMS = PRODUCT_GROUPS.flatMap(g => g.items)

interface ProductLog {
  id: number; client_id: number; date: string
  product_name: string; category: string | null
  record_type: string; checkout_id: number | null
  checkout_date: string | null; checkout_total: number | null
  note: string | null; created_at: string
}

function ProductUsageTab({ clientId, checkouts }: { clientId: number; checkouts: Checkout[] }) {
  const [logs, setLogs] = useState<ProductLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const emptyForm = {
    date: today, record_type: '店內購買',
    product_name: '', custom_name: '', checkout_id: '', note: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editForm, setEditForm] = useState({ ...emptyForm })

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/product-logs`)
    setLogs(Array.isArray(await res.json()) ? await (await fetch(`/api/clients/${clientId}/product-logs`)).json() : [])
    setLoading(false)
  }

  useEffect(() => {
    fetch(`/api/clients/${clientId}/product-logs`)
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false) })
  }, [clientId])

  async function reloadLogs() {
    const d = await (await fetch(`/api/clients/${clientId}/product-logs`)).json()
    setLogs(Array.isArray(d) ? d : [])
  }

  // resolve product name from form
  function resolveName(f: typeof form) {
    return f.product_name === '__custom__' ? f.custom_name.trim() : f.product_name.trim()
  }
  // find which group a product belongs to
  function findCategory(name: string): string | null {
    const g = PRODUCT_GROUPS.find(g => g.items.includes(name))
    return g ? g.label : null
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = resolveName(form)
    if (!name) { setFormError('請填寫產品名稱'); return }
    setSaving(true); setFormError('')
    const res = await fetch(`/api/clients/${clientId}/product-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date, product_name: name,
        category: findCategory(name),
        record_type: form.record_type,
        checkout_id: form.checkout_id ? Number(form.checkout_id) : null,
        note: form.note || null,
      }),
    })
    if (res.ok) { setForm(emptyForm); await reloadLogs() }
    else { const d = await res.json(); setFormError(d.error || '發生錯誤') }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('確定要刪除此筆記錄？')) return
    await fetch(`/api/product-logs/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  function startEdit(log: ProductLog) {
    const isCustom = !ALL_PRESET_ITEMS.includes(log.product_name)
    setEditForm({
      date: log.date,
      record_type: log.record_type || '店內購買',
      product_name: isCustom ? '__custom__' : log.product_name,
      custom_name: isCustom ? log.product_name : '',
      checkout_id: log.checkout_id ? String(log.checkout_id) : '',
      note: log.note || '',
    })
    setEditingId(log.id)
  }

  async function handleSaveEdit(id: number) {
    const name = resolveName(editForm)
    if (!name) return
    await fetch(`/api/product-logs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editForm.date, product_name: name,
        category: findCategory(name),
        record_type: editForm.record_type,
        checkout_id: editForm.checkout_id ? Number(editForm.checkout_id) : null,
        note: editForm.note || null,
      }),
    })
    setEditingId(null)
    await reloadLogs()
  }

  // Grouped by record_type for display
  const purchased = logs.filter(l => l.record_type === '店內購買')
  const selfUsed  = logs.filter(l => l.record_type === '自用')

  const sInput: React.CSSProperties = {
    background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '5px',
    color: '#2c2825', fontSize: '0.82rem', outline: 'none', padding: '6px 10px',
  }

  // Shared product select (optgroup)
  function ProductSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <>
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...sInput, width: '100%' }}>
          <option value="">— 選擇產品 —</option>
          {PRODUCT_GROUPS.map(g => (
            <optgroup key={g.label} label={`── ${g.label} ──`}>
              {g.items.map(item => <option key={item} value={item}>{item}</option>)}
              <option value={`__custom_${g.label}__`}>　✏ 自訂義（{g.label}）</option>
            </optgroup>
          ))}
        </select>
        {value.startsWith('__custom_') && (
          <input type="text" placeholder="輸入產品名稱"
            style={{ ...sInput, width: '100%', marginTop: '5px' }}
            onChange={e => onChange(e.target.value)} />
        )}
      </>
    )
  }

  // Log card
  function LogCard({ log }: { log: ProductLog }) {
    const isPurchased = log.record_type === '店內購買'
    const cardBg = isPurchased ? '#edf3eb' : '#f7f4ef'
    const cardBorder = isPurchased ? '#7ab884' : '#c8c4be'
    const cardBorderLeft = isPurchased ? '#3a7a42' : '#9a8f84'
    return (
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `3px solid ${cardBorderLeft}`, borderRadius: '6px', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500 }}>{log.product_name}</span>
            {log.category && <span style={{ color: isPurchased ? '#3a7a42' : '#9a8f84', fontSize: '0.68rem' }}>{log.category}</span>}
            <span style={{ color: '#b4aa9e', fontSize: '0.68rem' }}>{fmtShort(log.date)}</span>
          </div>
          {log.checkout_date && (
            <p style={{ color: '#4a7a52', fontSize: '0.72rem', marginTop: '2px' }}>
              🔗 連結結帳 {fmtShort(log.checkout_date)}（${(log.checkout_total || 0).toLocaleString()}）
            </p>
          )}
          {log.note && <p style={{ color: '#6b5f54', fontSize: '0.75rem', marginTop: '2px' }}>{log.note}</p>}
        </div>
        <div style={{ display: 'flex', gap: '5px', marginLeft: '8px', flexShrink: 0 }}>
          <button onClick={() => startEdit(log)}
            style={{ background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', color: '#9a8f84', fontSize: '0.68rem', padding: '3px 8px', cursor: 'pointer' }}>
            編輯
          </button>
          <button onClick={() => handleDelete(log.id)}
            style={{ background: 'none', border: '1px solid #e8a8a8', borderRadius: '4px', color: '#9a6060', fontSize: '0.68rem', padding: '3px 8px', cursor: 'pointer' }}>
            刪除
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Add form ── */}
      <form onSubmit={handleAdd} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
        <p style={{ color: '#6b5f54', fontSize: '0.82rem', fontWeight: 500, marginBottom: '12px' }}>新增產品記錄</p>
        <div className="space-y-3">

          {/* Record type toggle */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['店內購買', '自用'] as const).map(rt => (
              <button key={rt} type="button"
                onClick={() => setForm(p => ({ ...p, record_type: rt, checkout_id: '' }))}
                style={{
                  flex: 1, border: 'none', borderRadius: '6px', fontSize: '0.82rem', padding: '7px', cursor: 'pointer',
                  background: form.record_type === rt ? (rt === '店內購買' ? '#3a7a42' : '#6b5f54') : '#f0ece6',
                  color: form.record_type === rt ? '#fff' : '#6b5f54',
                }}>
                {rt === '店內購買' ? '🛍 店內購買' : '💊 自用（外部品牌）'}
              </button>
            ))}
          </div>

          {/* Date */}
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>日期</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              style={{ ...sInput, width: '100%' }} />
          </div>

          {/* Product name with optgroup */}
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>
              {form.record_type === '店內購買' ? '購買產品 *' : '自用產品 *'}
            </label>
            {form.record_type === '店內購買' ? (
              <>
                <select value={form.product_name}
                  onChange={e => setForm(p => ({ ...p, product_name: e.target.value, custom_name: '' }))}
                  style={{ ...sInput, width: '100%' }}>
                  <option value="">— 選擇產品 —</option>
                  {PRODUCT_GROUPS.map(g => (
                    <optgroup key={g.label} label={`── ${g.label} ──`}>
                      {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                      <option value={`__custom_${g.label}__`}>　✏ 自訂義（{g.label}）</option>
                    </optgroup>
                  ))}
                </select>
                {form.product_name.startsWith('__custom_') && (
                  <input type="text" value={form.custom_name}
                    onChange={e => setForm(p => ({ ...p, custom_name: e.target.value }))}
                    placeholder="輸入產品名稱" style={{ ...sInput, width: '100%', marginTop: '5px' }} />
                )}
              </>
            ) : (
              /* 自用：自由輸入外部品牌 */
              <input type="text" value={form.custom_name}
                onChange={e => setForm(p => ({ ...p, custom_name: e.target.value, product_name: '__custom__' }))}
                placeholder="EX：DR.WU 杏仁酸、適樂膚保濕乳液…"
                style={{ ...sInput, width: '100%' }} />
            )}
          </div>

          {/* Link to checkout (店內購買 only) */}
          {form.record_type === '店內購買' && checkouts.length > 0 && (
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>連結結帳紀錄（選填）</label>
              <select value={form.checkout_id} onChange={e => setForm(p => ({ ...p, checkout_id: e.target.value }))}
                style={{ ...sInput, width: '100%' }}>
                <option value="">— 不連結 —</option>
                {checkouts.slice(0, 20).map(co => (
                  <option key={co.id} value={co.id}>
                    {co.date}　${co.total_amount.toLocaleString()}
                    {co.note ? `　${co.note}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>
              {form.record_type === '店內購買' ? '備註' : '備註（用法、感受…）'}
            </label>
            <textarea value={form.note} rows={2}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder={form.record_type === '自用' ? 'EX：每晚使用、皮膚有改善…' : ''}
              style={{ ...sInput, width: '100%', resize: 'none' }} />
          </div>
        </div>

        {formError && <p style={{ color: '#9a4a4a', fontSize: '0.82rem', marginTop: '8px' }}>{formError}</p>}
        <button type="submit" disabled={saving}
          style={{ marginTop: '12px', width: '100%', background: saving ? '#c4b8aa' : '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.88rem', padding: '10px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '儲存中…' : '新增記錄'}
        </button>
      </form>

      {/* ── Log list ── */}
      {loading ? (
        <p style={{ color: '#9a8f84', textAlign: 'center', padding: '20px 0' }}>載入中…</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#b4aa9e', textAlign: 'center', padding: '20px 0', fontSize: '0.85rem' }}>尚無產品紀錄</p>
      ) : (
        <div className="space-y-5">

          {/* 店內購買 section */}
          {purchased.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '3px', height: '14px', background: '#3a7a42', borderRadius: '2px' }} />
                <span style={{ color: '#3a7a42', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>店內購買</span>
                <span style={{ color: '#3a7a42', fontSize: '0.68rem', opacity: 0.7 }}>（{purchased.length}）</span>
              </div>
              <div className="space-y-2">
                {purchased.map(log => (
                  editingId === log.id
                    ? <EditLogRow key={log.id} log={log} checkouts={checkouts} editForm={editForm} setEditForm={setEditForm} onSave={() => handleSaveEdit(log.id)} onCancel={() => setEditingId(null)} sInput={sInput} />
                    : <LogCard key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}

          {/* 自用 section */}
          {selfUsed.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '3px', height: '14px', background: '#9a8f84', borderRadius: '2px' }} />
                <span style={{ color: '#6b5f54', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>自用產品（外部）</span>
                <span style={{ color: '#9a8f84', fontSize: '0.68rem', opacity: 0.7 }}>（{selfUsed.length}）</span>
              </div>
              <div className="space-y-2">
                {selfUsed.map(log => (
                  editingId === log.id
                    ? <EditLogRow key={log.id} log={log} checkouts={checkouts} editForm={editForm} setEditForm={setEditForm} onSave={() => handleSaveEdit(log.id)} onCancel={() => setEditingId(null)} sInput={sInput} />
                    : <LogCard key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EditLogRow({ log, checkouts, editForm, setEditForm, onSave, onCancel, sInput }: {
  log: ProductLog
  checkouts: Checkout[]
  editForm: { date: string; record_type: string; product_name: string; custom_name: string; checkout_id: string; note: string }
  setEditForm: React.Dispatch<React.SetStateAction<typeof editForm>>
  onSave: () => void
  onCancel: () => void
  sInput: React.CSSProperties
}) {
  const isCustom = editForm.product_name === '__custom__' || editForm.product_name.startsWith('__custom_')
  return (
    <div style={{ background: '#fff9f0', border: '1px solid #e8c96a', borderRadius: '6px', padding: '12px' }}>
      <div className="space-y-2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>日期</label>
            <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.78rem' }} />
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>類型</label>
            <select value={editForm.record_type} onChange={e => setEditForm(p => ({ ...p, record_type: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.78rem' }}>
              <option value="店內購買">店內購買</option>
              <option value="自用">自用</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>產品名稱</label>
          {editForm.record_type === '店內購買' ? (
            <>
              <select value={editForm.product_name} onChange={e => setEditForm(p => ({ ...p, product_name: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.78rem' }}>
                {PRODUCT_GROUPS.map(g => (
                  <optgroup key={g.label} label={`── ${g.label} ──`}>
                    {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                    <option value={`__custom_${g.label}__`}>　✏ 自訂義（{g.label}）</option>
                  </optgroup>
                ))}
              </select>
              {isCustom && <input type="text" value={editForm.custom_name} onChange={e => setEditForm(p => ({ ...p, custom_name: e.target.value }))} style={{ ...sInput, width: '100%', marginTop: '4px', fontSize: '0.78rem' }} />}
            </>
          ) : (
            <input type="text" value={isCustom ? editForm.custom_name : editForm.product_name}
              onChange={e => setEditForm(p => ({ ...p, product_name: '__custom__', custom_name: e.target.value }))}
              style={{ ...sInput, width: '100%', fontSize: '0.78rem' }} />
          )}
        </div>
        {editForm.record_type === '店內購買' && checkouts.length > 0 && (
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>連結結帳</label>
            <select value={editForm.checkout_id} onChange={e => setEditForm(p => ({ ...p, checkout_id: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.78rem' }}>
              <option value="">— 不連結 —</option>
              {checkouts.slice(0, 20).map(co => (
                <option key={co.id} value={co.id}>{co.date}　${co.total_amount.toLocaleString()}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>備註</label>
          <textarea value={editForm.note} rows={2} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))} style={{ ...sInput, width: '100%', resize: 'none', fontSize: '0.78rem' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={onSave} style={{ flex: 1, background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>儲存</button>
        <button onClick={onCancel} style={{ flex: 1, background: '#e0d9d0', color: '#6b5f54', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>取消</button>
      </div>
    </div>
  )
}

// ─── Follow-Up Tab ────────────────────────────────────────────────────────────
interface FollowUp {
  id: number; client_id: number; checkout_id: number | null; due_date: string
  contacted: number; client_feedback: string | null; skin_status: string | null
  follow_up_action: string | null; note: string | null; completed_at: string | null; created_at: string
}

const FOLLOW_UP_DAYS = [1, 2, 3, 5, 7, 14]

function FollowUpTab({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [tasks, setTasks] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const defaultDue = (() => {
    const d = new Date(); d.setDate(d.getDate() + 3)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  })()

  const emptyForm = { due_date: defaultDue, note: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const emptyEdit = { due_date: '', contacted: false, client_feedback: '', skin_status: '', follow_up_action: '', note: '', complete: false }
  const [editForm, setEditForm] = useState(emptyEdit)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/follow-ups`)
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [clientId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/follow-ups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, due_date: form.due_date, note: form.note || null }),
    })
    setForm(emptyForm)
    await load()
    setSaving(false)
  }

  async function handleSaveEdit(id: number) {
    await fetch(`/api/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        due_date: editForm.due_date,
        contacted: editForm.contacted,
        client_feedback: editForm.client_feedback || null,
        skin_status: editForm.skin_status || null,
        follow_up_action: editForm.follow_up_action || null,
        note: editForm.note || null,
        complete: editForm.complete,
      }),
    })
    setEditingId(null)
    await load()
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除此追蹤任務？')) return
    await fetch(`/api/follow-ups/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(t: FollowUp) {
    setEditForm({
      due_date: t.due_date,
      contacted: !!t.contacted,
      client_feedback: t.client_feedback || '',
      skin_status: t.skin_status || '',
      follow_up_action: t.follow_up_action || '',
      note: t.note || '',
      complete: !!t.completed_at,
    })
    setEditingId(t.id)
  }

  const sInput: React.CSSProperties = {
    background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '5px',
    color: '#2c2825', fontSize: '0.82rem', outline: 'none', padding: '6px 10px',
  }

  const pending = tasks.filter(t => !t.completed_at)
  const done = tasks.filter(t => !!t.completed_at)

  return (
    <div className="space-y-5">
      {/* Add form */}
      <form onSubmit={handleAdd} style={{ background: '#eef2f9', border: '1px solid #9ab0e8', borderRadius: '8px', padding: '14px' }}>
        <p style={{ color: '#2d4f9a', fontSize: '0.82rem', fontWeight: 500, marginBottom: '12px' }}>新增課後追蹤任務</p>
        <div className="space-y-3">
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>追蹤日期</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {FOLLOW_UP_DAYS.map(n => {
                const d = new Date(); d.setDate(d.getDate() + n)
                const ds = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
                return (
                  <button key={n} type="button"
                    onClick={() => setForm(p => ({ ...p, due_date: ds }))}
                    style={{
                      padding: '3px 10px', borderRadius: '10px', fontSize: '0.72rem', border: 'none', cursor: 'pointer',
                      background: form.due_date === ds ? '#4a7ac8' : '#d8e4f4',
                      color: form.due_date === ds ? '#fff' : '#2d4f9a',
                    }}>
                    +{n}天
                  </button>
                )
              })}
            </div>
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              style={{ ...sInput, width: '100%' }} />
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>備註（提醒事項）</label>
            <textarea value={form.note} rows={2} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder={`EX：追蹤 ${clientName} 皮膚修復狀況`}
              style={{ ...sInput, width: '100%', resize: 'none' }} />
          </div>
        </div>
        <button type="submit" disabled={saving}
          style={{ marginTop: '10px', width: '100%', background: saving ? '#c4b8aa' : '#2d4f9a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.88rem', padding: '9px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '新增中…' : '新增追蹤'}
        </button>
      </form>

      {/* Pending */}
      {loading ? (
        <p style={{ color: '#9a8f84', textAlign: 'center', padding: '20px 0' }}>載入中…</p>
      ) : pending.length === 0 && done.length === 0 ? (
        <p style={{ color: '#b4aa9e', textAlign: 'center', padding: '20px 0', fontSize: '0.85rem' }}>尚無追蹤紀錄</p>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <div>
              <p style={{ color: '#2d4f9a', fontSize: '0.72rem', letterSpacing: '0.06em', marginBottom: '8px' }}>待追蹤 ({pending.length})</p>
              <div className="space-y-2">
                {pending.map(t => {
                  const daysLeft = Math.round((new Date(t.due_date).getTime() - new Date(today).getTime()) / 86400000)
                  const isOverdue = daysLeft < 0; const isDueToday = daysLeft === 0
                  return (
                    <div key={t.id}>
                      {editingId === t.id ? (
                        <div style={{ background: '#fff', border: '1px solid #9ab0e8', borderRadius: '6px', padding: '12px' }}>
                          <div className="space-y-2">
                            <div>
                              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>追蹤日期</label>
                              <input type="date" value={editForm.due_date} onChange={e => setEditForm(p => ({ ...p, due_date: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.78rem' }} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editForm.contacted} onChange={e => setEditForm(p => ({ ...p, contacted: e.target.checked }))} />
                              <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>已聯繫客人</span>
                            </label>
                            {[
                              { key: 'client_feedback', label: '客人反饋', ph: '滿意度、意見、問題…' },
                              { key: 'skin_status',     label: '皮膚狀況', ph: '皮膚恢復、反應…' },
                              { key: 'follow_up_action',label: '後續行動', ph: '下次預約、推薦產品…' },
                              { key: 'note',            label: '備註',     ph: '' },
                            ].map(({ key, label, ph }) => (
                              <div key={key}>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>{label}</label>
                                <textarea rows={2} value={editForm[key as keyof typeof editForm] as string}
                                  onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={ph} style={{ ...sInput, width: '100%', resize: 'none', fontSize: '0.78rem' }} />
                              </div>
                            ))}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editForm.complete} onChange={e => setEditForm(p => ({ ...p, complete: e.target.checked }))} />
                              <span style={{ color: '#3a7a42', fontSize: '0.82rem', fontWeight: 500 }}>✓ 標示為已完成</span>
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            <button onClick={() => handleSaveEdit(t.id)}
                              style={{ flex: 1, background: '#2d4f9a', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>
                              儲存
                            </button>
                            <button onClick={() => setEditingId(null)}
                              style={{ flex: 1, background: '#e0d9d0', color: '#6b5f54', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: isOverdue ? '#fdf0f0' : isDueToday ? '#fdf8ee' : '#eef2f9',
                          border: `1px solid ${isOverdue ? '#e89898' : isDueToday ? '#e8c96a' : '#9ab0e8'}`,
                          borderRadius: '6px', padding: '10px 12px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: isOverdue ? '#9a3a3a' : isDueToday ? '#9a6a00' : '#2d4f9a', fontSize: '0.82rem', fontWeight: 600 }}>
                                {fmtDate(t.due_date)}
                              </span>
                              <span style={{
                                background: isOverdue ? '#fdf0f0' : isDueToday ? '#fdf5e0' : '#e8f0fc',
                                color: isOverdue ? '#9a3a3a' : isDueToday ? '#9a6a00' : '#2d4f9a',
                                border: `1px solid ${isOverdue ? '#e89898' : isDueToday ? '#d4a84a' : '#9ab0e8'}`,
                                borderRadius: '4px', padding: '1px 7px', fontSize: '0.68rem', fontWeight: 600,
                              }}>
                                {isOverdue ? `逾期 ${-daysLeft}天` : isDueToday ? '今天' : `${daysLeft}天後`}
                              </span>
                            </div>
                            {t.note && <p style={{ color: '#6b5f54', fontSize: '0.78rem', marginTop: '3px' }}>{t.note}</p>}
                          </div>
                          <div style={{ display: 'flex', gap: '5px', marginLeft: '8px', flexShrink: 0 }}>
                            <button onClick={() => startEdit(t)}
                              style={{ background: '#2d4f9a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                              填寫追蹤
                            </button>
                            <button onClick={() => handleDelete(t.id)}
                              style={{ background: 'none', border: '1px solid #e8a8a8', borderRadius: '4px', color: '#9a6060', fontSize: '0.72rem', padding: '4px 8px', cursor: 'pointer' }}>
                              刪除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.06em', marginBottom: '8px' }}>已完成 ({done.length})</p>
              <div className="space-y-2">
                {done.map(t => (
                  <div key={t.id} style={{ background: '#f7f7f5', border: '1px solid #e0ddd8', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#9a8f84', fontSize: '0.82rem', textDecoration: 'line-through' }}>{fmtDate(t.due_date)}</span>
                          {t.contacted ? <span style={{ color: '#3a7a42', fontSize: '0.68rem' }}>✓ 已聯繫</span> : null}
                        </div>
                        {t.client_feedback && <p style={{ color: '#6b5f54', fontSize: '0.75rem', marginTop: '3px' }}>反饋：{t.client_feedback}</p>}
                        {t.skin_status && <p style={{ color: '#6b5f54', fontSize: '0.75rem' }}>皮膚：{t.skin_status}</p>}
                        {t.follow_up_action && <p style={{ color: '#6b5f54', fontSize: '0.75rem' }}>後續：{t.follow_up_action}</p>}
                      </div>
                      <button onClick={() => handleDelete(t.id)}
                        style={{ background: 'none', border: 'none', color: '#c4b8aa', fontSize: '0.68rem', cursor: 'pointer', marginLeft: '8px', flexShrink: 0 }}>
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
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

// ── 套組編輯用下拉選單 ──────────────────────────────────────────────────────
const PKG_BONUS_DESC_PRESETS = [
  'B5熱導+頸部',
  '臉部芳草精油+頸部',
  '臉部芳草精油撥筋',
  '原液調理一種',
  '原液調理一種+頸部+下頷線',
  '頭部刮舒+封膜',
]
const PKG_COMPLETION_SERVICE_PRESETS = ['泡光氧彗(梅)']
const PKG_COMPLETION_PRICE_PRESETS   = ['2880']

const pkgMiniInput: React.CSSProperties = {
  width: '100%', padding: '4px 7px', borderRadius: '4px',
  border: '1px solid #d9d0c5', fontSize: '0.78rem', background: '#faf8f5',
  outline: 'none', color: '#2c2825',
}

function PkgSelectOrInput({
  presets, value, onChange, placeholder, type = 'text',
}: {
  presets: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  const [customMode, setCustomMode] = useState(() => value !== '' && !presets.includes(value))

  useEffect(() => {
    if (presets.includes(value))    setCustomMode(false)
    else if (value !== '')          setCustomMode(true)
  }, [value, presets])

  const selectVal = customMode ? '__custom__' : value

  return (
    <div>
      <select
        value={selectVal}
        onChange={e => {
          if (e.target.value === '__custom__') { setCustomMode(true); onChange('') }
          else                                 { setCustomMode(false); onChange(e.target.value) }
        }}
        style={pkgMiniInput}
      >
        <option value="">— 請選擇 —</option>
        {presets.map(p => <option key={p} value={p}>{p}</option>)}
        <option value="__custom__">自訂義</option>
      </select>
      {customMode && (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...pkgMiniInput, marginTop: '4px' }}
          autoFocus
          min={type === 'number' ? 0 : undefined}
        />
      )}
    </div>
  )
}
